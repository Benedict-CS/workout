import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { db } from "./schema";
import type { WorkoutSession, Exercise, SetItem, BigThreeRecord } from "@/lib/types";

let cachedClient: SupabaseClient | null = null;
let cachedUrl = "";
let cachedKey = "";
let inFlightSync: Promise<SyncResult> | null = null;

const DEFAULT_SUPABASE_URL = "https://sbvcbkvnvhwalypmzbvt.supabase.co";
const DEFAULT_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidmNia3Zudmh3YWx5cG16YnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNTkzODksImV4cCI6MjEwOTgzNTM4OX0.flhfWoAIdfpp-5cQ98R_H1Hs6y5xTnCKD16eG6-VP_8";
const PAGE_SIZE = 500;
const TAB_LOCK_KEY = "workout_sync_lock";
const TAB_LOCK_TTL_MS = 10 * 60_000;
const CURSOR_TABLES = ["workout_sessions", "exercises", "workout_sets", "big_three_records"] as const;
type CursorTable = (typeof CURSOR_TABLES)[number];

export function getSupabaseClient(): SupabaseClient | null {
  const url =
    (typeof window !== "undefined" ? localStorage.getItem("workout_supabase_url") : null) ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    DEFAULT_SUPABASE_URL;
  const key =
    (typeof window !== "undefined" ? localStorage.getItem("workout_supabase_key") : null) ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_KEY;

  if (!url || !key) return null;
  if (cachedClient && cachedUrl === url && cachedKey === key) return cachedClient;
  try {
    cachedClient = createClient(url, key, { auth: { persistSession: false } });
    cachedUrl = url;
    cachedKey = key;
    return cachedClient;
  } catch (err) {
    console.error("Failed to initialize Supabase client", err);
    return null;
  }
}

export interface SyncResult {
  success: boolean;
  message: string;
  pushedCount: number;
  pulledCount: number;
}

export async function testSupabaseConnection(
  customUrl?: string,
  customKey?: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const url = customUrl ||
      (typeof window !== "undefined" ? localStorage.getItem("workout_supabase_url") || "" : "") ||
      process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const key = customKey ||
      (typeof window !== "undefined" ? localStorage.getItem("workout_supabase_key") || "" : "") ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;
    if (!url || !key) return { ok: false, message: "請先輸入 Project URL 與 Public Anon Key" };
    const client = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await client.from("workout_sessions").select("id").limit(1);
    if (error) return { ok: false, message: `連線失敗: ${error.message}` };
    return { ok: true, message: "雲端資料庫連線測試成功！" };
  } catch (e: any) {
    return { ok: false, message: `連線發生錯誤: ${e?.message || e}` };
  }
}

export function extractLocationFromSession(s: any): string | undefined {
  if (s.location) return s.location;
  if (s.notes) {
    try {
      const parsed = JSON.parse(s.notes);
      if (parsed.location) return parsed.location;
    } catch {}
  }
  const title = s.display_title || "";
  if (title.includes("永和國民運動中心")) return "永和國民運動中心";
  if (title.includes("四號公園")) return "四號公園";
  if (title.includes("zyx家游泳池")) return "zyx家游泳池";
  if (title.includes("清大游泳池")) return "清大游泳池";
  if (title.includes("交大游泳池")) return "交大游泳池";
  if (title.includes("交大健身房")) return "交大健身房";
  if (title.includes("三健客") || title.includes("三劍客")) return "三健客";
  if (s.target_muscle === "游泳") return "交大游泳池";
  return (s.date || "") <= "2026-08-31" ? "交大健身房" : "三健客";
}

const LEGACY_ID_MAP: Record<string, string> = {
  "ex-bench-press": "ex-bench", "ex-flat-dumbbell": "ex-db-bench",
  "ex-db-flat-press": "ex-db-bench", "ex-flat-dumbbell-press": "ex-db-bench",
  "ex-incline-dumbbell": "ex-db-incline-bench", "ex-incline-db-press": "ex-db-incline-bench",
  "ex-incline-barbell-press": "ex-incline-bench", "ex-db-row": "ex-db-single-row",
  "ex-one-arm-dumbbell-row": "ex-db-single-row", "ex-pec-deck": "ex-pec-fly",
  "ex-machine-incline-press": "ex-incline-machine-bench", "ex-chest-press": "ex-chest-press-seated",
  "ex-seated-row-machine": "ex-seated-row", "ex-tricep-press-chest": "ex-dip-pushdown-machine",
  "ex-hex-deadlift": "ex-trap-bar-deadlift", "ex-lat-row-machine": "ex-high-row",
  "ex-seated-back-row-machine": "ex-seated-cable-row", "ex-lying-leg-curl": "ex-leg-curl",
  "ex-bulgarian-split-squat": "ex-bulgarian-squat",
  "ex-dumbbell-shoulder-press": "ex-db-shoulder-press", "ex-face-pull": "ex-cable-face-pull",
  "ex-reverse-pec-deck": "ex-reverse-pec-fly", "ex-rope-tricep-pushdown": "ex-rope-tricep",
  "ex-dumbbell-hammer-curl": "ex-db-hammer-curl", "ex-incline-dumbbell-curl": "ex-incline-db-curl",
};

function cursorKey(table: CursorTable): string {
  return `workout_sync_cursor:${encodeURIComponent(cachedUrl)}:${table}`;
}

function readCursor(table: CursorTable): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(cursorKey(table)); } catch { return null; }
}

async function pullChangedRows(
  supabase: SupabaseClient,
  table: CursorTable,
  columns: string,
  previousCursor: string | null
): Promise<{ rows: any[]; nextCursor: string | null }> {
  const rows: any[] = [];
  // Use the last successful timestamp directly. Rewinding a fixed overlap while
  // storing the max row timestamp makes the same recent rows repeat forever.
  let offset = 0;
  while (true) {
    let query = (supabase as any).from(table).select(columns)
      .order("updated_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (previousCursor) query = query.gt("updated_at", previousCursor);
    const { data, error } = await query;
    if (error) throw new Error(`Pull ${table} failed: ${error.message}`);
    const page = (data || []) as any[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const latest = rows.reduce<string | null>((max, row) => {
    const value = row?.updated_at;
    return value && (!max || value > max) ? value : max;
  }, previousCursor);
  return { rows, nextCursor: latest };
}

export function runFullSync(): Promise<SyncResult> {
  if (inFlightSync) return inFlightSync;
  const task = runWithCrossTabLock();
  inFlightSync = task.finally(() => { inFlightSync = null; });
  return inFlightSync;
}

async function runWithCrossTabLock(): Promise<SyncResult> {
  if (typeof navigator !== "undefined" && (navigator as any).locks?.request) {
    return (navigator as any).locks.request(
      "workout-supabase-sync", { ifAvailable: true },
      (lock: unknown) => lock ? performSync() : ({
        success: true, message: "另一個分頁正在同步，略過本次同步", pushedCount: 0, pulledCount: 0,
      })
    );
  }

  if (typeof window !== "undefined") {
    const owner = `${Date.now()}-${Math.random()}`;
    try {
      const current = JSON.parse(localStorage.getItem(TAB_LOCK_KEY) || "null");
      if (current?.expiresAt > Date.now()) {
        return { success: true, message: "另一個分頁正在同步，略過本次同步", pushedCount: 0, pulledCount: 0 };
      }
      localStorage.setItem(TAB_LOCK_KEY, JSON.stringify({ owner, expiresAt: Date.now() + TAB_LOCK_TTL_MS }));
      const acquired = JSON.parse(localStorage.getItem(TAB_LOCK_KEY) || "null");
      if (acquired?.owner !== owner) {
        return { success: true, message: "另一個分頁正在同步，略過本次同步", pushedCount: 0, pulledCount: 0 };
      }
      try { return await performSync(); }
      finally {
        const latest = JSON.parse(localStorage.getItem(TAB_LOCK_KEY) || "null");
        if (latest?.owner === owner) localStorage.removeItem(TAB_LOCK_KEY);
      }
    } catch (err) {
      console.warn("Cross-tab lock unavailable; continuing with in-tab guard:", err);
    }
  }
  return performSync();
}

async function performSync(): Promise<SyncResult> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, message: "未設定 Supabase 憑證或無效", pushedCount: 0, pulledCount: 0 };
  let pushed = 0;
  let pulled = 0;

  try {
    const legacySwims = await db.sessions.filter((s) => s.id.startsWith("session-swim-")).toArray();
    if (legacySwims.length) {
      const ids = legacySwims.map((s) => s.id);
      await db.sessions.bulkDelete(ids);
      const sets = await db.sets.filter((s) => ids.includes(s.session_id)).toArray();
      if (sets.length) await db.sets.bulkDelete(sets.map((s) => s.id));
    }
    const corrupt = await db.sets.filter((s) => s.id.startsWith("set-179464")).toArray();
    if (corrupt.length) await db.sets.bulkDelete(corrupt.map((s) => s.id));

    const pendingSessions = (await db.sessions.toArray()).filter(
      (s) => (s.sync_status === "pending" || !s.sync_status) && !s.id.startsWith("session-swim-")
    );
    if (pendingSessions.length) {
      const payload = pendingSessions.map((s) => ({
        id: s.id, date: s.date, month_key: s.month_key, display_title: s.display_title,
        target_muscle: s.target_muscle, monthly_index: s.monthly_index || 1,
        notes: JSON.stringify({ note: s.notes || "", location: s.location || "" }),
        created_at: s.created_at, updated_at: s.updated_at, deleted_at: s.deleted_at || null,
      }));
      const { error } = await supabase.from("workout_sessions").upsert(payload, { onConflict: "id" });
      if (error) throw new Error(`Push workout_sessions failed: ${error.message}`);
      pushed += payload.length;
      await db.sessions.bulkPut(pendingSessions.map((s) => ({ ...s, sync_status: "synced" })));
    }

    const pendingExercises = (await db.exercises.toArray()).filter(
      (e) => e.sync_status === "pending" || !e.sync_status
    );
    if (pendingExercises.length) {
      const payload = pendingExercises.map((e) => ({
        id: e.id, name: e.name, muscle_group: e.muscle_group, weight_type: e.weight_type,
        default_notes: e.default_notes || null, is_favorite: !!e.is_favorite,
        created_at: e.created_at, updated_at: e.updated_at, deleted_at: e.deleted_at || null,
      }));
      const { error } = await supabase.from("exercises").upsert(payload, { onConflict: "id" });
      if (error) throw new Error(`Push exercises failed: ${error.message}`);
      pushed += payload.length;
      await db.exercises.bulkPut(pendingExercises.map((e) => ({ ...e, sync_status: "synced" })));
    }

    const pendingSets = (await db.sets.toArray()).filter((s) => s.sync_status === "pending" || !s.sync_status);
    for (let i = 0; i < pendingSets.length; i += 150) {
      const chunk = pendingSets.slice(i, i + 150);
      const payload = chunk.map((s) => ({
        id: s.id, session_id: s.session_id, exercise_id: s.exercise_id, set_order: s.set_order,
        set_type: s.set_type, weight_kg: s.weight_kg, reps: Math.round(s.reps ?? 0),
        raw_text: s.raw_text || null,
        rest_pause_detail: s.sub_fields ? JSON.stringify(s.sub_fields) : (s.rest_pause_detail || null),
        forced_reps: s.forced_reps || null, is_failure: !!s.is_failure,
        feedback: s.is_completed
          ? (s.feedback ? `${s.feedback.replace(/\|?completed/g, "")}|completed` : "completed")
          : (s.feedback ? s.feedback.replace(/\|?completed/g, "").trim() || null : null),
        notes: s.notes || null, created_at: s.created_at, updated_at: s.updated_at,
        deleted_at: s.deleted_at || null,
      }));
      const { error } = await supabase.from("workout_sets").upsert(payload, { onConflict: "id" });
      if (error) throw new Error(`Push workout_sets failed: ${error.message}`);
      pushed += chunk.length;
      await db.sets.bulkPut(chunk.map((s) => ({ ...s, sync_status: "synced" })));
    }

    const pendingB3 = (await db.big_three.toArray()).filter(
      (b) => b.sync_status === "pending" || !b.sync_status
    );
    if (pendingB3.length) {
      const payload = pendingB3.map((b) => ({
        id: b.id, bench_press_kg: b.bench_press_kg, squat_kg: b.squat_kg,
        deadlift_kg: b.deadlift_kg, total_kg: b.total_kg, body_weight_kg: b.body_weight_kg || null,
        bench_ratio: b.bench_ratio || null, squat_ratio: b.squat_ratio || null,
        deadlift_ratio: b.deadlift_ratio || null, updated_at: b.updated_at,
      }));
      const { error } = await supabase.from("big_three_records").upsert(payload, { onConflict: "id" });
      if (error) throw new Error(`Push big_three_records failed: ${error.message}`);
      pushed += payload.length;
      await db.big_three.bulkPut(pendingB3.map((b) => ({ ...b, sync_status: "synced" })));
    }

    const columns: Record<CursorTable, string> = {
      workout_sessions: "id,date,month_key,display_title,target_muscle,monthly_index,notes,created_at,updated_at,deleted_at",
      exercises: "id,name,muscle_group,weight_type,default_notes,is_favorite,created_at,updated_at,deleted_at",
      workout_sets: "id,session_id,exercise_id,set_order,set_type,weight_kg,reps,raw_text,rest_pause_detail,forced_reps,is_failure,feedback,notes,created_at,updated_at,deleted_at",
      big_three_records: "id,bench_press_kg,squat_kg,deadlift_kg,total_kg,body_weight_kg,bench_ratio,squat_ratio,deadlift_ratio,updated_at",
    };
    const pulls = {} as Record<CursorTable, { rows: any[]; nextCursor: string | null }>;
    for (const table of CURSOR_TABLES) {
      pulls[table] = await pullChangedRows(supabase, table, columns[table], readCursor(table));
    }

    for (const rs of pulls.workout_sessions.rows) {
      if (!rs?.id) continue;
      const isSwim = rs.target_muscle === "游泳" || (rs.display_title && rs.display_title.includes("泳"));
      if (rs.deleted_at && !isSwim) {
        const local = await db.sessions.get(rs.id);
        if (local) {
          await db.sessions.delete(rs.id);
          const sets = await db.sets.where("session_id").equals(rs.id).toArray();
          if (sets.length) await db.sets.bulkDelete(sets.map((s) => s.id));
          pulled++;
        }
        continue;
      }
      if (rs.id.startsWith("session-swim-")) continue;
      const local = await db.sessions.get(rs.id);
      if (!local || new Date(rs.updated_at) > new Date(local.updated_at)) {
        let noteText = rs.notes;
        if (rs.notes?.startsWith("{")) {
          try { noteText = JSON.parse(rs.notes).note; } catch {}
        }
        await db.sessions.put({
          id: rs.id, date: rs.date, month_key: rs.month_key, display_title: rs.display_title,
          target_muscle: isSwim ? "游泳" : rs.target_muscle, monthly_index: rs.monthly_index,
          location: extractLocationFromSession(rs), notes: noteText, created_at: rs.created_at,
          updated_at: rs.updated_at, deleted_at: isSwim ? null : rs.deleted_at, sync_status: "synced",
        });
        pulled++;
      }
    }

    for (const re of pulls.exercises.rows) {
      if (!re?.id) continue;
      if (re.deleted_at) { await db.exercises.delete(re.id); pulled++; continue; }
      if (LEGACY_ID_MAP[re.id]) {
        if (re.is_favorite) await db.exercises.update(LEGACY_ID_MAP[re.id], { is_favorite: true });
        continue;
      }
      const local = await db.exercises.get(re.id);
      if (!local || new Date(re.updated_at) > new Date(local.updated_at)) {
        await db.exercises.put({
          id: re.id, name: re.name, muscle_group: re.muscle_group, weight_type: re.weight_type,
          default_notes: re.default_notes, is_favorite: re.is_favorite, created_at: re.created_at,
          updated_at: re.updated_at, deleted_at: re.deleted_at, sync_status: "synced",
        });
        pulled++;
      }
    }

    for (const rst of pulls.workout_sets.rows) {
      if (!rst?.id) continue;
      if (rst.deleted_at) { await db.sets.delete(rst.id); pulled++; continue; }
      const local = await db.sets.get(rst.id);
      if (!local || new Date(rst.updated_at) > new Date(local.updated_at)) {
        let subFields = undefined;
        if (rst.rest_pause_detail?.startsWith("[")) {
          try { subFields = JSON.parse(rst.rest_pause_detail); } catch {}
        }
        await db.sets.put({
          id: rst.id, session_id: rst.session_id, exercise_id: LEGACY_ID_MAP[rst.exercise_id] || rst.exercise_id,
          set_order: rst.set_order, set_type: rst.set_type, weight_kg: Number(rst.weight_kg),
          reps: Number(rst.reps), raw_text: rst.raw_text, sub_fields: subFields,
          rest_pause_detail: rst.rest_pause_detail, forced_reps: rst.forced_reps,
          is_failure: rst.is_failure, is_completed: rst.feedback?.includes("completed") || false,
          feedback: rst.feedback, notes: rst.notes, created_at: rst.created_at,
          updated_at: rst.updated_at, deleted_at: rst.deleted_at, sync_status: "synced",
        });
        pulled++;
      }
    }

    for (const rb of pulls.big_three_records.rows) {
      if (!rb?.id) continue;
      const local = await db.big_three.get(rb.id);
      if (!local || new Date(rb.updated_at) > new Date(local.updated_at)) {
        await db.big_three.put({
          id: rb.id, bench_press_kg: Number(rb.bench_press_kg), squat_kg: Number(rb.squat_kg),
          deadlift_kg: Number(rb.deadlift_kg), total_kg: Number(rb.total_kg),
          body_weight_kg: rb.body_weight_kg ? Number(rb.body_weight_kg) : undefined,
          bench_ratio: rb.bench_ratio ? Number(rb.bench_ratio) : undefined,
          squat_ratio: rb.squat_ratio ? Number(rb.squat_ratio) : undefined,
          deadlift_ratio: rb.deadlift_ratio ? Number(rb.deadlift_ratio) : undefined,
          updated_at: rb.updated_at, sync_status: "synced",
        });
        pulled++;
      }
    }

    if (typeof window !== "undefined") {
      for (const table of CURSOR_TABLES) {
        const cursor = pulls[table].nextCursor;
        if (cursor) localStorage.setItem(cursorKey(table), cursor);
      }
      localStorage.setItem("workout_last_sync_time", new Date().toISOString());
      if (pulled > 0 || pushed > 0) window.dispatchEvent(new CustomEvent("workout:data_changed"));
    }
    return { success: true, message: `同步完成！已上傳 ${pushed} 筆資料、下載 ${pulled} 筆雲端更新`, pushedCount: pushed, pulledCount: pulled };
  } catch (err: any) {
    return { success: false, message: `同步失敗: ${err?.message || err}`, pushedCount: pushed, pulledCount: pulled };
  }
}

/** Use tombstones for deletes so other clients can receive them through incremental pulls. */
export async function deleteRemoteSession(sessionId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const now = new Date().toISOString();
  try {
    const { error: setsError } = await supabase.from("workout_sets")
      .update({ deleted_at: now, updated_at: now }).eq("session_id", sessionId);
    if (setsError) throw setsError;
    const { error } = await supabase.from("workout_sessions")
      .update({ deleted_at: now, updated_at: now }).eq("id", sessionId);
    if (error) throw error;
  } catch (err) { console.error("Failed to delete remote session:", err); }
}

export async function deleteRemoteSet(setId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const now = new Date().toISOString();
  try {
    const { error } = await supabase.from("workout_sets")
      .update({ deleted_at: now, updated_at: now }).eq("id", setId);
    if (error) throw error;
  } catch (err) { console.error("Failed to delete remote set:", err); }
}

export async function deleteRemoteBodyWeight(_id: string): Promise<void> {
  // Dexie stores the full body-weight and InBody data locally.
}

export async function deleteRemoteExercise(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const now = new Date().toISOString();
  try {
    const { error } = await supabase.from("exercises")
      .update({ deleted_at: now, updated_at: now }).eq("id", id);
    if (error) throw error;
  } catch (err) { console.error("Failed to delete remote exercise:", err); }
}

export async function getRecentSessions(limit = 30): Promise<WorkoutSession[]> {
  const all = await db.sessions.filter((s) => !s.deleted_at).sortBy("date");
  return all.reverse().slice(0, limit);
}

export async function getSessionById(id: string): Promise<WorkoutSession | undefined> {
  return db.sessions.get(id);
}

export async function getSessionSets(sessionId: string): Promise<SetItem[]> {
  return db.sets.where("session_id").equals(sessionId).filter((s) => !s.deleted_at).sortBy("set_order");
}

export async function getAllExercises(): Promise<Exercise[]> {
  return db.exercises.filter((e) => !e.deleted_at).sortBy("name");
}

export async function getLatestBigThree(): Promise<BigThreeRecord | undefined> {
  const records = await db.big_three.toArray();
  return records[0];
}

export async function getLastExerciseSets(
  exerciseId: string,
  excludeSessionId?: string
): Promise<{ session: WorkoutSession; sets: SetItem[] } | null> {
  const sets = await db.sets.where("exercise_id").equals(exerciseId)
    .filter((s) => !s.deleted_at && s.session_id !== excludeSessionId).toArray();
  if (!sets.length) return null;
  const sessionIds = Array.from(new Set(sets.map((s) => s.session_id)));
  const sessions = await db.sessions.where("id").anyOf(sessionIds)
    .filter((s) => !s.deleted_at).sortBy("date");
  const lastSession = sessions[sessions.length - 1];
  if (!lastSession) return null;
  return {
    session: lastSession,
    sets: sets.filter((s) => s.session_id === lastSession.id).sort((a, b) => a.set_order - b.set_order),
  };
}

export async function getExerciseHistorySessions(
  exerciseId: string,
  limit = 5
): Promise<{ session: WorkoutSession; sets: SetItem[] }[]> {
  const sets = await db.sets.where("exercise_id").equals(exerciseId)
    .filter((s) => !s.deleted_at && s.weight_kg > 0).toArray();
  if (!sets.length) return [];
  const sessionIds = Array.from(new Set(sets.map((s) => s.session_id)));
  const sessions = (await db.sessions.where("id").anyOf(sessionIds)
    .filter((s) => !s.deleted_at).sortBy("date")).reverse();
  const result: { session: WorkoutSession; sets: SetItem[] }[] = [];
  for (const sess of sessions.slice(0, limit)) {
    result.push({
      session: sess,
      sets: sets.filter((s) => s.session_id === sess.id).sort((a, b) => a.set_order - b.set_order),
    });
  }
  return result;
}

export async function getPreviousSessionTemplate(
  targetMuscle: string
): Promise<{ session: WorkoutSession; exerciseIds: string[]; sets: SetItem[] } | null> {
  const sessions = (await db.sessions.filter((s) => !s.deleted_at && s.target_muscle.includes(targetMuscle))
    .sortBy("date")).reverse();
  if (!sessions.length) return null;
  const session = sessions[0];
  const sets = await db.sets.where("session_id").equals(session.id)
    .filter((s) => !s.deleted_at).sortBy("set_order");
  const exerciseIds: string[] = [];
  for (const set of sets) if (!exerciseIds.includes(set.exercise_id)) exerciseIds.push(set.exercise_id);
  return { session, exerciseIds, sets };
}

export async function getExerciseMaxPR(exerciseId: string): Promise<{
  maxWeight: number;
  maxWeightReps: number;
  max1RM: number;
  bestSet: SetItem | null;
}> {
  const sets = await db.sets.where("exercise_id").equals(exerciseId)
    .filter((s) => !s.deleted_at && s.weight_kg > 0).toArray();
  if (!sets.length) return { maxWeight: 0, maxWeightReps: 0, max1RM: 0, bestSet: null };
  let maxWeight = 0;
  let maxWeightReps = 0;
  let max1RM = 0;
  let bestSet: SetItem | null = null;
  for (const set of sets) {
    if (set.weight_kg > maxWeight) { maxWeight = set.weight_kg; maxWeightReps = set.reps; }
    const current1RM = estimate1RM(set.weight_kg, set.reps);
    if (current1RM > max1RM) { max1RM = current1RM; bestSet = set; }
  }
  return { maxWeight, maxWeightReps, max1RM, bestSet };
}

export function estimate1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

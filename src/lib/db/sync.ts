import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { db } from "./schema";
import type { WorkoutSession, Exercise, SetItem, BigThreeRecord } from "@/lib/types";

let cachedClient: SupabaseClient | null = null;
let cachedUrl = "";
let cachedKey = "";

const DEFAULT_SUPABASE_URL = "https://sbvcbkvnvhwalypmzbvt.supabase.co";
const DEFAULT_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidmNia3Zudmh3YWx5cG16YnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNTkzODksImV4cCI6MjEwOTgzNTM4OX0.flhfWoAIdfpp-5cQ98R_H1Hs6y5xTnCKD16eG6-VP_8";

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

  if (cachedClient && cachedUrl === url && cachedKey === key) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, {
      auth: { persistSession: false },
    });
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

/**
 * 測試與 Supabase 雲端專案的連線是否通暢
 */
export async function testSupabaseConnection(
  customUrl?: string,
  customKey?: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const url =
      customUrl ||
      (typeof window !== "undefined" ? localStorage.getItem("workout_supabase_url") || "" : "") ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      DEFAULT_SUPABASE_URL;
    const key =
      customKey ||
      (typeof window !== "undefined" ? localStorage.getItem("workout_supabase_key") || "" : "") ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      DEFAULT_SUPABASE_KEY;

    if (!url || !key) {
      return { ok: false, message: "請先輸入 Project URL 與 Public Anon Key" };
    }

    const testClient = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await testClient.from("workout_sessions").select("id").limit(1);

    if (error) {
      return { ok: false, message: `連線失敗: ${error.message}` };
    }

    return { ok: true, message: "雲端資料庫連線測試成功！" };
  } catch (e: any) {
    return { ok: false, message: `連線發生錯誤: ${e?.message || e}` };
  }
}

/**
 * 解析 session 的場地名稱
 */
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

  const date = s.date || "";
  if (s.target_muscle === "游泳") return "交大游泳池";
  if (date <= "2026-08-31") return "交大健身房";
  return "三健客";
}

/**
 * 執行雙向同步：
 * 1. 將本機 pending 或 modified 資料上傳 (Upsert) 到 Supabase
 * 2. 下載雲端較新的資料更新至本機 IndexedDB (包括跨裝置手機讀取)
 */
export async function runFullSync(): Promise<SyncResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      success: false,
      message: "未設定 Supabase 憑證或無效",
      pushedCount: 0,
      pulledCount: 0,
    };
  }

  let pushed = 0;
  let pulled = 0;

  try {
    // 0. 清理本地歷史遺留的舊 ID (例如 session-swim-* 系列)，防止污染雲端
    const legacySwims = await db.sessions.filter((s) => s.id.startsWith("session-swim-")).toArray();
    if (legacySwims.length > 0) {
      const legIds = legacySwims.map((s) => s.id);
      await db.sessions.bulkDelete(legIds);
      const legSets = await db.sets.filter((st) => legIds.includes(st.session_id)).toArray();
      if (legSets.length > 0) {
        await db.sets.bulkDelete(legSets.map((s) => s.id));
      }
    }

    // 1. 同步 Sessions
    const localSessions = await db.sessions.toArray();
    const pendingSessions = localSessions.filter(
      (s) => (s.sync_status === "pending" || !s.sync_status) && !s.id.startsWith("session-swim-")
    );

    if (pendingSessions.length > 0) {
      const payload = pendingSessions.map((s) => ({
        id: s.id,
        date: s.date,
        month_key: s.month_key,
        display_title: s.display_title,
        target_muscle: s.target_muscle,
        monthly_index: s.monthly_index || 1,
        notes: JSON.stringify({ note: s.notes || "", location: s.location || "" }),
        created_at: s.created_at,
        updated_at: s.updated_at,
        deleted_at: s.deleted_at || null,
      }));

      const { error: pushErr } = await supabase
        .from("workout_sessions")
        .upsert(payload, { onConflict: "id" });

      if (!pushErr) {
        pushed += pendingSessions.length;
        await db.sessions.bulkPut(
          pendingSessions.map((s) => ({ ...s, sync_status: "synced" }))
        );
      } else {
        console.error("Error pushing sessions:", pushErr);
      }
    }

    // 2. 同步 Exercises
    const localExercises = await db.exercises.toArray();
    const pendingExercises = localExercises.filter(
      (e) => e.sync_status === "pending" || !e.sync_status
    );

    if (pendingExercises.length > 0) {
      const payload = pendingExercises.map((e) => ({
        id: e.id,
        name: e.name,
        muscle_group: e.muscle_group,
        weight_type: e.weight_type,
        default_notes: e.default_notes || null,
        is_favorite: !!e.is_favorite,
        created_at: e.created_at,
        updated_at: e.updated_at,
        deleted_at: e.deleted_at || null,
      }));

      const { error: pushExErr } = await supabase
        .from("exercises")
        .upsert(payload, { onConflict: "id" });

      if (!pushExErr) {
        pushed += pendingExercises.length;
        await db.exercises.bulkPut(
          pendingExercises.map((e) => ({ ...e, sync_status: "synced" }))
        );
      }
    }

    // 3. 同步 Sets
    const localSets = await db.sets.toArray();
    const pendingSets = localSets.filter(
      (st) => st.sync_status === "pending" || !st.sync_status
    );

    if (pendingSets.length > 0) {
      const chunkSize = 150;
      for (let i = 0; i < pendingSets.length; i += chunkSize) {
        const chunk = pendingSets.slice(i, i + chunkSize);
        const payload = chunk.map((st) => ({
          id: st.id,
          session_id: st.session_id,
          exercise_id: st.exercise_id,
          set_order: st.set_order,
          set_type: st.set_type,
          weight_kg: st.weight_kg,
          reps: st.reps,
          raw_text: st.raw_text || null,
          rest_pause_detail: st.sub_fields ? JSON.stringify(st.sub_fields) : (st.rest_pause_detail || null),
          forced_reps: st.forced_reps || null,
          is_failure: !!st.is_failure,
          feedback: st.feedback || null,
          notes: st.notes || null,
          created_at: st.created_at,
          updated_at: st.updated_at,
          deleted_at: st.deleted_at || null,
        }));

        const { error: pushSetErr } = await supabase
          .from("workout_sets")
          .upsert(payload, { onConflict: "id" });

        if (!pushSetErr) {
          pushed += chunk.length;
          await db.sets.bulkPut(chunk.map((st) => ({ ...st, sync_status: "synced" })));
        } else {
          console.error("Error pushing sets chunk:", pushSetErr);
        }
      }
    }

    // 4. 同步 Big Three
    const localB3 = await db.big_three.toArray();
    if (localB3.length > 0) {
      const payload = localB3.map((b) => ({
        id: b.id,
        bench_press_kg: b.bench_press_kg,
        squat_kg: b.squat_kg,
        deadlift_kg: b.deadlift_kg,
        total_kg: b.total_kg,
        body_weight_kg: b.body_weight_kg || null,
        bench_ratio: b.bench_ratio || null,
        squat_ratio: b.squat_ratio || null,
        deadlift_ratio: b.deadlift_ratio || null,
        updated_at: b.updated_at,
      }));

      const { error: b3Err } = await supabase
        .from("big_three_records")
        .upsert(payload, { onConflict: "id" });

      if (!b3Err) {
        pushed += localB3.length;
      }
    }

    // 5. 下載雲端更新 (Pull latest for all tables)
    // 5.1 Pull Sessions
    const { data: remoteSessions } = await supabase
      .from("workout_sessions")
      .select("*")
      .order("date", { ascending: false })
      .limit(1000);

    if (remoteSessions && remoteSessions.length > 0) {
      // 依 date + target_muscle 自然鍵去重，保證同一天同一部位僅保留一筆標準紀錄
      const validRemoteMap = new Map<string, typeof remoteSessions[0]>();
      for (const rs of remoteSessions) {
        if (rs.id.startsWith("session-swim-")) continue;
        const key = `${rs.date}_${rs.target_muscle}`;
        if (!validRemoteMap.has(key)) {
          validRemoteMap.set(key, rs);
        } else {
          const existing = validRemoteMap.get(key)!;
          if (new Date(rs.updated_at) > new Date(existing.updated_at)) {
            validRemoteMap.set(key, rs);
          }
        }
      }

      const deduplicatedRemotes = Array.from(validRemoteMap.values());
      const remoteIdSet = new Set(deduplicatedRemotes.map((r) => r.id));

      for (const rs of deduplicatedRemotes) {
        const local = await db.sessions.get(rs.id);
        if (!local || new Date(rs.updated_at) > new Date(local.updated_at)) {
          const loc = extractLocationFromSession(rs);
          let noteText = rs.notes;
          if (rs.notes && rs.notes.startsWith("{")) {
            try {
              noteText = JSON.parse(rs.notes).note;
            } catch {}
          }
          await db.sessions.put({
            id: rs.id,
            date: rs.date,
            month_key: rs.month_key,
            display_title: rs.display_title,
            target_muscle: rs.target_muscle,
            monthly_index: rs.monthly_index,
            location: loc,
            notes: noteText,
            created_at: rs.created_at,
            updated_at: rs.updated_at,
            deleted_at: rs.deleted_at,
            sync_status: "synced",
          });
          pulled++;
        }
      }

      // 單一真實來源 (SSOT) 修復：清除本地已標記 synced 但雲端已被刪除的孤兒記錄（例如已被清理的 16 筆重複游泳）
      const localAll = await db.sessions.toArray();
      const orphaned = localAll.filter(
        (s) => (s.sync_status === "synced" || s.id.startsWith("session-swim-")) && !remoteIdSet.has(s.id)
      );
      if (orphaned.length > 0) {
        const orpIds = orphaned.map((o) => o.id);
        await db.sessions.bulkDelete(orpIds);
        const orpSets = await db.sets.filter((st) => orpIds.includes(st.session_id)).toArray();
        if (orpSets.length > 0) {
          await db.sets.bulkDelete(orpSets.map((s) => s.id));
        }
      }
    }

    // 5.2 Pull Exercises
    const { data: remoteExercises } = await supabase
      .from("exercises")
      .select("*")
      .limit(500);

    if (remoteExercises && remoteExercises.length > 0) {
      for (const re of remoteExercises) {
        const local = await db.exercises.get(re.id);
        if (!local || new Date(re.updated_at) > new Date(local.updated_at)) {
          await db.exercises.put({
            id: re.id,
            name: re.name,
            muscle_group: re.muscle_group,
            weight_type: re.weight_type,
            default_notes: re.default_notes,
            is_favorite: re.is_favorite,
            created_at: re.created_at,
            updated_at: re.updated_at,
            deleted_at: re.deleted_at,
            sync_status: "synced",
          });
          pulled++;
        }
      }
    }

    // 5.3 Pull Sets (in batches if needed)
    const { data: remoteSets } = await supabase
      .from("workout_sets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (remoteSets && remoteSets.length > 0) {
      for (const rst of remoteSets) {
        const local = await db.sets.get(rst.id);
        if (!local || new Date(rst.updated_at) > new Date(local.updated_at)) {
          let subFields = undefined;
          if (rst.rest_pause_detail && rst.rest_pause_detail.startsWith("[")) {
            try {
              subFields = JSON.parse(rst.rest_pause_detail);
            } catch {}
          }
          await db.sets.put({
            id: rst.id,
            session_id: rst.session_id,
            exercise_id: rst.exercise_id,
            set_order: rst.set_order,
            set_type: rst.set_type,
            weight_kg: Number(rst.weight_kg),
            reps: Number(rst.reps),
            raw_text: rst.raw_text,
            sub_fields: subFields,
            rest_pause_detail: rst.rest_pause_detail,
            forced_reps: rst.forced_reps,
            is_failure: rst.is_failure,
            feedback: rst.feedback,
            notes: rst.notes,
            created_at: rst.created_at,
            updated_at: rst.updated_at,
            deleted_at: rst.deleted_at,
            sync_status: "synced",
          });
          pulled++;
        }
      }
    }

    // 5.4 Pull Big Three
    const { data: remoteB3 } = await supabase
      .from("big_three_records")
      .select("*")
      .limit(5);

    if (remoteB3 && remoteB3.length > 0) {
      for (const rb of remoteB3) {
        await db.big_three.put({
          id: rb.id,
          bench_press_kg: Number(rb.bench_press_kg),
          squat_kg: Number(rb.squat_kg),
          deadlift_kg: Number(rb.deadlift_kg),
          total_kg: Number(rb.total_kg),
          body_weight_kg: rb.body_weight_kg ? Number(rb.body_weight_kg) : undefined,
          bench_ratio: rb.bench_ratio ? Number(rb.bench_ratio) : undefined,
          squat_ratio: rb.squat_ratio ? Number(rb.squat_ratio) : undefined,
          deadlift_ratio: rb.deadlift_ratio ? Number(rb.deadlift_ratio) : undefined,
          updated_at: rb.updated_at,
          sync_status: "synced",
        });
      }
    }

    // 5.5 同步 Body Weights (體重與體脂率，嘗試同步，若資料表未建立則優雅略過)
    try {
      const localBw = await db.body_weight.toArray();
      const pendingBw = localBw.filter((b) => b.sync_status === "pending" || !b.sync_status);
      if (pendingBw.length > 0) {
        const bwPayload = pendingBw.map((b) => ({
          id: b.id,
          date: b.date,
          weight_kg: b.weight_kg,
          body_fat_pct: b.body_fat_pct ?? null,
          skeletal_muscle_kg: b.skeletal_muscle_kg ?? null,
          note: b.note ?? null,
          created_at: b.created_at,
          updated_at: b.updated_at,
        }));
        const { error: bwErr } = await supabase
          .from("body_weights")
          .upsert(bwPayload, { onConflict: "id" });
        if (!bwErr) {
          pushed += pendingBw.length;
          await db.body_weight.bulkPut(
            pendingBw.map((b) => ({ ...b, sync_status: "synced" }))
          );
        }
      }

      const { data: remoteBw } = await supabase
        .from("body_weights")
        .select("*")
        .limit(1000);

      if (remoteBw && remoteBw.length > 0) {
        for (const rb of remoteBw) {
          const local = await db.body_weight.get(rb.id);
          if (!local || new Date(rb.updated_at) > new Date(local.updated_at)) {
            await db.body_weight.put({
              id: rb.id,
              date: rb.date,
              weight_kg: Number(rb.weight_kg),
              body_fat_pct: rb.body_fat_pct ? Number(rb.body_fat_pct) : undefined,
              skeletal_muscle_kg: rb.skeletal_muscle_kg ? Number(rb.skeletal_muscle_kg) : undefined,
              note: rb.note || undefined,
              created_at: rb.created_at,
              updated_at: rb.updated_at,
              sync_status: "synced",
            });
            pulled++;
          }
        }
      }
    } catch {
      // 雲端資料表未建立時優雅忽略，不中斷主流程
    }

    const now = new Date().toISOString();
    if (typeof window !== "undefined") {
      localStorage.setItem("workout_last_sync_time", now);
    }

    return {
      success: true,
      message: `同步完成！已上傳 ${pushed} 筆資料、下載 ${pulled} 筆雲端更新`,
      pushedCount: pushed,
      pulledCount: pulled,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `同步失敗: ${err?.message || err}`,
      pushedCount: pushed,
      pulledCount: pulled,
    };
  }
}

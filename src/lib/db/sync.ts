import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { db } from "./schema";
import type { WorkoutSession, Exercise, SetItem, BigThreeRecord } from "@/lib/types";

let cachedClient: SupabaseClient | null = null;
let cachedUrl = "";
let cachedKey = "";

export function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;

  const url =
    localStorage.getItem("workout_supabase_url") ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const key =
    localStorage.getItem("workout_supabase_key") ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

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
      (typeof window !== "undefined"
        ? localStorage.getItem("workout_supabase_url") || ""
        : "") ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "";
    const key =
      customKey ||
      (typeof window !== "undefined"
        ? localStorage.getItem("workout_supabase_key") || ""
        : "") ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "";

    if (!url || !key) {
      return { ok: false, message: "請先輸入 Project URL 與 Public Anon Key" };
    }

    const testClient = createClient(url, key, { auth: { persistSession: false } });
    // 嘗試查詢 sessions 表 (limit 1)
    const { error } = await testClient.from("sessions").select("id").limit(1);

    if (error) {
      // 若表格尚未建立，但連線認證通過
      if (error.code === "42P01" || error.message.includes("relation") || error.message.includes("does not exist")) {
        return {
          ok: true,
          message: "連線成功！但雲端資料表 (sessions) 尚未建立，可先點擊備份上傳初始化。",
        };
      }
      return { ok: false, message: `連線失敗: ${error.message}` };
    }

    return { ok: true, message: "雲端資料庫連線測試成功！" };
  } catch (e: any) {
    return { ok: false, message: `連線發生錯誤: ${e?.message || e}` };
  }
}

/**
 * 執行雙向同步：
 * 1. 將本機 pending 或 modified 資料上傳 (Upsert) 到 Supabase
 * 2. 下載雲端較新的資料更新至本機 IndexedDB
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
    // 1. 同步 Sessions
    const localSessions = await db.sessions.toArray();
    const pendingSessions = localSessions.filter(
      (s) => s.sync_status === "pending" || !s.sync_status
    );

    if (pendingSessions.length > 0) {
      const { error: pushErr } = await supabase
        .from("sessions")
        .upsert(
          pendingSessions.map((s) => ({ ...s, sync_status: "synced" })),
          { onConflict: "id" }
        );
      if (!pushErr) {
        pushed += pendingSessions.length;
        await db.sessions.bulkPut(
          pendingSessions.map((s) => ({ ...s, sync_status: "synced" }))
        );
      }
    }

    // 2. 同步 Exercises
    const localExercises = await db.exercises.toArray();
    const pendingExercises = localExercises.filter(
      (e) => e.sync_status === "pending" || !e.sync_status
    );

    if (pendingExercises.length > 0) {
      const { error: pushExErr } = await supabase
        .from("exercises")
        .upsert(
          pendingExercises.map((e) => ({ ...e, sync_status: "synced" })),
          { onConflict: "id" }
        );
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
      // 分批處理避免 payload 過大
      const chunkSize = 200;
      for (let i = 0; i < pendingSets.length; i += chunkSize) {
        const chunk = pendingSets.slice(i, i + chunkSize);
        const { error: pushSetErr } = await supabase
          .from("sets")
          .upsert(
            chunk.map((st) => ({ ...st, sync_status: "synced" })),
            { onConflict: "id" }
          );
        if (!pushSetErr) {
          pushed += chunk.length;
          await db.sets.bulkPut(chunk.map((st) => ({ ...st, sync_status: "synced" })));
        }
      }
    }

    // 4. 同步 Big Three
    const localB3 = await db.big_three.toArray();
    if (localB3.length > 0) {
      const { error: b3Err } = await supabase
        .from("big_three")
        .upsert(
          localB3.map((b) => ({ ...b, sync_status: "synced" })),
          { onConflict: "id" }
        );
      if (!b3Err) {
        pushed += localB3.length;
      }
    }

    // 5. 下載雲端更新 (Pull latest)
    const { data: remoteSessions } = await supabase
      .from("sessions")
      .select("*")
      .limit(500);

    if (remoteSessions && remoteSessions.length > 0) {
      for (const rs of remoteSessions) {
        const local = await db.sessions.get(rs.id);
        if (!local || new Date(rs.updated_at) > new Date(local.updated_at)) {
          await db.sessions.put({ ...rs, sync_status: "synced" });
          pulled++;
        }
      }
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

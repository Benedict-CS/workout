import { db } from "./schema";
import seedData from "./seed-data.json";
import bwData from "./bodyweight-data.json";
import inbodyData from "./inbody-data.json";
import { runFullSync } from "./sync";
import type { SetItem } from "@/lib/types";

export const CLEAN_NOV14_SETS: SetItem[] = [
  {
    id: "set-20261114-1",
    session_id: "session-2026-11-14-1794646944321",
    exercise_id: "ex-squat",
    set_order: 1,
    set_type: "warmup",
    weight_kg: 20,
    reps: 12,
    raw_text: "20Kg x12 熱身",
    feedback: "completed",
    created_at: "2026-11-14T08:00:00.000Z",
    updated_at: "2026-11-14T08:00:00.000Z",
    sync_status: "synced",
  },
  {
    id: "set-20261114-2",
    session_id: "session-2026-11-14-1794646944321",
    exercise_id: "ex-squat",
    set_order: 2,
    set_type: "warmup",
    weight_kg: 40,
    reps: 8,
    raw_text: "40Kg x8 熱身",
    feedback: "completed",
    created_at: "2026-11-14T08:02:00.000Z",
    updated_at: "2026-11-14T08:02:00.000Z",
    sync_status: "synced",
  },
  {
    id: "set-20261114-3",
    session_id: "session-2026-11-14-1794646944321",
    exercise_id: "ex-squat",
    set_order: 3,
    set_type: "warmup",
    weight_kg: 60,
    reps: 4,
    raw_text: "60Kg x4 熱身",
    feedback: "completed",
    created_at: "2026-11-14T08:04:00.000Z",
    updated_at: "2026-11-14T08:04:00.000Z",
    sync_status: "synced",
  },
  {
    id: "set-20261114-4",
    session_id: "session-2026-11-14-1794646944321",
    exercise_id: "ex-squat",
    set_order: 4,
    set_type: "warmup",
    weight_kg: 70,
    reps: 2,
    raw_text: "70Kg x2 熱身",
    feedback: "completed",
    created_at: "2026-11-14T08:06:00.000Z",
    updated_at: "2026-11-14T08:06:00.000Z",
    sync_status: "synced",
  },
  {
    id: "set-20261114-5",
    session_id: "session-2026-11-14-1794646944321",
    exercise_id: "ex-squat",
    set_order: 5,
    set_type: "normal",
    weight_kg: 90,
    reps: 8,
    raw_text: "set 1: 90Kg x8",
    feedback: "completed",
    created_at: "2026-11-14T08:09:00.000Z",
    updated_at: "2026-11-14T08:09:00.000Z",
    sync_status: "synced",
  },
  {
    id: "set-20261114-6",
    session_id: "session-2026-11-14-1794646944321",
    exercise_id: "ex-squat",
    set_order: 6,
    set_type: "normal",
    weight_kg: 85,
    reps: 8,
    raw_text: "set 2: 85Kg x8",
    feedback: "completed",
    created_at: "2026-11-14T08:12:00.000Z",
    updated_at: "2026-11-14T08:12:00.000Z",
    sync_status: "synced",
  },
  {
    id: "set-20261114-7",
    session_id: "session-2026-11-14-1794646944321",
    exercise_id: "ex-squat",
    set_order: 7,
    set_type: "normal",
    weight_kg: 80,
    reps: 8,
    raw_text: "set 3: 80Kg x8",
    feedback: "completed",
    created_at: "2026-11-14T08:15:00.000Z",
    updated_at: "2026-11-14T08:15:00.000Z",
    sync_status: "synced",
  },
  {
    id: "set-20261114-8",
    session_id: "session-2026-11-14-1794646944321",
    exercise_id: "ex-squat",
    set_order: 8,
    set_type: "normal",
    weight_kg: 75,
    reps: 8,
    raw_text: "set 4: 75Kg x8",
    feedback: "completed",
    created_at: "2026-11-14T08:18:00.000Z",
    updated_at: "2026-11-14T08:18:00.000Z",
    sync_status: "synced",
  },
  {
    id: "set-20261114-9",
    session_id: "session-2026-11-14-1794646944321",
    exercise_id: "ex-leg-press",
    set_order: 9,
    set_type: "normal",
    weight_kg: 130,
    reps: 12,
    raw_text: "set 1: 130Kg x12",
    feedback: "completed",
    created_at: "2026-11-14T08:22:00.000Z",
    updated_at: "2026-11-14T08:22:00.000Z",
    sync_status: "synced",
  },
  {
    id: "set-20261114-10",
    session_id: "session-2026-11-14-1794646944321",
    exercise_id: "ex-leg-press",
    set_order: 10,
    set_type: "normal",
    weight_kg: 140,
    reps: 12,
    raw_text: "set 2: 140Kg x12",
    feedback: "completed",
    created_at: "2026-11-14T08:25:00.000Z",
    updated_at: "2026-11-14T08:25:00.000Z",
    sync_status: "synced",
  },
  {
    id: "set-20261114-11",
    session_id: "session-2026-11-14-1794646944321",
    exercise_id: "ex-leg-press",
    set_order: 11,
    set_type: "normal",
    weight_kg: 135,
    reps: 10,
    raw_text: "set 3: 135Kg x10",
    feedback: "completed",
    created_at: "2026-11-14T08:28:00.000Z",
    updated_at: "2026-11-14T08:28:00.000Z",
    sync_status: "synced",
  },
  {
    id: "set-20261114-12",
    session_id: "session-2026-11-14-1794646944321",
    exercise_id: "ex-leg-press",
    set_order: 12,
    set_type: "normal",
    weight_kg: 130,
    reps: 10,
    raw_text: "set 4: 130Kg x10",
    feedback: "completed",
    created_at: "2026-11-14T08:31:00.000Z",
    updated_at: "2026-11-14T08:31:00.000Z",
    sync_status: "synced",
  },
  {
    id: "set-20261114-13",
    session_id: "session-2026-11-14-1794646944321",
    exercise_id: "ex-leg-curl",
    set_order: 13,
    set_type: "normal",
    weight_kg: 45,
    reps: 15,
    raw_text: "set 1: 45Kg x15",
    feedback: "completed",
    created_at: "2026-11-14T08:35:00.000Z",
    updated_at: "2026-11-14T08:35:00.000Z",
    sync_status: "synced",
  },
  {
    id: "set-20261114-14",
    session_id: "session-2026-11-14-1794646944321",
    exercise_id: "ex-leg-curl",
    set_order: 14,
    set_type: "normal",
    weight_kg: 40,
    reps: 9,
    raw_text: "set 2: 40Kg x9 + 休 + 40Kg x6",
    sub_fields: [{ mode: "休", weight_kg: 40, reps: 6 }],
    feedback: "completed",
    created_at: "2026-11-14T08:38:00.000Z",
    updated_at: "2026-11-14T08:38:00.000Z",
    sync_status: "synced",
  },
  {
    id: "set-20261114-15",
    session_id: "session-2026-11-14-1794646944321",
    exercise_id: "ex-leg-curl",
    set_order: 15,
    set_type: "normal",
    weight_kg: 40,
    reps: 10,
    raw_text: "set 3: 40Kg x10 + 休 + 40Kg x5",
    sub_fields: [{ mode: "休", weight_kg: 40, reps: 5 }],
    feedback: "completed",
    created_at: "2026-11-14T08:41:00.000Z",
    updated_at: "2026-11-14T08:41:00.000Z",
    sync_status: "synced",
  },
  {
    id: "set-20261114-16",
    session_id: "session-2026-11-14-1794646944321",
    exercise_id: "ex-leg-curl",
    set_order: 16,
    set_type: "normal",
    weight_kg: 40,
    reps: 8,
    raw_text: "set 4: 40Kg x8 + 休 + 40Kg x6",
    sub_fields: [{ mode: "休", weight_kg: 40, reps: 6 }],
    feedback: "completed",
    created_at: "2026-11-14T08:44:00.000Z",
    updated_at: "2026-11-14T08:44:00.000Z",
    sync_status: "synced",
  },
  // 啞鈴側平舉
  {
    id: "set-20261114-17",
    session_id: "session-2026-11-14-1794646944321",
    exercise_id: "ex-db-lateral-raise",
    set_order: 17,
    set_type: "normal",
    weight_kg: 5,
    reps: 15,
    raw_text: "set 1: 5Kg x15 (輕鬆)",
    notes: "輕鬆",
    feedback: "completed",
    created_at: "2026-11-14T08:48:00.000Z",
    updated_at: "2026-11-14T08:48:00.000Z",
    sync_status: "synced",
  },
  {
    id: "set-20261114-18",
    session_id: "session-2026-11-14-1794646944321",
    exercise_id: "ex-db-lateral-raise",
    set_order: 18,
    set_type: "normal",
    weight_kg: 7.5,
    reps: 15,
    raw_text: "set 2: 7.5Kg x15 (最後幾下有一點點難)",
    notes: "最後幾下有一點點難",
    feedback: "completed",
    created_at: "2026-11-14T08:51:00.000Z",
    updated_at: "2026-11-14T08:51:00.000Z",
    sync_status: "synced",
  },
  {
    id: "set-20261114-19",
    session_id: "session-2026-11-14-1794646944321",
    exercise_id: "ex-db-lateral-raise",
    set_order: 19,
    set_type: "normal",
    weight_kg: 5,
    reps: 15,
    raw_text: "set 3: 5Kg x15 (輕鬆)",
    notes: "輕鬆",
    feedback: "completed",
    created_at: "2026-11-14T08:54:00.000Z",
    updated_at: "2026-11-14T08:54:00.000Z",
    sync_status: "synced",
  },
  {
    id: "set-20261114-20",
    session_id: "session-2026-11-14-1794646944321",
    exercise_id: "ex-db-lateral-raise",
    set_order: 20,
    set_type: "normal",
    weight_kg: 5,
    reps: 15,
    raw_text: "set 4: 5Kg x15 (輕鬆)",
    notes: "輕鬆",
    feedback: "completed",
    created_at: "2026-11-14T08:57:00.000Z",
    updated_at: "2026-11-14T08:57:00.000Z",
    sync_status: "synced",
  },
  {
    id: "set-20261114-21",
    session_id: "session-2026-11-14-1794646944321",
    exercise_id: "ex-db-lateral-raise",
    set_order: 21,
    set_type: "normal",
    weight_kg: 5,
    reps: 15,
    raw_text: "set 5: 5Kg x15 (輕鬆)",
    notes: "輕鬆",
    feedback: "completed",
    created_at: "2026-11-14T09:00:00.000Z",
    updated_at: "2026-11-14T09:00:00.000Z",
    sync_status: "synced",
  },
];

export async function ensureDatabaseSeeded(): Promise<void> {
  const existingExercises = await db.exercises.toArray();
  const sessionCount = await db.sessions.count();
  const hasSwimSession = (await db.sessions.where("target_muscle").equals("游泳").count()) > 0;

  // 檢查並清理歷史舊版 session-swim-* 幽靈資料與重複訓練
  const legacySwims = await db.sessions.filter((s) => s.id.startsWith("session-swim-")).toArray();
  if (legacySwims.length > 0) {
    const legIds = legacySwims.map((s) => s.id);
    await db.sessions.bulkDelete(legIds);
    const legSets = await db.sets.filter((st) => legIds.includes(st.session_id)).toArray();
    if (legSets.length > 0) {
      await db.sets.bulkDelete(legSets.map((s) => s.id));
    }
  }

  const updatedSessionCount = await db.sessions.count();
  const currentSetCount = await db.sets.count();
  const currentSwimCount = await db.sessions.where("target_muscle").equals("游泳").count();
  const pullupSetCount = await db.sets.where("exercise_id").equals("ex-pullup").count();
  const hasOldNovSession = (await db.sessions.where("id").equals("session-2026-11-10-1").count()) > 0;

  // 若尚未初始化，或場次不完整 (全庫 102 場 / 22 場游泳) / 組數不完整 (全庫共 1503 組) / 引體向上組數缺漏 / 舊版 session ID 不匹配，則自動更新為 100% 完整歷史資料
  if (
    updatedSessionCount === 0 ||
    updatedSessionCount < seedData.sessions.length ||
    currentSwimCount < 22 ||
    currentSetCount < seedData.sets.length ||
    pullupSetCount < 80 ||
    hasOldNovSession ||
    !hasSwimSession
  ) {
    console.log("Seeding / Migrating to 100% complete full-history exercises & sets (including all pull-ups)...");

    await db.transaction("rw", [db.sessions, db.exercises, db.sets, db.big_three], async () => {
      const userCustomExercises = existingExercises.filter(
        (e) => !e.id.startsWith("ex-")
      );

      await db.exercises.clear();
      await db.exercises.bulkPut(seedData.exercises as any);
      if (userCustomExercises.length > 0) {
        await db.exercises.bulkPut(userCustomExercises);
      }

      await db.sets.clear();
      await db.sessions.clear();
      await db.big_three.clear();

      if (seedData.bigThree) {
        await db.big_three.put(seedData.bigThree as any);
      }
      if (seedData.sessions?.length) {
        await db.sessions.bulkPut(seedData.sessions as any);
      }
      if (seedData.sets?.length) {
        await db.sets.bulkPut(seedData.sets as any);
      }
    });

    console.log("Database curated successfully!");
  }

  // 檢查並載入歷史體重數據 (OKOK 93 筆晨起空腹未穿衣量測)
  const bwCount = await db.body_weight.count();
  if (bwCount < bwData.length) {
    const formattedBw = bwData.map((b: any) => ({
      ...b,
      created_at: b.created_at || `${b.date}T08:00:00.000Z`,
      updated_at: b.updated_at || `${b.date}T08:00:00.000Z`,
      sync_status: "synced" as const,
    }));
    await db.body_weight.bulkPut(formattedBw as any);
  }

  // 檢查並載入 InBody 里程碑身體組成檢測 (17 次多頻電極實測)
  const inbodyCount = await db.inbody_records.count();
  const hasBogusInbody = (await db.inbody_records.filter((ib) => ib.date === "2026-08-02" || ib.date === "2026-08-21").count()) > 0;
  if (inbodyCount < inbodyData.length || hasBogusInbody) {
    await db.inbody_records.clear();
    const formattedInbody = inbodyData.map((ib: any) => ({
      ...ib,
      created_at: ib.created_at || `${ib.date}T${ib.time || "12:00"}:00.000Z`,
      updated_at: ib.updated_at || `${ib.date}T${ib.time || "12:00"}:00.000Z`,
      sync_status: "synced" as const,
    }));
    await db.inbody_records.bulkPut(formattedInbody as any);
  }

  // 檢查並補齊缺失的游泳或歷史訓練場次 (確保本地全庫 102 場 / 22 場游泳 100% 齊全)
  const allCurSessions = await db.sessions.toArray();
  const allCurIds = new Set(allCurSessions.map((s) => s.id));
  const missingCurated = (seedData.sessions as any[]).filter((s) => !allCurIds.has(s.id));
  if (missingCurated.length > 0) {
    console.log(`Injecting ${missingCurated.length} missing sessions from seedData...`);
    await db.sessions.bulkPut(missingCurated);
  }

  // 檢查並徹底清理 11/14 今日訓練組數污染 (41 組 -> 正確乾淨 21 組)
  const nov14Sessions = await db.sessions.filter((s) => s.date === "2026-11-14").toArray();
  for (const sess of nov14Sessions) {
    const curSets = await db.sets.where("session_id").equals(sess.id).toArray();
    const isCorrupted = curSets.length !== 21 || curSets.some((s) => !s.id.startsWith("set-20261114-"));
    if (isCorrupted) {
      console.log("Client has corrupted 11/14 sets. Repairing now to exact 21 sets...");
      await db.sets.where("session_id").equals(sess.id).delete();
      const updatedCleanSets = CLEAN_NOV14_SETS.map((st) => ({ ...st, session_id: sess.id }));
      await db.sets.bulkPut(updatedCleanSets as any);
    }
    if (sess.target_muscle !== "腿" || sess.display_title !== "11/14 (腿) - 交大健身房 - 第 10 次") {
      await db.sessions.update(sess.id, {
        display_title: "11/14 (腿) - 交大健身房 - 第 10 次",
        target_muscle: "腿",
      });
    }
  }

  // 檢查並標準化所有訓練場次標題與主要部位 (胸/背/腿/肩/游泳，去除贅字贅詞如「+ 三頭」、「+ 後肩」)
  const allSessionsToClean = await db.sessions.toArray();
  for (const s of allSessionsToClean) {
    let cleanTarget = "胸";
    if (s.target_muscle.includes("胸") || s.display_title.includes("胸")) cleanTarget = "胸";
    else if (s.target_muscle.includes("背") || s.display_title.includes("背")) cleanTarget = "背";
    else if (s.target_muscle.includes("腿") || s.display_title.includes("腿")) cleanTarget = "腿";
    else if (s.target_muscle.includes("肩") || s.display_title.includes("肩")) cleanTarget = "肩";
    else if (s.target_muscle.includes("泳") || s.display_title.includes("泳")) cleanTarget = "游泳";

    const cleanTitle = s.display_title.replace(/\(([^)]+)\)/, `(${cleanTarget})`);
    if (cleanTitle !== s.display_title || cleanTarget !== s.target_muscle) {
      await db.sessions.update(s.id, {
        display_title: cleanTitle,
        target_muscle: cleanTarget,
      });
    }
  }

  // 嘗試在背景與 Supabase 雙向同步 (確保手機與電腦資料一致)
  if (typeof window !== "undefined") {
    runFullSync().catch((err) => console.log("Background sync info:", err));
  }
}

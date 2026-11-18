import { db } from "./schema";
import seedData from "./seed-data.json";
import bwData from "./bodyweight-data.json";
import inbodyData from "./inbody-data.json";
import type { SetItem } from "@/lib/types";

export const CLEAN_NOV14_SETS: SetItem[] = [
  {
    id: "set-1794661032754-0",
    session_id: "session-2026-11-14-1794661032737",
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
    id: "set-1794661032754-1",
    session_id: "session-2026-11-14-1794661032737",
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
    id: "set-1794661032754-2",
    session_id: "session-2026-11-14-1794661032737",
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
    id: "set-1794661032754-3",
    session_id: "session-2026-11-14-1794661032737",
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
    id: "set-1794661032754-4",
    session_id: "session-2026-11-14-1794661032737",
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
    id: "set-1794661032754-5",
    session_id: "session-2026-11-14-1794661032737",
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
    id: "set-1794661032754-6",
    session_id: "session-2026-11-14-1794661032737",
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
    id: "set-1794661032754-7",
    session_id: "session-2026-11-14-1794661032737",
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
    id: "set-1794661032754-8",
    session_id: "session-2026-11-14-1794661032737",
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
    id: "set-1794661032754-9",
    session_id: "session-2026-11-14-1794661032737",
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
    id: "set-1794661032754-10",
    session_id: "session-2026-11-14-1794661032737",
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
    id: "set-1794661032754-11",
    session_id: "session-2026-11-14-1794661032737",
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
    id: "set-1794661032754-12",
    session_id: "session-2026-11-14-1794661032737",
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
    id: "set-1794661032754-13",
    session_id: "session-2026-11-14-1794661032737",
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
    id: "set-1794661032754-14",
    session_id: "session-2026-11-14-1794661032737",
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
    id: "set-1794661032754-15",
    session_id: "session-2026-11-14-1794661032737",
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
  {
    id: "set-1794661032754-16",
    session_id: "session-2026-11-14-1794661032737",
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
    id: "set-1794661032754-17",
    session_id: "session-2026-11-14-1794661032737",
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
    id: "set-1794661032754-18",
    session_id: "session-2026-11-14-1794661032737",
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
    id: "set-1794661032754-19",
    session_id: "session-2026-11-14-1794661032737",
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
    id: "set-1794661032754-20",
    session_id: "session-2026-11-14-1794661032737",
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

  // 舊版重複動作 ID 映射至 Canonical 標準 ID
  const LEGACY_ID_MAP: Record<string, string> = {
    "ex-bench-press": "ex-bench",
    "ex-flat-dumbbell": "ex-db-bench",
    "ex-db-flat-press": "ex-db-bench",
    "ex-flat-dumbbell-press": "ex-db-bench",
    "ex-incline-dumbbell": "ex-db-incline-bench",
    "ex-incline-db-press": "ex-db-incline-bench",
    "ex-incline-barbell-press": "ex-incline-bench",
    "ex-db-row": "ex-db-single-row",
    "ex-one-arm-dumbbell-row": "ex-db-single-row",
    "ex-pec-deck": "ex-pec-fly",
    "ex-machine-incline-press": "ex-incline-machine-bench",
    "ex-chest-press": "ex-chest-press-seated",
    "ex-seated-row-machine": "ex-seated-row",
    "ex-tricep-press-chest": "ex-dip-pushdown-machine",
    "ex-hex-deadlift": "ex-trap-bar-deadlift",
    "ex-lat-row-machine": "ex-high-row",
    "ex-seated-back-row-machine": "ex-seated-cable-row",
    "ex-lying-leg-curl": "ex-leg-curl",
    "ex-bulgarian-split-squat": "ex-bulgarian-squat",
    "ex-dumbbell-shoulder-press": "ex-db-shoulder-press",
    "ex-face-pull": "ex-cable-face-pull",
    "ex-reverse-pec-deck": "ex-reverse-pec-fly",
    "ex-rope-tricep-pushdown": "ex-rope-tricep",
    "ex-dumbbell-hammer-curl": "ex-db-hammer-curl",
    "ex-incline-dumbbell-curl": "ex-incline-db-curl",
  };

  // 清除本地重複的舊版動作並將組數遷移至標準動作 ID
  const legacyExIds = Object.keys(LEGACY_ID_MAP);
  const foundLegacyEx = await db.exercises.filter((e) => legacyExIds.includes(e.id)).toArray();
  if (foundLegacyEx.length > 0) {
    const toDeleteIds = foundLegacyEx.map((e) => e.id);
    for (const legEx of foundLegacyEx) {
      if (legEx.is_favorite) {
        const canonicalId = LEGACY_ID_MAP[legEx.id];
        if (canonicalId) {
          await db.exercises.update(canonicalId, { is_favorite: true });
        }
      }
    }
    await db.exercises.bulkDelete(toDeleteIds);
  }

  // 檢查是否有組數指向 legacyExIds
  const setsWithLegacyEx = await db.sets.filter((s) => legacyExIds.includes(s.exercise_id)).toArray();
  if (setsWithLegacyEx.length > 0) {
    for (const s of setsWithLegacyEx) {
      const canonicalId = LEGACY_ID_MAP[s.exercise_id];
      if (canonicalId) {
        await db.sets.update(s.id, { exercise_id: canonicalId });
      }
    }
  }

  // 確保核心動作皆有最愛星號標記
  const keyFavIds = ["ex-bench", "ex-db-bench", "ex-db-incline-bench", "ex-squat", "ex-deadlift", "ex-pullup", "ex-leg-press"];
  for (const kf of keyFavIds) {
    const ex = await db.exercises.get(kf);
    if (ex && !ex.is_favorite) {
      await db.exercises.update(kf, { is_favorite: true });
    }
  }

  const updatedSessionCount = await db.sessions.count();
  const currentSetCount = await db.sets.count();

  // ⭐ 僅在資料庫為空（初次載入）時初始化 seedData，並強制標記 sync_status: "synced"，防止全表重推！
  if (updatedSessionCount === 0 || currentSetCount === 0) {
    console.log("Seeding initial full-history exercises & sets...");

    await db.transaction("rw", [db.sessions, db.exercises, db.sets, db.big_three], async () => {
      const userCustomExercises = existingExercises.filter(
        (e) => !e.id.startsWith("ex-")
      );

      await db.exercises.clear();
      await db.exercises.bulkPut(
        (seedData.exercises as any[]).map((e) => ({ ...e, sync_status: "synced" }))
      );
      if (userCustomExercises.length > 0) {
        await db.exercises.bulkPut(userCustomExercises);
      }

      await db.sets.clear();
      await db.sessions.clear();
      await db.big_three.clear();

      if (seedData.bigThree) {
        await db.big_three.put({ ...(seedData.bigThree as any), sync_status: "synced" });
      }
      if (seedData.sessions?.length) {
        await db.sessions.bulkPut(
          (seedData.sessions as any[]).map((s) => ({ ...s, sync_status: "synced" }))
        );
      }
      if (seedData.sets?.length) {
        await db.sets.bulkPut(
          (seedData.sets as any[]).map((st) => ({ ...st, sync_status: "synced" }))
        );
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
  const hasOutdatedCondition = (await db.inbody_records.filter((ib) => {
    if (!ib.condition_label) return true;
    if (ib.condition_label.includes("穿衣") || ib.condition_label.includes("中午飯後")) return true;
    const [h] = (ib.time || "12:00").split(":").map(Number);
    if ((h || 0) < 10 && ib.condition_label !== "早晨空腹 (未吃早餐)") return true;
    return false;
  }).count()) > 0;

  if (inbodyCount < inbodyData.length || hasBogusInbody || hasOutdatedCondition) {
    await db.inbody_records.clear();
    const formattedInbody = inbodyData.map((ib: any) => ({
      ...ib,
      created_at: ib.created_at || `${ib.date}T${ib.time || "12:00"}:00.000Z`,
      updated_at: ib.updated_at || `${ib.date}T${ib.time || "12:00"}:00.000Z`,
      sync_status: "synced" as const,
    }));
    await db.inbody_records.bulkPut(formattedInbody as any);
  }

  // 檢查並強制復原所有 22 場游泳訓練（確保 deleted_at = null，永不消失）
  const swimSessionsInSeed = (seedData.sessions as any[]).filter(
    (s) => s.target_muscle === "游泳" || s.display_title.includes("泳")
  );
  for (const sw of swimSessionsInSeed) {
    const existing = await db.sessions.get(sw.id);
    if (!existing || existing.deleted_at !== null || existing.target_muscle !== "游泳") {
      await db.sessions.put({
        ...sw,
        target_muscle: "游泳",
        deleted_at: null,
        sync_status: "synced",
      });
    }
  }

  // 檢查並補齊缺失的歷史訓練場次 (強制標記 sync_status: "synced")
  const allCurSessions = await db.sessions.toArray();
  const allCurIds = new Set(allCurSessions.map((s) => s.id));
  const missingCurated = (seedData.sessions as any[]).filter((s) => !allCurIds.has(s.id));
  if (missingCurated.length > 0) {
    console.log(`Injecting ${missingCurated.length} missing sessions from seedData...`);
    await db.sessions.bulkPut(
      missingCurated.map((s) => ({ ...s, sync_status: "synced" }))
    );
  }

  // 強制清除本地所有 InBody 舊版「(穿衣)」與未吃/午餐錯誤標籤 (以 10:00 與 13:00 為界)
  try {
    const allIb = await db.inbody_records.toArray();
    for (const ib of allIb) {
      if (!ib) continue;
      const timeStr = typeof ib.time === "string" ? ib.time : "12:00";
      const parts = timeStr.split(":");
      let h = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);
      if (isNaN(h)) h = 12;
      if (isNaN(m)) m = 0;
      const totalM = h * 60 + m;

      let newTiming: "morning_fasting" | "before_lunch" | "after_lunch";
      let newCond: string;
      if (totalM < 10 * 60) {
        newTiming = "morning_fasting";
        newCond = "早晨空腹 (未吃早餐)";
      } else if (totalM < 13 * 60) {
        newTiming = "before_lunch";
        newCond = "午餐前 (僅吃早餐)";
      } else {
        newTiming = "after_lunch";
        newCond = "午餐後 (已吃午餐)";
      }
      if (ib.condition_label !== newCond || ib.timing !== newTiming) {
        await db.inbody_records.update(ib.id, {
          timing: newTiming,
          condition_label: newCond,
        });
      }
    }
  } catch (err) {
    console.warn("InBody records sanitization skipped:", err);
  }

  // 檢查並徹底清理 11/14 今日訓練組數污染 (若組數大於 21 組，才執行清理)
  try {
    const nov14Sessions = await db.sessions.filter((s) => s.date === "2026-11-14").toArray();
    for (const sess of nov14Sessions) {
      if (!sess) continue;
      const curSets = await db.sets.where("session_id").equals(sess.id).toArray();
      const isCorrupted = curSets.length > 21;
      if (isCorrupted) {
        console.log("Client has corrupted 11/14 sets. Repairing now to exact 21 sets...");
        await db.sets.where("session_id").equals(sess.id).delete();
        const updatedCleanSets = CLEAN_NOV14_SETS.map((st) => ({ ...st, session_id: sess.id }));
        await db.sets.bulkPut(updatedCleanSets as any);
      }
      if (sess.target_muscle !== "腿" || sess.display_title !== "11/14 (腿) - 交大健身房 - 第 10 次" || sess.monthly_index !== 10) {
        await db.sessions.update(sess.id, {
          display_title: "11/14 (腿) - 交大健身房 - 第 10 次",
          target_muscle: "腿",
          monthly_index: 10,
        });
      }
    }
  } catch (err) {
    console.warn("Nov 14 session check skipped:", err);
  }

  // 檢查並校準 11 月訓練序號（游泳不計入重訓次數，11/14 第10次、11/16 第11次、11/17 第12次）
  try {
    const novSessions = await db.sessions
      .filter((s) => !s.deleted_at && (s.month_key === "2026-11" || (s.date && s.date.startsWith("2026-11"))))
      .toArray();

    for (const sess of novSessions) {
      if (sess.date === "2026-11-14" && (sess.monthly_index !== 10 || sess.display_title !== "11/14 (腿) - 交大健身房 - 第 10 次")) {
        await db.sessions.update(sess.id, {
          monthly_index: 10,
          display_title: "11/14 (腿) - 交大健身房 - 第 10 次",
        });
      }
      if (sess.date === "2026-11-16" && (sess.monthly_index !== 11 || sess.display_title !== "11/16 (背) - 三健客 - 第 11 次")) {
        await db.sessions.update(sess.id, {
          monthly_index: 11,
          display_title: "11/16 (背) - 三健客 - 第 11 次",
        });
      }
      if (sess.date === "2026-11-17" && (sess.monthly_index !== 12 || sess.display_title !== "11/17 (胸) - 三健客 - 第 12 次")) {
        await db.sessions.update(sess.id, {
          monthly_index: 12,
          display_title: "11/17 (胸) - 三健客 - 第 12 次",
        });
      }
    }
  } catch (err) {
    console.warn("Nov session sequence check skipped:", err);
  }

  // 檢查並標準化所有訓練場次標題與主要部位 (胸/背/腿/肩/游泳，去除贅字贅詞如「+ 三頭」、「+ 後肩」)
  try {
    const allSessionsToClean = await db.sessions.toArray();
    for (const s of allSessionsToClean) {
      if (!s) continue;
      const rawTarget = s.target_muscle || "";
      const rawTitle = s.display_title || "";
      let cleanTarget = rawTarget;
      if (rawTarget.includes("胸") || rawTitle.includes("胸")) cleanTarget = "胸";
      else if (rawTarget.includes("背") || rawTitle.includes("背")) cleanTarget = "背";
      else if (rawTarget.includes("腿") || rawTitle.includes("腿")) cleanTarget = "腿";
      else if (rawTarget.includes("肩") || rawTitle.includes("肩")) cleanTarget = "肩";
      else if (rawTarget.includes("泳") || rawTitle.includes("泳")) cleanTarget = "游泳";

      const cleanTitle = rawTitle.includes("(") ? rawTitle.replace(/\(([^)]+)\)/, `(${cleanTarget})`) : rawTitle;
      if (cleanTitle !== s.display_title || cleanTarget !== s.target_muscle) {
        await db.sessions.update(s.id, {
          display_title: cleanTitle,
          target_muscle: cleanTarget,
        });
      }
    }
  } catch (err) {
    console.warn("Session title normalization skipped:", err);
  }

  // ⭐ 同步交由 AutoSyncManager 統一透過 5 分鐘冷卻機制管控，不觸發重複事件
}

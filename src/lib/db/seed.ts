import { db } from "./schema";
import seedData from "./seed-data.json";
import bwData from "./bodyweight-data.json";
import inbodyData from "./inbody-data.json";
import type { SetItem } from "@/lib/types";

const nov14Rows: Array<[string, number, number, string, string?, string?]> = [
  ["ex-squat", 20, 12, "20Kg x12 熱身"], ["ex-squat", 40, 8, "40Kg x8 熱身"],
  ["ex-squat", 60, 4, "60Kg x4 熱身"], ["ex-squat", 70, 2, "70Kg x2 熱身"],
  ["ex-squat", 90, 8, "set 1: 90Kg x8"], ["ex-squat", 85, 8, "set 2: 85Kg x8"],
  ["ex-squat", 80, 8, "set 3: 80Kg x8"], ["ex-squat", 75, 8, "set 4: 75Kg x8"],
  ["ex-leg-press", 130, 12, "set 1: 130Kg x12"], ["ex-leg-press", 140, 12, "set 2: 140Kg x12"],
  ["ex-leg-press", 135, 10, "set 3: 135Kg x10"], ["ex-leg-press", 130, 10, "set 4: 130Kg x10"],
  ["ex-leg-curl", 45, 15, "set 1: 45Kg x15"],
  ["ex-leg-curl", 40, 9, "set 2: 40Kg x9 + 休 + 40Kg x6", undefined, "休"],
  ["ex-leg-curl", 40, 10, "set 3: 40Kg x10 + 休 + 40Kg x5", undefined, "休"],
  ["ex-leg-curl", 40, 8, "set 4: 40Kg x8 + 休 + 40Kg x6", undefined, "休"],
  ["ex-db-lateral-raise", 5, 15, "set 1: 5Kg x15 (輕鬆)", "輕鬆"],
  ["ex-db-lateral-raise", 7.5, 15, "set 2: 7.5Kg x15 (最後幾下有一點點難)", "最後幾下有一點點難"],
  ["ex-db-lateral-raise", 5, 15, "set 3: 5Kg x15 (輕鬆)", "輕鬆"],
  ["ex-db-lateral-raise", 5, 15, "set 4: 5Kg x15 (輕鬆)", "輕鬆"],
  ["ex-db-lateral-raise", 5, 15, "set 5: 5Kg x15 (輕鬆)", "輕鬆"],
];

export const CLEAN_NOV14_SETS: SetItem[] = nov14Rows.map(([exercise_id, weight_kg, reps, raw_text, notes, mode], index) => ({
  id: `set-1794661032754-${index}`,
  session_id: "session-2026-11-14-1794661032737",
  exercise_id,
  set_order: index + 1,
  set_type: index < 4 ? "warmup" : "normal",
  weight_kg,
  reps,
  raw_text,
  ...(notes ? { notes } : {}),
  ...(mode ? { sub_fields: [{ mode, weight_kg, reps: index === 13 ? 6 : 5 }] } : {}),
  feedback: "completed",
  created_at: `2026-11-14T${["08:00","08:02","08:04","08:06","08:09","08:12","08:15","08:18","08:22","08:25","08:28","08:31","08:35","08:38","08:41","08:44","08:48","08:51","08:54","08:57","09:00"][index]}:00.000Z`,
  updated_at: `2026-11-14T${["08:00","08:02","08:04","08:06","08:09","08:12","08:15","08:18","08:22","08:25","08:28","08:31","08:35","08:38","08:41","08:44","08:48","08:51","08:54","08:57","09:00"][index]}:00.000Z`,
  sync_status: "synced",
} as SetItem));

export async function ensureDatabaseSeeded(): Promise<void> {
  const existingExercises = await db.exercises.toArray();
  const legacySwims = await db.sessions.filter((s) => s.id.startsWith("session-swim-")).toArray();
  if (legacySwims.length) {
    const ids = legacySwims.map((s) => s.id);
    await db.sessions.bulkDelete(ids);
    const sets = await db.sets.filter((s) => ids.includes(s.session_id)).toArray();
    if (sets.length) await db.sets.bulkDelete(sets.map((s) => s.id));
  }

  const legacyIdMap: Record<string, string> = {
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
  const legacyIds = Object.keys(legacyIdMap);
  const oldExercises = await db.exercises.filter((e) => legacyIds.includes(e.id)).toArray();
  for (const ex of oldExercises) {
    const canonical = legacyIdMap[ex.id];
    if (ex.is_favorite && canonical) await db.exercises.update(canonical, { is_favorite: true });
  }
  if (oldExercises.length) await db.exercises.bulkDelete(oldExercises.map((e) => e.id));
  const oldSets = await db.sets.filter((s) => legacyIds.includes(s.exercise_id)).toArray();
  for (const set of oldSets) {
    const canonical = legacyIdMap[set.exercise_id];
    if (canonical) await db.sets.update(set.id, { exercise_id: canonical });
  }

  for (const id of ["ex-bench", "ex-db-bench", "ex-db-incline-bench", "ex-squat", "ex-deadlift", "ex-pullup", "ex-leg-press"]) {
    const ex = await db.exercises.get(id);
    if (ex && !ex.is_favorite) await db.exercises.update(id, { is_favorite: true });
  }

  const sessionCount = await db.sessions.count();
  const setCount = await db.sets.count();
  if (sessionCount === 0 || setCount === 0) {
    await db.transaction("rw", [db.sessions, db.exercises, db.sets, db.big_three], async () => {
      const customExercises = existingExercises.filter((e) => !e.id.startsWith("ex-"));
      await db.exercises.clear();
      await db.exercises.bulkPut((seedData.exercises as any[]).map((e) => ({ ...e, sync_status: "synced" })));
      if (customExercises.length) await db.exercises.bulkPut(customExercises);
      await db.sets.clear();
      await db.sessions.clear();
      await db.big_three.clear();
      if (seedData.bigThree) await db.big_three.put({ ...(seedData.bigThree as any), sync_status: "synced" });
      if (seedData.sessions?.length) await db.sessions.bulkPut((seedData.sessions as any[]).map((s) => ({ ...s, sync_status: "synced" })));
      if (seedData.sets?.length) await db.sets.bulkPut((seedData.sets as any[]).map((s) => ({ ...s, sync_status: "synced" })));
    });
  }

  const bwCount = await db.body_weight.count();
  if (bwCount < bwData.length) {
    await db.body_weight.bulkPut(bwData.map((b: any) => ({
      ...b, created_at: b.created_at || `${b.date}T08:00:00.000Z`,
      updated_at: b.updated_at || `${b.date}T08:00:00.000Z`, sync_status: "synced" as const,
    })) as any);
  }

  const inbodyCount = await db.inbody_records.count();
  const hasBogusInbody = await db.inbody_records.filter((ib) => ib.date === "2026-08-02" || ib.date === "2026-08-21").count() > 0;
  const hasOutdatedCondition = await db.inbody_records.filter((ib) => {
    if (!ib.condition_label || ib.condition_label.includes("穿衣") || ib.condition_label.includes("中午飯後")) return true;
    const [hour] = (ib.time || "12:00").split(":").map(Number);
    return (hour || 0) < 10 && ib.condition_label !== "早晨空腹 (未吃早餐)";
  }).count() > 0;
  if (inbodyCount < inbodyData.length || hasBogusInbody || hasOutdatedCondition) {
    await db.inbody_records.clear();
    await db.inbody_records.bulkPut(inbodyData.map((ib: any) => ({
      ...ib, created_at: ib.created_at || `${ib.date}T${ib.time || "12:00"}:00.000Z`,
      updated_at: ib.updated_at || `${ib.date}T${ib.time || "12:00"}:00.000Z`, sync_status: "synced" as const,
    })) as any);
  }

  const swimSeeds = (seedData.sessions as any[]).filter((s) => s.target_muscle === "游泳" || s.display_title.includes("泳"));
  for (const swim of swimSeeds) {
    const existing = await db.sessions.get(swim.id);
    if (!existing || existing.deleted_at !== null || existing.target_muscle !== "游泳") {
      await db.sessions.put({ ...swim, target_muscle: "游泳", deleted_at: null, sync_status: "synced" });
    }
  }

  const currentSessions = await db.sessions.toArray();
  const currentIds = new Set(currentSessions.map((s) => s.id));
  const missingSessions = (seedData.sessions as any[]).filter((s) => !currentIds.has(s.id));
  if (missingSessions.length) {
    await db.sessions.bulkPut(missingSessions.map((s) => ({ ...s, sync_status: "synced" })));
  }

  try {
    for (const ib of await db.inbody_records.toArray()) {
      const [hPart, mPart] = (typeof ib.time === "string" ? ib.time : "12:00").split(":");
      const h = Number.parseInt(hPart, 10) || 12;
      const m = Number.parseInt(mPart, 10) || 0;
      const total = h * 60 + m;
      const timing = total < 600 ? "morning_fasting" : total < 780 ? "before_lunch" : "after_lunch";
      const label = total < 600 ? "早晨空腹 (未吃早餐)" : total < 780 ? "午餐前 (僅吃早餐)" : "午餐後 (已吃午餐)";
      if (ib.condition_label !== label || ib.timing !== timing) await db.inbody_records.update(ib.id, { timing, condition_label: label });
    }
  } catch (err) { console.warn("InBody records sanitization skipped:", err); }

  try {
    for (const session of await db.sessions.filter((s) => s.date === "2026-11-14").toArray()) {
      const sets = await db.sets.where("session_id").equals(session.id).toArray();
      if (sets.length > 21) {
        await db.sets.where("session_id").equals(session.id).delete();
        await db.sets.bulkPut(CLEAN_NOV14_SETS.map((s) => ({ ...s, session_id: session.id })) as any);
      }
      if (session.target_muscle !== "腿" || session.display_title !== "11/14 (腿) - 交大健身房 - 第 10 次" || session.monthly_index !== 10) {
        await db.sessions.update(session.id, { display_title: "11/14 (腿) - 交大健身房 - 第 10 次", target_muscle: "腿", monthly_index: 10 });
      }
    }
  } catch (err) { console.warn("Nov 14 session check skipped:", err); }

  try {
    const novemberSessions = await db.sessions.filter((s) => !s.deleted_at && (s.month_key === "2026-11" || (typeof s.date === "string" && s.date.startsWith("2026-11")))).toArray();
    for (const session of novemberSessions) {
      if (session.date === "2026-11-14" && (session.monthly_index !== 10 || session.display_title !== "11/14 (腿) - 交大健身房 - 第 10 次")) {
        await db.sessions.update(session.id, { monthly_index: 10, display_title: "11/14 (腿) - 交大健身房 - 第 10 次" });
      }
      if (session.date === "2026-11-16" && (session.monthly_index !== 11 || session.display_title !== "11/16 (背) - 三健客 - 第 11 次")) {
        await db.sessions.update(session.id, { monthly_index: 11, display_title: "11/16 (背) - 三健客 - 第 11 次" });
      }
      if (session.date === "2026-11-17" && (session.monthly_index !== 12 || session.display_title !== "11/17 (胸) - 三健客 - 第 12 次")) {
        await db.sessions.update(session.id, { monthly_index: 12, display_title: "11/17 (胸) - 三健客 - 第 12 次" });
      }
    }
  } catch (err) { console.warn("Nov session sequence check skipped:", err); }

  try {
    for (const session of await db.sessions.toArray()) {
      const rawTarget = session.target_muscle || "";
      const rawTitle = session.display_title || "";
      let target = rawTarget;
      if (rawTarget.includes("胸") || rawTitle.includes("胸")) target = "胸";
      else if (rawTarget.includes("背") || rawTitle.includes("背")) target = "背";
      else if (rawTarget.includes("腿") || rawTitle.includes("腿")) target = "腿";
      else if (rawTarget.includes("肩") || rawTitle.includes("肩")) target = "肩";
      else if (rawTarget.includes("泳") || rawTitle.includes("泳")) target = "游泳";
      const title = rawTitle.includes("(") ? rawTitle.replace(/\(([^)]+)\)/, `(${target})`) : rawTitle;
      if (title !== session.display_title || target !== session.target_muscle) {
        await db.sessions.update(session.id, { display_title: title, target_muscle: target });
      }
    }
  } catch (err) { console.warn("Session title normalization skipped:", err); }
}

import { db } from "./schema";
import type {
  Exercise,
  SetItem,
  WorkoutSession,
  BigThreeRecord,
} from "@/lib/types";

export async function getRecentSessions(limit = 30): Promise<WorkoutSession[]> {
  const all = await db.sessions
    .filter((s) => !s.deleted_at)
    .sortBy("date");
  return all.reverse().slice(0, limit);
}

export async function getSessionById(id: string): Promise<WorkoutSession | undefined> {
  return await db.sessions.get(id);
}

export async function getSessionSets(sessionId: string): Promise<SetItem[]> {
  return await db.sets
    .where("session_id")
    .equals(sessionId)
    .filter((s) => !s.deleted_at)
    .sortBy("set_order");
}

export async function getAllExercises(): Promise<Exercise[]> {
  return await db.exercises
    .filter((e) => !e.deleted_at)
    .sortBy("name");
}

export async function getLatestBigThree(): Promise<BigThreeRecord | undefined> {
  const records = await db.big_three.toArray();
  return records[0];
}

/**
 * 取得某個動作「上一次訓練」的所有組數，用於現場對照突破目標
 * 支援傳入 preferredLocation (優先匹配同健身房，如交大健身房 vs 三健客，杜絕機器槓桿比與插銷重量落差)
 */
export async function getLastExerciseSets(
  exerciseId: string,
  excludeSessionId?: string,
  preferredLocation?: string
): Promise<{ session: WorkoutSession; sets: SetItem[] } | null> {
  const sets = await db.sets
    .where("exercise_id")
    .equals(exerciseId)
    .filter((s) => !s.deleted_at && s.session_id !== excludeSessionId)
    .toArray();

  if (sets.length === 0) return null;

  // 找出所有相關 session
  const sessionIds = Array.from(new Set(sets.map((s) => s.session_id)));
  const sessions = await db.sessions
    .where("id")
    .anyOf(sessionIds)
    .filter((s) => !s.deleted_at)
    .sortBy("date");

  if (sessions.length === 0) return null;

  // ⭐ 優先尋找同地點 (preferredLocation，例如「交大健身房」或「三健客」) 的最近場次
  let lastSession: WorkoutSession | undefined;
  if (preferredLocation && preferredLocation.trim()) {
    const normPref = preferredLocation.trim();
    for (let i = sessions.length - 1; i >= 0; i--) {
      const s = sessions[i];
      const match =
        (s.location && (s.location.includes(normPref) || normPref.includes(s.location))) ||
        (s.display_title && s.display_title.includes(normPref));
      if (match) {
        lastSession = s;
        break;
      }
    }
  }

  // 若該地點尚無歷史紀錄，則退回該動作全歷史最近一次的訓練
  if (!lastSession) {
    lastSession = sessions[sessions.length - 1];
  }

  const lastSets = sets
    .filter((s) => s.session_id === lastSession!.id)
    .sort((a, b) => a.set_order - b.set_order);

  return {
    session: lastSession,
    sets: lastSets,
  };
}

/**
 * 取得某個動作最近 N 次的歷史訓練紀錄 (含日期、場地與完整組數)，便於現場即時查閱對照
 */
export async function getExerciseHistorySessions(
  exerciseId: string,
  limit = 5
): Promise<{ session: WorkoutSession; sets: SetItem[] }[]> {
  const sets = await db.sets
    .where("exercise_id")
    .equals(exerciseId)
    .filter((s) => !s.deleted_at && s.weight_kg > 0)
    .toArray();

  if (sets.length === 0) return [];

  const sessionIds = Array.from(new Set(sets.map((s) => s.session_id)));
  const sessions = (
    await db.sessions
      .where("id")
      .anyOf(sessionIds)
      .filter((s) => !s.deleted_at)
      .sortBy("date")
  ).reverse();

  const topSessions = sessions.slice(0, limit);
  const result: { session: WorkoutSession; sets: SetItem[] }[] = [];

  for (const sess of topSessions) {
    const sessSets = sets
      .filter((s) => s.session_id === sess.id)
      .sort((a, b) => a.set_order - b.set_order);
    result.push({ session: sess, sets: sessSets });
  }

  return result;
}

/**
 * 取得指定部位「最近一次」訓練菜單結構 (動作清單與組數)，以供快速複製或套用
 * 支援傳入 preferredLocation，優先匹配同健身房/地點的菜單 (如交大健身房 vs 三健客)
 */
export async function getPreviousSessionTemplate(
  targetMuscle: string,
  preferredLocation?: string
): Promise<{ session: WorkoutSession; exerciseIds: string[]; sets: SetItem[] } | null> {
  const sessions = (
    await db.sessions
      .filter((s) => !s.deleted_at && s.target_muscle.includes(targetMuscle))
      .sortBy("date")
  ).reverse();

  if (sessions.length === 0) return null;

  // ⭐ 優先尋找同地點且有組數紀錄的訓練菜單
  let prevSession: WorkoutSession | undefined;
  let prevSets: SetItem[] = [];

  const candidateSessions = preferredLocation && preferredLocation.trim()
    ? sessions.filter((s) => {
        const normPref = preferredLocation.trim();
        return (
          (s.location && (s.location.includes(normPref) || normPref.includes(s.location))) ||
          (s.display_title && s.display_title.includes(normPref))
        );
      })
    : [];

  for (const cand of candidateSessions) {
    const cSets = await db.sets
      .where("session_id")
      .equals(cand.id)
      .filter((s) => !s.deleted_at)
      .sortBy("set_order");
    if (cSets.length > 0) {
      prevSession = cand;
      prevSets = cSets;
      break;
    }
  }

  // 若該地點尚無有組數的紀錄，則退回該部位最近一次有組數的訓練
  if (!prevSession) {
    for (const cand of sessions) {
      const cSets = await db.sets
        .where("session_id")
        .equals(cand.id)
        .filter((s) => !s.deleted_at)
        .sortBy("set_order");
      if (cSets.length > 0) {
        prevSession = cand;
        prevSets = cSets;
        break;
      }
    }
  }

  if (!prevSession) {
    prevSession = sessions[0];
    prevSets = await db.sets
      .where("session_id")
      .equals(prevSession.id)
      .filter((s) => !s.deleted_at)
      .sortBy("set_order");
  }

  const exerciseIds: string[] = [];
  for (const s of prevSets) {
    if (!exerciseIds.includes(s.exercise_id)) {
      exerciseIds.push(s.exercise_id);
    }
  }

  return {
    session: prevSession,
    exerciseIds,
    sets: prevSets,
  };
}

/**
 * 取得動作全歷史最高記錄 (Max Weight & Estimated 1RM)
 */
export async function getExerciseMaxPR(exerciseId: string): Promise<{
  maxWeight: number;
  maxWeightReps: number;
  max1RM: number;
  bestSet: SetItem | null;
}> {
  const sets = await db.sets
    .where("exercise_id")
    .equals(exerciseId)
    .filter((s) => !s.deleted_at && s.weight_kg > 0)
    .toArray();

  if (sets.length === 0) {
    return { maxWeight: 0, maxWeightReps: 0, max1RM: 0, bestSet: null };
  }

  let maxWeight = 0;
  let maxWeightReps = 0;
  let max1RM = 0;
  let bestSet: SetItem | null = null;

  for (const s of sets) {
    if (s.weight_kg > maxWeight) {
      maxWeight = s.weight_kg;
      maxWeightReps = s.reps;
    }
    const current1RM = estimate1RM(s.weight_kg, s.reps);
    if (current1RM > max1RM) {
      max1RM = current1RM;
      bestSet = s;
    }
  }

  return { maxWeight, maxWeightReps, max1RM, bestSet };
}

/**
 * 計算推估 1RM (Epley 公式)
 */
export function estimate1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

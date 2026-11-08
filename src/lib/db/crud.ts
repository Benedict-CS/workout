import { db } from "./schema";
import type {
  Exercise,
  SetItem,
  WorkoutSession,
  BigThreeRecord,
} from "@/lib/types";

export async function getRecentSessions(limit = 30): Promise<WorkoutSession[]> {
  return await db.sessions
    .filter((s) => !s.deleted_at)
    .reverse()
    .sortBy("date")
    .then((list) => list.slice(0, limit));
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
 */
export async function getLastExerciseSets(
  exerciseId: string,
  excludeSessionId?: string
): Promise<{ session: WorkoutSession; sets: SetItem[] } | null> {
  const sets = await db.sets
    .where("exercise_id")
    .equals(exerciseId)
    .filter((s) => !s.deleted_at && s.session_id !== excludeSessionId)
    .toArray();

  if (sets.length === 0) return null;

  // 找出最近的 session
  const sessionIds = Array.from(new Set(sets.map((s) => s.session_id)));
  const sessions = await db.sessions
    .where("id")
    .anyOf(sessionIds)
    .filter((s) => !s.deleted_at)
    .sortBy("date");

  const lastSession = sessions[sessions.length - 1];
  if (!lastSession) return null;

  const lastSets = sets
    .filter((s) => s.session_id === lastSession.id)
    .sort((a, b) => a.set_order - b.set_order);

  return {
    session: lastSession,
    sets: lastSets,
  };
}

/**
 * 計算推估 1RM (Epley 公式)
 */
export function estimate1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

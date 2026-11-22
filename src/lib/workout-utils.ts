import type { WorkoutSession } from "./types";

export function getPrimaryMuscle(muscle: string): "胸" | "背" | "腿" | "肩" | "手臂" | "核心" | "游泳" {
  if (!muscle) return "胸";
  if (muscle.includes("胸")) return "胸";
  if (muscle.includes("背")) return "背";
  if (muscle.includes("腿")) return "腿";
  if (muscle.includes("肩")) return "肩";
  if (muscle.includes("臂") || muscle.includes("二頭") || muscle.includes("三頭")) return "手臂";
  if (muscle.includes("核") || muscle.includes("腹")) return "核心";
  if (muscle.includes("泳")) return "游泳";
  return "胸";
}

export function getMuscleBadgeColor(muscle: string): string {
  const pm = getPrimaryMuscle(muscle);
  switch (pm) {
    case "胸":
      return "bg-red-500/20 text-red-300 border-red-500/40";
    case "背":
      return "bg-blue-500/20 text-blue-300 border-blue-500/40";
    case "腿":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    case "肩":
      return "bg-purple-500/20 text-purple-300 border-purple-500/40";
    case "手臂":
      return "bg-pink-500/20 text-pink-300 border-pink-500/40";
    case "核心":
      return "bg-orange-500/20 text-orange-300 border-orange-500/40";
    case "游泳":
      return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
    default:
      return "bg-gray-500/20 text-gray-300 border-gray-500/40";
  }
}

/**
 * 依日期與建立順序動態精準計算當月所有重訓場次的「第 X 次」序號
 * 解決使用者非依序記錄、補登歷史紀錄、刪除場次後序號重複或錯亂的問題
 */
export function computeMonthlyIndices(sessions: WorkoutSession[]): Map<string, number> {
  const map = new Map<string, number>();

  // 依 month_key 分群
  const byMonth = new Map<string, WorkoutSession[]>();
  for (const s of sessions) {
    if (s.deleted_at) continue;
    const key = s.month_key || s.date.slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(s);
  }

  for (const [, list] of byMonth) {
    // 排除游泳，純重訓場次
    const weightSessions = list.filter(
      (s) => s.target_muscle !== "游泳" && !s.target_muscle.includes("泳") && !s.display_title.includes("泳")
    );

    // 嚴格依日期正序、建立時間正序排序
    weightSessions.sort((a, b) => {
      const cmpDate = a.date.localeCompare(b.date);
      if (cmpDate !== 0) return cmpDate;
      return (a.created_at || "").localeCompare(b.created_at || "");
    });

    weightSessions.forEach((s, idx) => {
      map.set(s.id, idx + 1);
    });
  }

  return map;
}

export function cleanSessionTitle(title: string, targetMuscle?: string, monthlyIndex?: number): string {
  if (!title) return "";
  let res = title.replace(/\(([^)]+)\)/, (_, rawInside) => {
    const muscle = targetMuscle || rawInside;
    const pm = getPrimaryMuscle(muscle);
    return `(${pm})`;
  });

  // 若提供動態精準的 monthlyIndex，自動確保「第 X 次」與計算結果 100% 吻合
  if (monthlyIndex !== undefined && monthlyIndex > 0) {
    if (/第\s*\d+\s*次/.test(res)) {
      res = res.replace(/第\s*\d+\s*次/, `第 ${monthlyIndex} 次`);
    } else if (!res.includes("泳") && targetMuscle !== "游泳") {
      res = `${res} - 第 ${monthlyIndex} 次`;
    }
  }

  return res;
}

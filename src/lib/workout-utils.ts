import type { WorkoutSession, SetItem, Exercise } from "./types";

export function getPrimaryMuscle(muscle: string): "胸" | "背" | "腿" | "肩" | "游泳" {
  if (!muscle) return "胸";
  if (muscle.includes("胸")) return "胸";
  if (muscle.includes("背")) return "背";
  if (muscle.includes("腿")) return "腿";
  if (muscle.includes("肩")) return "肩";
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

/**
 * 確保在所有背部訓練中，坐姿划船機動作嚴格拆分為：
 * 前 3 個正式組為「坐姿划船機 (寬握)」(ex-seated-row-wide)
 * 後續所有組數為「坐姿划船機 (窄握)」(ex-seated-row-close)
 */
export function normalizeSessionSets(
  sets: SetItem[],
  targetMuscle?: string,
  displayTitle?: string
): SetItem[] {
  const isBack =
    (targetMuscle && targetMuscle.includes("背")) ||
    (displayTitle && displayTitle.includes("背"));

  const isWarmupCheck = (st: SetItem) => {
    if (st.set_type === "warmup") return true;
    const r = st.raw_text || "";
    const n = st.notes || "";
    return r.includes("熱身") || r.includes("激發") || r.includes("試重") || n.includes("熱身");
  };

  const isSeatedRow = (id: string) =>
    id === "ex-seated-row" ||
    id === "ex-seated-row-machine" ||
    id === "ex-seated-row-wide" ||
    id === "ex-seated-row-close";

  const sorted = [...sets].sort((a, b) => a.set_order - b.set_order);

  if (!isBack) {
    return sorted.map((st) =>
      st.exercise_id === "ex-seated-row" || st.exercise_id === "ex-seated-row-machine"
        ? { ...st, exercise_id: "ex-seated-row-wide" }
        : st
    );
  }

  let formalRowCount = 0;
  let closeIndex = 0;
  return sorted.map((st) => {
    if (!isSeatedRow(st.exercise_id)) return st;

    const isW = isWarmupCheck(st);
    if (!isW) {
      formalRowCount++;
      if (formalRowCount <= 3) {
        return { ...st, exercise_id: "ex-seated-row-wide" };
      } else {
        closeIndex++;
        let newRaw = st.raw_text;
        if (newRaw && /^set\s*\d+:/i.test(newRaw)) {
          newRaw = newRaw.replace(/^set\s*\d+:/i, `set ${closeIndex}:`);
        }
        return { ...st, exercise_id: "ex-seated-row-close", raw_text: newRaw };
      }
    } else {
      const targetId = formalRowCount < 3 ? "ex-seated-row-wide" : "ex-seated-row-close";
      return { ...st, exercise_id: targetId };
    }
  });
}

export function getExerciseDisplayName(exerciseId: string, exercisesMap?: Map<string, Exercise>): string {
  if (exerciseId === "ex-seated-row-wide") return "坐姿划船機 (寬握)";
  if (exerciseId === "ex-seated-row-close") return "坐姿划船機 (窄握)";
  if (exerciseId === "ex-seated-row" || exerciseId === "ex-seated-row-machine") return "坐姿划船機 (寬握)";
  const ex = exercisesMap?.get(exerciseId);
  if (ex) return ex.name;
  return "動作";
}


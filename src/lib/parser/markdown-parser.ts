import type {
  BigThreeRecord,
  Exercise,
  MuscleGroup,
  SetItem,
  SetType,
  WeightType,
  WorkoutSession,
} from "../types";

export interface ParsedWorkoutData {
  bigThree: BigThreeRecord | null;
  sessions: WorkoutSession[];
  exercises: Exercise[];
  sets: SetItem[];
}

const CANONICAL_EXERCISES: Record<string, { id: string; muscle: MuscleGroup; type: WeightType }> = {
  // 胸
  "槓鈴臥推": { id: "ex-bench", muscle: "胸", type: "barbell_total" },
  "上斜槓鈴臥推": { id: "ex-incline-bench", muscle: "胸", type: "barbell_total" },
  "下斜槓鈴臥推": { id: "ex-decline-bench", muscle: "胸", type: "barbell_total" },
  "史密斯槓鈴臥推": { id: "ex-smith-bench", muscle: "胸", type: "barbell_total" },
  "啞鈴平臥推": { id: "ex-db-bench", muscle: "胸", type: "dumbbell_single" },
  "啞鈴上斜臥推": { id: "ex-db-incline-bench", muscle: "胸", type: "dumbbell_single" },
  "蝴蝶機夾胸": { id: "ex-pec-fly", muscle: "胸", type: "machine_stack" },
  "胸部推舉機": { id: "ex-chest-press-machine", muscle: "胸", type: "machine_stack" },
  "坐姿胸推機器": { id: "ex-chest-press-seated", muscle: "胸", type: "machine_stack" },
  "上斜機器臥推": { id: "ex-incline-machine-bench", muscle: "胸", type: "machine_single" },
  "三頭下壓機 寬 (主攻下胸)": { id: "ex-dip-pushdown-machine", muscle: "胸", type: "machine_stack" },
  "繩索三頭下壓": { id: "ex-rope-tricep", muscle: "胸", type: "machine_stack" },
  "繩索夾胸": { id: "ex-cable-crossover", muscle: "胸", type: "machine_stack" },
  "輔助雙槓臂屈伸機": { id: "ex-assisted-dip", muscle: "胸", type: "assisted_inverse" },

  // 腿
  "槓鈴深蹲": { id: "ex-squat", muscle: "腿", type: "barbell_total" },
  "大腿推蹬機": { id: "ex-leg-press", muscle: "腿", type: "machine_stack" },
  "臥式腿部彎舉機": { id: "ex-leg-curl", muscle: "腿", type: "machine_stack" },
  "保加利亞分腿蹲": { id: "ex-bulgarian-squat", muscle: "腿", type: "dumbbell_single" },
  "腿部伸張機": { id: "ex-leg-extension", muscle: "腿", type: "machine_stack" },
  "哈克深蹲": { id: "ex-hack-squat", muscle: "腿", type: "machine_single" },

  // 背
  "槓鈴硬舉": { id: "ex-deadlift", muscle: "背", type: "barbell_total" },
  "六角槓硬舉": { id: "ex-trap-bar-deadlift", muscle: "背", type: "barbell_total" },
  "自重引體向上": { id: "ex-pullup", muscle: "背", type: "bodyweight" },
  "輔助引體向上": { id: "ex-assisted-pullup", muscle: "背", type: "assisted_inverse" },
  "雙軌滑輪下拉": { id: "ex-lat-pulldown", muscle: "背", type: "machine_stack" },
  "高拉背部划船機": { id: "ex-high-row", muscle: "背", type: "machine_single" },
  "高位反手下拉": { id: "ex-underhand-pulldown", muscle: "背", type: "machine_single" },
  "坐姿划船機": { id: "ex-seated-row", muscle: "背", type: "machine_single" },
  "坐式背部划船機": { id: "ex-seated-cable-row", muscle: "背", type: "machine_stack" },
  "槓鈴划船": { id: "ex-barbell-row", muscle: "背", type: "barbell_total" },
  "單手啞鈴划船": { id: "ex-db-single-row", muscle: "背", type: "dumbbell_single" },
  "啞鈴槌式彎舉": { id: "ex-db-hammer-curl", muscle: "背", type: "dumbbell_single" },
  "上斜啞鈴彎舉": { id: "ex-incline-db-curl", muscle: "背", type: "dumbbell_single" },

  // 肩
  "啞鈴側平舉": { id: "ex-db-lateral-raise", muscle: "肩", type: "dumbbell_single" },
  "啞鈴肩推": { id: "ex-db-shoulder-press", muscle: "肩", type: "dumbbell_single" },
  "單臂滑輪側平舉": { id: "ex-cable-lateral-raise", muscle: "肩", type: "machine_stack" },
  "繩索面拉": { id: "ex-cable-face-pull", muscle: "肩", type: "machine_stack" },
  "反向蝴蝶機 (後三角)": { id: "ex-reverse-pec-fly", muscle: "肩", type: "machine_stack" },

  // 游泳
  "游泳": { id: "ex-swim", muscle: "游泳", type: "bodyweight" },
};

function mapExerciseName(rawName: string): string {
  let clean = rawName.replace(/^-\s*/, "").split(/[：:]/)[0].trim();
  clean = clean.replace(/\(.*?\)/g, "").replace(/（.*?）/g, "").trim();

  if (clean.includes("槓鈴臥推") || clean.includes("平胸臥推")) {
    if (clean.includes("上斜")) return "上斜槓鈴臥推";
    if (clean.includes("下斜")) return "下斜槓鈴臥推";
    if (clean.includes("史密斯")) return "史密斯槓鈴臥推";
    return "槓鈴臥推";
  }

  if (clean.includes("啞鈴") && (clean.includes("臥推") || clean.includes("平推"))) {
    if (clean.includes("上斜")) return "啞鈴上斜臥推";
    return "啞鈴平臥推";
  }

  if (clean.includes("蝴蝶機") || clean.includes("反向蝴蝶機")) {
    if (clean.includes("後三角") || clean.includes("反向")) return "反向蝴蝶機 (後三角)";
    return "蝴蝶機夾胸";
  }

  if (clean.includes("引體")) {
    if (clean.includes("輔助")) return "輔助引體向上";
    return "自重引體向上";
  }

  if (clean.includes("胸推")) {
    if (clean.includes("推舉機")) return "胸部推舉機";
    return "坐姿胸推機器";
  }

  if (clean.includes("雙槓")) return "輔助雙槓臂屈伸機";

  if (clean.includes("深蹲")) {
    if (clean.includes("哈克")) return "哈克深蹲";
    if (clean.includes("分腿")) return "保加利亞分腿蹲";
    return "槓鈴深蹲";
  }

  if (clean.includes("硬舉")) {
    if (clean.includes("六角")) return "六角槓硬舉";
    return "槓鈴硬舉";
  }

  if (clean.includes("腿推") || clean.includes("推蹬")) return "大腿推蹬機";
  if (clean.includes("腿伸展") || clean.includes("前踢") || clean.includes("伸張")) return "腿部伸張機";

  if (clean.includes("彎舉")) {
    if (clean.includes("腿")) return "臥式腿部彎舉機";
    if (clean.includes("槌式")) return "啞鈴槌式彎舉";
    if (clean.includes("上斜")) return "上斜啞鈴彎舉";
  }

  if (clean.includes("高位反手") || clean.includes("反手下拉")) return "高位反手下拉";
  if (clean.includes("高拉背部")) return "高拉背部划船機";
  if (clean.includes("雙軌滑輪") || clean.includes("滑輪下拉")) return "雙軌滑輪下拉";
  if (clean.includes("坐式背部划船")) return "坐式背部划船機";
  if (clean.includes("坐姿划船")) return "坐姿划船機";
  if (clean.includes("槓鈴划船")) return "槓鈴划船";
  if (clean.includes("啞鈴划船")) return "單手啞鈴划船";

  if (clean.includes("肩推")) return "啞鈴肩推";
  if (clean.includes("側平舉")) return "單臂滑輪側平舉";
  if (clean.includes("面拉")) return "繩索面拉";

  if (clean.includes("三頭下壓")) {
    if (clean.includes("寬") || clean.includes("下胸") || clean.includes("機")) return "三頭下壓機 寬 (主攻下胸)";
    return "繩索三頭下壓";
  }

  if (clean.includes("繩索夾胸")) return "繩索夾胸";
  if (clean.includes("上斜機器")) return "上斜機器臥推";
  if (clean.includes("游泳")) return "游泳";

  return clean;
}

export function parseWorkoutMarkdown(markdown: string, defaultYear = 2026): ParsedWorkoutData {
  const lines = markdown.split(/\r?\n/);

  let bigThree: BigThreeRecord | null = null;
  const sessions: WorkoutSession[] = [];
  const exerciseMap = new Map<string, Exercise>();
  const sets: SetItem[] = [];

  // 初始化標準動作字典
  for (const [name, def] of Object.entries(CANONICAL_EXERCISES)) {
    exerciseMap.set(name, {
      id: def.id,
      name: name,
      muscle_group: def.muscle,
      weight_type: def.type,
      created_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-11-14T00:00:00.000Z",
      sync_status: "synced",
    });
  }

  let currentYear = defaultYear;
  let currentSession: WorkoutSession | null = null;
  let currentExercise: Exercise | null = null;
  let currentSessionSetOrder = 0;
  const sessionCountByDate: Record<string, number> = {};

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    // 1. 三項數據解析
    if (line.includes("**硬舉**") && line.includes("Kg")) {
      const match = line.match(/(\d+(?:\.\d+)?)\s*Kg/i);
      const ratioMatch = line.match(/（?(\d+(?:\.\d+)?)倍）?/);
      if (match) {
        if (!bigThree) {
          bigThree = {
            id: "big-three-latest",
            bench_press_kg: 60,
            squat_kg: 90,
            deadlift_kg: 90,
            total_kg: 240,
            updated_at: new Date().toISOString(),
            sync_status: "synced",
          };
        }
        bigThree.deadlift_kg = parseFloat(match[1]);
        if (ratioMatch) bigThree.deadlift_ratio = parseFloat(ratioMatch[1]);
      }
    }
    if (line.includes("**深蹲**") && line.includes("Kg")) {
      const match = line.match(/(\d+(?:\.\d+)?)\s*Kg/i);
      const ratioMatch = line.match(/（?(\d+(?:\.\d+)?)倍）?/);
      if (match && bigThree) {
        bigThree.squat_kg = parseFloat(match[1]);
        if (ratioMatch) bigThree.squat_ratio = parseFloat(ratioMatch[1]);
      }
    }
    if (line.includes("**臥推**") && line.includes("Kg")) {
      const match = line.match(/(\d+(?:\.\d+)?)\s*Kg/i);
      const ratioMatch = line.match(/（?(\d+(?:\.\d+)?)倍）?/);
      if (match && bigThree) {
        bigThree.bench_press_kg = parseFloat(match[1]);
        if (ratioMatch) bigThree.bench_ratio = parseFloat(ratioMatch[1]);
      }
    }
    if (line.includes("**三項總和**") && line.includes("Kg")) {
      const match = line.match(/(\d+(?:\.\d+)?)\s*Kg/i);
      if (match && bigThree) {
        bigThree.total_kg = parseFloat(match[1]);
      }
    }

    // 2. 月份標題
    const monthHeaderMatch = line.match(/^#\s*(\d{1,2})\s*月份/);
    if (monthHeaderMatch) {
      continue;
    }

    // 3. 抓取單次訓練日標題
    const summaryMatch = line.match(/<summary><b>(\d{1,2})\/(\d{1,2})\s*\((.*?)\)(.*?)<\/b><\/summary>/);
    if (summaryMatch) {
      const m = parseInt(summaryMatch[1], 10);
      const d = parseInt(summaryMatch[2], 10);
      const rawTarget = summaryMatch[3].trim();
      const restPart = summaryMatch[4].trim();

      let targetMuscle: MuscleGroup = "胸";
      if (rawTarget.includes("胸")) targetMuscle = "胸";
      else if (rawTarget.includes("背")) targetMuscle = "背";
      else if (rawTarget.includes("腿")) targetMuscle = "腿";
      else if (rawTarget.includes("肩")) targetMuscle = "肩" as any;
      else if (rawTarget.includes("泳")) targetMuscle = "游泳";

      let location = m >= 9 ? "三健客" : "交大健身房";
      if (restPart.includes("交大游泳池") || targetMuscle === "游泳") location = "交大游泳池";
      if (restPart.includes("zyx家游泳池")) location = "zyx家游泳池";
      if (restPart.includes("清大游泳池")) location = "清大游泳池";
      if (restPart.includes("永和國民運動中心")) location = "永和國民運動中心";
      if (restPart.includes("四號公園")) location = "四號公園";
      if (restPart.includes("三健客")) location = "三健客";
      if (restPart.includes("交大健身房")) location = "交大健身房";

      const idxMatch = restPart.match(/第\s*(\d+)\s*次/);
      const monthlyIndex = idxMatch ? parseInt(idxMatch[1], 10) : 1;

      const monthStr = m.toString().padStart(2, "0");
      const dayStr = d.toString().padStart(2, "0");
      const dateStr = `${currentYear}-${monthStr}-${dayStr}`;
      const monthKey = `${currentYear}-${monthStr}`;

      const sessNum = (sessionCountByDate[dateStr] || 0) + 1;
      sessionCountByDate[dateStr] = sessNum;
      const sessionId = idxMatch ? `session-${dateStr}-${monthlyIndex}` : `session-${dateStr}-${sessNum}`;

      let displayTitle = `${m}/${d} (${rawTarget})`;
      if (location) displayTitle += ` - ${location}`;
      if (idxMatch) displayTitle += ` - 第 ${monthlyIndex} 次`;

      currentSession = {
        id: sessionId,
        date: dateStr,
        month_key: monthKey,
        display_title: displayTitle,
        target_muscle: targetMuscle,
        monthly_index: monthlyIndex,
        location: location,
        status: "completed",
        created_at: `${dateStr}T08:00:00.000Z`,
        updated_at: `${dateStr}T08:00:00.000Z`,
        sync_status: "synced",
      };
      sessions.push(currentSession);
      currentSessionSetOrder = 0;
      currentExercise = null;
      continue;
    }

    // 4. 抓取動作標題
    const isExHeader =
      line.startsWith("- ") &&
      (line.includes("：") || line.includes(":")) &&
      !line.startsWith("- set") &&
      !line.includes("Kg x") &&
      !line.includes("新機器 set") &&
      !line.includes("舊機器 set");

    if (isExHeader && currentSession) {
      let rawEx = line.replace(/^-\s*/, "").split(/[：:]/)[0].trim();
      if (rawEx.includes("額外加碼測試") || rawEx.includes("平板啞鈴")) {
        currentExercise = exerciseMap.get("啞鈴平臥推") || null;
        continue;
      }
      if (rawEx.includes("超級組")) {
        currentExercise = exerciseMap.get("自重引體向上") || null;
        continue;
      }

      const canonicalName = mapExerciseName(rawEx);
      if (exerciseMap.has(canonicalName)) {
        currentExercise = exerciseMap.get(canonicalName)!;
      } else {
        const newEx: Exercise = {
          id: `ex-${exerciseMap.size + 1}`,
          name: canonicalName,
          muscle_group: currentSession.target_muscle as MuscleGroup,
          weight_type: "machine_stack",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: "synced",
        };
        exerciseMap.set(canonicalName, newEx);
        currentExercise = newEx;
      }
      continue;
    }

    // 5. 抓取組數 (Sets)
    const isSetLine =
      line.startsWith("- set") ||
      line.startsWith("set ") ||
      line.includes("Kg x") ||
      line.includes("自身體重 x") ||
      line.includes("0Kg x") ||
      /^\s*-\s*\d+(?:\.\d+)?Kg/.test(line) ||
      line.includes("平板啞鈴臥推:") ||
      line.includes("自身體重");

    if (currentSession && isSetLine) {
      // 處理超級組中同一行包含自重引體與槓鈴划船
      if (line.includes("引體") && line.includes("槓鈴划船")) {
        currentSessionSetOrder++;
        const pullupEx = exerciseMap.get("自重引體向上");
        if (pullupEx) {
          sets.push({
            id: `set-${currentSession.id}-${currentSessionSetOrder}`,
            session_id: currentSession.id,
            exercise_id: pullupEx.id,
            set_order: currentSessionSetOrder,
            set_type: "normal",
            weight_kg: 0,
            reps: 4,
            is_completed: true,
            raw_text: "自身體重 x4 + 休2",
            created_at: currentSession.created_at,
            updated_at: currentSession.updated_at,
            sync_status: "synced",
          });
        }
        currentSessionSetOrder++;
        const rowEx = exerciseMap.get("槓鈴划船");
        if (rowEx) {
          sets.push({
            id: `set-${currentSession.id}-${currentSessionSetOrder}`,
            session_id: currentSession.id,
            exercise_id: rowEx.id,
            set_order: currentSessionSetOrder,
            set_type: "normal",
            weight_kg: line.includes("30Kg") ? 30 : 35,
            reps: 10,
            is_completed: true,
            raw_text: "槓鈴划船 x10",
            created_at: currentSession.created_at,
            updated_at: currentSession.updated_at,
            sync_status: "synced",
          });
        }
        continue;
      }

      let activeEx = currentExercise;
      if (line.includes("平板啞鈴臥推") || (line.includes("啞鈴") && line.includes("平推"))) {
        activeEx = exerciseMap.get("啞鈴平臥推") || currentExercise;
      }

      if (!activeEx) continue;

      currentSessionSetOrder++;
      const cleanLine = line.replace(/^-\s*/, "").trim();

      let setType: SetType = "normal";
      if (cleanLine.includes("熱身") || cleanLine.includes("神經激發") || cleanLine.includes("測試")) setType = "warmup";
      else if (cleanLine.includes("遞減")) setType = "drop";

      const isFailure = cleanLine.includes("力竭") || cleanLine.includes("失敗");

      let weight = 0;
      let reps = 0;
      const mainPart = cleanLine.split("+")[0].trim();

      const wMatch = mainPart.match(/(\d+(?:\.\d+)?)\s*Kg(?:\([^\)]+\))?\s*x\s*(\d+(?:\.\d+)?)/i);
      const bwMatch = mainPart.match(/(?:自身體重|0Kg)?\s*x\s*(\d+(?:\.\d+)?)/i);

      if (wMatch) {
        weight = parseFloat(wMatch[1]);
        reps = Math.round(parseFloat(wMatch[2]));
      } else if (bwMatch) {
        weight = 0;
        reps = Math.round(parseFloat(bwMatch[1]));
      } else if (cleanLine.includes("自身體重") || cleanLine.includes("0Kg")) {
        const m = cleanLine.match(/x\s*(\d+(?:\.\d+)?)/);
        if (m) reps = Math.round(parseFloat(m[1]));
      }

      let forcedReps = 0;
      const fMatch = cleanLine.match(/[+＋]?\s*(?:補|輔助|輔)\s*(\d+)/);
      if (fMatch) forcedReps = parseInt(fMatch[1], 10);

      let restPause: string | undefined = undefined;
      if (cleanLine.includes("+ 休") || cleanLine.includes("+ 休息") || cleanLine.includes("遞減") || cleanLine.includes("+ 補")) {
        const parts = cleanLine.split("+");
        if (parts.length > 1) restPause = parts.slice(1).join("+").trim();
      }

      const fbMatch = cleanLine.match(/[\(（](.*?)[\)）]/);
      const feedback = fbMatch ? fbMatch[1] : undefined;

      sets.push({
        id: `set-${currentSession.id}-${currentSessionSetOrder}`,
        session_id: currentSession.id,
        exercise_id: activeEx.id,
        set_order: currentSessionSetOrder,
        set_type: setType,
        weight_kg: weight,
        reps: reps,
        forced_reps: forcedReps > 0 ? forcedReps : undefined,
        rest_pause_detail: restPause,
        is_failure: isFailure,
        is_completed: true,
        feedback: feedback,
        raw_text: cleanLine,
        created_at: currentSession.created_at,
        updated_at: currentSession.updated_at,
        sync_status: "synced",
      });
    }
  }

  return {
    bigThree,
    sessions,
    exercises: Array.from(exerciseMap.values()),
    sets,
  };
}
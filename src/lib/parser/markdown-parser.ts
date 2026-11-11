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

export function parseWorkoutMarkdown(markdown: string, defaultYear = 2026): ParsedWorkoutData {
  const lines = markdown.split(/\r?\n/);

  let bigThree: BigThreeRecord | null = null;
  const sessions: WorkoutSession[] = [];
  const exerciseMap = new Map<string, Exercise>();
  const sets: SetItem[] = [];

  let currentYear = defaultYear;
  let currentMonth = 0;
  let currentSession: WorkoutSession | null = null;
  let currentExercise: Exercise | null = null;
  let currentSessionSetOrder = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) continue;

    // 1. 抓取三項基本數據 (只抓取頂部基本三項數據區塊)
    if (line.includes("**硬舉**") && line.includes("Kg")) {
      const match = line.match(/(\d+(?:\.\d+)?)\s*Kg/i);
      const ratioMatch = line.match(/（?(\d+(?:\.\d+)?)倍）?/);
      if (match) {
        if (!bigThree) {
          bigThree = {
            id: "big-three-latest",
            bench_press_kg: 60,
            squat_kg: 85,
            deadlift_kg: 90,
            total_kg: 235,
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

    // 2. 抓取月份標題，例如 `# 6 月份` 或 `# 11 月份`
    const monthHeaderMatch = line.match(/^#\s*(\d{1,2})\s*月份/);
    if (monthHeaderMatch) {
      currentMonth = parseInt(monthHeaderMatch[1], 10);
      continue;
    }

    // 3. 抓取單次訓練日標題，支援包含場地或一般格式：
    // 例如 `<summary><b>10/11 (胸) - 交大健身房 - 第 6 次</b></summary>`
    // 或 `<summary><b>6/12 (胸) - 第 1 次</b></summary>`
    // 或 `<summary><b>7/21 (游泳)</b></summary>`
    const summaryMatch = line.match(/<summary><b>(\d{1,2})\/(\d{1,2})\s*\((.*?)\)(.*?)<\/b><\/summary>/);
    if (summaryMatch) {
      const m = parseInt(summaryMatch[1], 10);
      const d = parseInt(summaryMatch[2], 10);
      const targetMuscle = summaryMatch[3].trim();
      const restPart = summaryMatch[4].trim(); // 例如 "- 交大健身房 - 第 6 次" 或 "- 第 1 次"

      let location = "";
      let monthlyIndex = 1;

      const idxMatch = restPart.match(/第\s*(\d+)\s*次/);
      if (idxMatch) {
        monthlyIndex = parseInt(idxMatch[1], 10);
      }

      // 提取場地 (如果在括號後且在第幾次前)
      const restTokens = restPart.split(/\s*-\s*/).map((t) => t.trim()).filter(Boolean);
      for (const tok of restTokens) {
        if (!tok.includes("第") && !tok.includes("次")) {
          location = tok;
          break;
        }
      }

      const monthStr = m.toString().padStart(2, "0");
      const dayStr = d.toString().padStart(2, "0");
      const dateStr = `${currentYear}-${monthStr}-${dayStr}`;
      const monthKey = `${currentYear}-${monthStr}`;
      const sessionId = `session-${dateStr}-${monthlyIndex}`;

      let displayTitle = `${m}/${d} (${targetMuscle})`;
      if (location) displayTitle += ` - ${location}`;
      if (idxMatch) displayTitle += ` - 第 ${monthlyIndex} 次`;

      currentSession = {
        id: sessionId,
        date: dateStr,
        month_key: monthKey,
        display_title: displayTitle,
        target_muscle: targetMuscle,
        monthly_index: monthlyIndex,
        location: location || undefined,
        created_at: new Date(dateStr).toISOString(),
        updated_at: new Date(dateStr).toISOString(),
        sync_status: "synced",
      };
      sessions.push(currentSession);
      currentSessionSetOrder = 0;
      currentExercise = null;
      continue;
    }

    // 4. 抓取動作標題，例如 `- 槓鈴臥推：` 或 `- 啞鈴平臥推 (單邊重量)：`
    const exerciseMatch = line.match(/^-\s*([^-\n]+?)(?:[:：]|\s*$)/);
    if (exerciseMatch && currentSession && !line.startsWith("- set") && !line.includes("x") && !line.includes("Kg")) {
      const rawExerciseName = exerciseMatch[1].trim();
      
      // 判斷重量類型與分類 (僅限: 胸、背、腿、游泳)
      let muscleGroup: MuscleGroup = "胸";
      if (currentSession.target_muscle.includes("胸")) muscleGroup = "胸";
      else if (currentSession.target_muscle.includes("背")) muscleGroup = "背";
      else if (currentSession.target_muscle.includes("腿")) muscleGroup = "腿";
      else if (currentSession.target_muscle.includes("游泳")) muscleGroup = "游泳";

      let weightType: WeightType = "barbell_total";
      if (rawExerciseName.includes("單邊重量") || rawExerciseName.includes("啞鈴")) {
        weightType = "dumbbell_single";
      } else if (rawExerciseName.includes("自身體重") || rawExerciseName.includes("自重")) {
        weightType = "bodyweight";
      } else if (rawExerciseName.includes("輔助") || rawExerciseName.includes("越重越容易")) {
        weightType = "assisted_inverse";
      } else if (rawExerciseName.includes("機") || rawExerciseName.includes("滑輪")) {
        weightType = "machine_stack";
      }

      // 標準化動作名稱 (去掉後面的括號備註作為標準 key)
      const cleanName = rawExerciseName.replace(/\(.*?\)/g, "").replace(/（.*?）/g, "").trim();
      const exerciseKey = cleanName.toLowerCase();

      if (!exerciseMap.has(exerciseKey)) {
        exerciseMap.set(exerciseKey, {
          id: `ex-${exerciseMap.size + 1}`,
          name: cleanName,
          muscle_group: muscleGroup,
          weight_type: weightType,
          default_notes: rawExerciseName.includes("(") ? rawExerciseName : undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: "synced",
        });
      }

      currentExercise = exerciseMap.get(exerciseKey)!;
      continue;
    }

    // 5. 抓取組數記錄 (Sets)
    if (currentSession && currentExercise && (line.startsWith("-") || line.startsWith("set") || line.includes("Kg x") || line.includes("自身體重 x"))) {
      currentSessionSetOrder++;
      const cleanSetLine = line.replace(/^-\s*/, "");

      let setType: SetType = "normal";
      if (cleanSetLine.includes("熱身") || cleanSetLine.includes("神經激發")) setType = "warmup";
      else if (cleanSetLine.includes("遞減")) setType = "drop";

      // 提取主重量與次數
      let weight = 0;
      let reps = 0;

      const mainPart = cleanSetLine.split("+")[0];
      const weightMatch = mainPart.match(/(\d+(?:\.\d+)?)\s*Kg(?:\([^\)]+\))?\s*x(\d+)/i);
      const repsMatch = mainPart.match(/(?:自身體重|0Kg)?\s*x(\d+)/i);

      if (weightMatch) {
        weight = parseFloat(weightMatch[1]);
        reps = parseInt(weightMatch[2], 10);
      } else if (repsMatch) {
        weight = 0;
        reps = parseInt(repsMatch[1], 10);
      }

      // 提取強迫次數/補次 (如 "+ 補2" 或 "補4" 或 "輔助2")
      let forcedReps = 0;
      const forcedMatch = cleanSetLine.match(/[+＋]?\s*(?:補|輔助|輔)\s*(\d+)/);
      if (forcedMatch) {
        forcedReps = parseInt(forcedMatch[1], 10);
      }

      // 提取休息暫停詳細資訊
      let restPauseDetail: string | undefined = undefined;
      if (cleanSetLine.includes("+ 休") || cleanSetLine.includes("+ 休息") || cleanSetLine.includes("遞減")) {
        const plusParts = cleanSetLine.split("+");
        if (plusParts.length > 1) {
          restPauseDetail = plusParts.slice(1).join("+").trim();
        }
      }

      // 體感回饋
      const feedbackMatch = cleanSetLine.match(/\((.*?)\)/);
      const feedback = feedbackMatch ? feedbackMatch[1] : undefined;

      const setItem: SetItem = {
        id: `set-${currentSession.id}-${currentSessionSetOrder}`,
        session_id: currentSession.id,
        exercise_id: currentExercise.id,
        set_order: currentSessionSetOrder,
        set_type: setType,
        weight_kg: weight,
        reps: reps,
        raw_text: cleanSetLine,
        rest_pause_detail: restPauseDetail,
        forced_reps: forcedReps > 0 ? forcedReps : undefined,
        is_failure: cleanSetLine.includes("力竭"),
        feedback: feedback,
        created_at: currentSession.created_at,
        updated_at: currentSession.updated_at,
        sync_status: "synced",
      };

      sets.push(setItem);
    }
  }

  return {
    bigThree,
    sessions,
    exercises: Array.from(exerciseMap.values()),
    sets,
  };
}

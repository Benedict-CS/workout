import type { WorkoutSession, SetItem, Exercise, BigThreeRecord } from "./types";
import { cleanSessionTitle } from "./workout-utils";

/**
 * 將單次訓練 Session 格式化為使用者的標準 Markdown 結構
 * 格式範例：
 * <details>
 * <summary><b>10/11 (胸) - 交大健身房 - 第 6 次</b></summary>
 * - 啞鈴上斜臥推 (單邊重量)：
 *   - set 1: 25Kg x10
 *   - set 2: 22.5Kg x9
 * - 槓鈴臥推：
 *   - 20Kg x10 熱身
 *   - set 1: 60Kg x8
 * </details>
 */
export function formatSessionToMarkdown(
  session: WorkoutSession,
  sets: SetItem[],
  exercises: Exercise[]
): string {
  const exMap = new Map<string, Exercise>();
  for (const ex of exercises) {
    exMap.set(ex.id, ex);
  }

  // 整理標題 (含場地與次數)
  let summaryTitle = cleanSessionTitle(session.display_title, session.target_muscle);
  // 如果 display_title 沒帶場地但 session.location 有值，補上場地
  if (session.location && !summaryTitle.includes(session.location)) {
    const parts = summaryTitle.split(" - ");
    if (parts.length >= 2) {
      summaryTitle = `${parts[0]} - ${session.location} - ${parts.slice(1).join(" - ")}`;
    } else {
      summaryTitle = `${summaryTitle} - ${session.location}`;
    }
  }

  // 如果是游泳紀錄，依個人筆記格式輸出簡潔的活動項目 (如: - 下午游泳)
  if (session.target_muscle.includes("游泳")) {
    const lines: string[] = [];
    lines.push("<details>");
    lines.push(`<summary><b>${summaryTitle}</b></summary>`);
    if (sets.length === 0) {
      lines.push("- 游泳");
    } else {
      for (const s of sets) {
        let text = s.notes || s.raw_text?.replace(/^-+\s*/, "") || "游泳";
        if (text.startsWith("set ")) {
          text = s.notes || "游泳";
        }
        lines.push(`- ${text}`);
      }
    }
    lines.push("");
    lines.push("</details>");
    return lines.join("\n");
  }

  // 依動作群組化
  const groupedSets: { exercise: Exercise | undefined; sets: SetItem[] }[] = [];
  const exerciseIdOrder: string[] = [];

  for (const s of sets) {
    if (!exerciseIdOrder.includes(s.exercise_id)) {
      exerciseIdOrder.push(s.exercise_id);
    }
  }

  function isWarmupCheck(st: SetItem): boolean {
    if (st.set_type === "warmup") return true;
    const r = st.raw_text || "";
    const n = st.notes || "";
    return (
      r.includes("熱身") ||
      r.includes("激發") ||
      r.includes("試重") ||
      n.includes("熱身") ||
      n.includes("激發") ||
      n.includes("試重")
    );
  }

  for (const exId of exerciseIdOrder) {
    const ex = exMap.get(exId);
    const exSets = sets.filter((s) => s.exercise_id === exId);
    // 嚴格排序：熱身/激發組永遠在最前面，正式組依序排在後方！
    const sortedSets = [...exSets].sort((a, b) => {
      const aW = isWarmupCheck(a);
      const bW = isWarmupCheck(b);
      if (aW && !bW) return -1;
      if (!aW && bW) return 1;
      return a.set_order - b.set_order;
    });
    groupedSets.push({ exercise: ex, sets: sortedSets });
  }

  const lines: string[] = [];
  lines.push("<details>");
  lines.push(`<summary><b>${summaryTitle}</b></summary>`);

  for (const group of groupedSets) {
    const exName = group.exercise?.name || "自訂動作";
    let exSuffix = "";
    if (group.exercise?.weight_type === "dumbbell_single") {
      exSuffix = " (單邊重量)";
    } else if (group.exercise?.weight_type === "assisted_inverse") {
      exSuffix = " (重量越重越容易)";
    }

    lines.push(`- ${exName}${exSuffix}：`);

    let formalSetCount = 0;
    for (const s of group.sets) {
      let setLabel = "";
      let note = "";

      const raw = s.raw_text || "";
      const notes = s.notes || "";
      const isWarmupOrActivation =
        s.set_type === "warmup" ||
        raw.includes("熱身") ||
        raw.includes("激發") ||
        raw.includes("試重") ||
        notes.includes("熱身") ||
        notes.includes("激發") ||
        notes.includes("試重");

      if (isWarmupOrActivation) {
        setLabel = "";
        if (!raw.includes("熱身") && !raw.includes("激發") && !raw.includes("試重") && !notes.includes("熱身")) {
          note = " 熱身";
        }
      } else {
        formalSetCount += 1;
        setLabel = `set ${formalSetCount}: `;
      }

      if (s.is_failure && !s.notes?.includes("力竭")) {
        note += " 完全力竭";
      }
      if (s.set_type === "drop" && !s.notes?.includes("遞減組")) {
        note += " (遞減組)";
      }
      const cleanFeedback = s.feedback ? s.feedback.replace(/\|?completed/g, "").trim() : "";
      if (cleanFeedback || s.notes) {
        const extra = cleanFeedback || s.notes;
        if (!note.includes(extra!)) {
          note += ` (${extra})`;
        }
      }

      let subText = "";
      if (s.sub_fields && s.sub_fields.length > 0) {
        subText = " " + s.sub_fields.map((sf) => {
          const typeLabel = sf.mode || "休";
          return `+ ${typeLabel}${sf.weight_kg ? ` ${sf.weight_kg}Kg` : ""} x${sf.reps}`;
        }).join(" ");
      }

      // 乾淨移除 raw_text 殘留的舊 set \d+: 字樣，依當前動作內順序加上正確 setLabel (熱身不帶 set，正式組自 set 1 起算)
      if (s.raw_text && s.raw_text.includes("Kg") && !s.sub_fields?.length) {
        const cleanBody = s.raw_text.replace(/^set\s*\d+:\s*/i, "").trim();
        lines.push(`  - ${setLabel}${cleanBody}`);
      } else {
        lines.push(`  - ${setLabel}${s.weight_kg}Kg x${s.reps}${subText}${note}`);
      }
    }
  }

  lines.push("");
  lines.push("</details>");
  return lines.join("\n");
}

/**
 * 匯出全庫所有訓練紀錄為一份完整的 Markdown 日誌 (與 Text document.md 100% 格式相符)
 */
export function exportAllSessionsToMarkdown(
  sessions: WorkoutSession[],
  allSets: SetItem[],
  exercises: Exercise[],
  bigThree: BigThreeRecord | null
): string {
  const lines: string[] = [];

  lines.push("# 訓練日誌");
  lines.push("");
  lines.push("## 📊 基本三項數據紀錄");
  lines.push("");
  lines.push(`* **硬舉**：${bigThree?.deadlift_kg ?? 90}Kg （${bigThree?.deadlift_ratio ?? 1.42}倍）`);
  lines.push(`* **深蹲**：${bigThree?.squat_kg ?? 90}Kg （${bigThree?.squat_ratio ?? 1.42}倍）`);
  lines.push(`* **臥推**：${bigThree?.bench_press_kg ?? 60}Kg （${bigThree?.bench_ratio ?? 0.94}倍）`);
  lines.push(`* **三項總和**：${bigThree?.total_kg ?? 240}Kg`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // 按月份群組排序 (最新月或遞增)
  const monthMap = new Map<string, WorkoutSession[]>();
  // 按照日期正序排列（與歷史筆記月份流向一致）
  const sortedSessions = [...sessions].sort((a, b) => a.date.localeCompare(b.date));

  for (const s of sortedSessions) {
    const mk = s.month_key; // e.g. "2026-06"
    if (!monthMap.has(mk)) monthMap.set(mk, []);
    monthMap.get(mk)!.push(s);
  }

  for (const [mk, mSessions] of monthMap.entries()) {
    const monthNum = parseInt(mk.split("-")[1], 10);

    // 統計當月部位次數
    let chestCount = 0;
    let backCount = 0;
    let legCount = 0;
    let shoulderCount = 0;
    let swimCount = 0;

    for (const s of mSessions) {
      if (s.target_muscle.includes("胸")) chestCount++;
      else if (s.target_muscle.includes("背")) backCount++;
      else if (s.target_muscle.includes("腿")) legCount++;
      else if (s.target_muscle.includes("肩")) shoulderCount++;
      else if (s.target_muscle.includes("游泳") || s.target_muscle.includes("泳")) swimCount++;
    }

    const countsDesc = [];
    if (chestCount > 0) countsDesc.push(`胸: ${chestCount}`);
    if (backCount > 0) countsDesc.push(`背: ${backCount}`);
    if (legCount > 0) countsDesc.push(`腿: ${legCount}`);
    if (shoulderCount > 0) countsDesc.push(`肩: ${shoulderCount}`);
    if (swimCount > 0) countsDesc.push(`游泳: ${swimCount}`);

    lines.push(`# ${monthNum} 月份 (${countsDesc.join(", ")})`);
    lines.push("");

    for (const s of mSessions) {
      const sessSets = allSets
        .filter((setItem) => setItem.session_id === s.id && !setItem.deleted_at)
        .sort((a, b) => a.set_order - b.set_order);

      const snippet = formatSessionToMarkdown(s, sessSets, exercises);
      lines.push(snippet);
    }

    lines.push("");
  }

  return lines.join("\n");
}

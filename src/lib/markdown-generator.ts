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
    lines.push(""); // 必須有空行，以符合 HackMD 與標準 CommonMark 解析清單
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

  // 依動作群組化（先依 set_order 嚴格正序排列，確保動作先後順序與實際訓練 100% 一致）
  const sortedInputSets = [...sets].sort((a, b) => a.set_order - b.set_order);
  const groupedSets: { exercise: Exercise | undefined; sets: SetItem[] }[] = [];
  const exerciseIdOrder: string[] = [];

  for (const s of sortedInputSets) {
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
    const exSets = sortedInputSets.filter((s) => s.exercise_id === exId);
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
  lines.push(""); // 必須有空行，以讓 HackMD 正常識別內層 Markdown 清單語法

  if (session.notes?.trim()) {
    lines.push(`> 📝 備註：${session.notes.trim()}`);
    lines.push("");
  }

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
          if (sf.mode === "休") {
            // ⭐ 統一格式：若加強休組重量同主組重量或為 0/未填，重量無須重複出現，簡化為 "+ 休 + 5"
            if (sf.weight_kg !== undefined && sf.weight_kg > 0 && sf.weight_kg !== s.weight_kg) {
              return `+ 休 + ${sf.weight_kg}Kg x${sf.reps}`;
            }
            return `+ 休 + ${sf.reps}`;
          }
          if (sf.mode === "補") {
            return `+ 補${sf.reps}`;
          }
          if (sf.mode === "遞減") {
            return `+ ${sf.weight_kg || 0}Kg x${sf.reps} (遞減組)`;
          }
          return `+ ${sf.mode}${sf.weight_kg ? ` ${sf.weight_kg}Kg` : ""} x${sf.reps}`;
        }).join(" ");
      }

      // 乾淨移除 raw_text 殘留的舊 set \d+: 字樣，依當前動作內順序加上正確 setLabel (熱身不帶 set，正式組自 set 1 起算)
      const isBodyweight = group.exercise?.weight_type === "bodyweight" || exName.includes("自重");

      if (s.raw_text && !s.sub_fields?.length) {
        let cleanBody = s.raw_text.replace(/^set\s*\d+:\s*/i, "").trim();
        // ⭐ 自重動作：將 0Kg 替換為「自身體重」
        if (isBodyweight) {
          cleanBody = cleanBody.replace(/\b0Kg\b/gi, "自身體重");
        }
        // ⭐ 統一格式：若 "+ 休 + 25Kg x5" 與前置主重量 25Kg 相同，重量不用重複出現，簡化為 "+ 休 + 5"
        cleanBody = cleanBody.replace(/(\b(\d+(?:\.\d+)?)\s*Kg\s*x\s*\d+)\s*\+\s*休\s*\+\s*\2\s*Kg\s*x\s*(\d+)/gi, "$1 + 休 + $3");
        cleanBody = cleanBody.replace(/\+\s*休\s*(\d+)下/g, "+ 休 + $1");
        lines.push(`  - ${setLabel}${cleanBody}`);
      } else {
        const weightPart = isBodyweight && s.weight_kg === 0 ? "自身體重" : `${s.weight_kg}Kg`;
        lines.push(`  - ${setLabel}${weightPart} x${s.reps}${subText}${note}`);
      }
    }
  }

  lines.push("");
  lines.push("</details>");
  return lines.join("\n");
}

/**
 * 將單次訓練 Session 格式化為適合通訊軟體 (LINE/微信/IG/簡訊) 傳送的簡潔純文字
 */
export function formatSessionToPlainText(
  session: WorkoutSession,
  sets: SetItem[],
  exercises: Exercise[]
): string {
  const exMap = new Map<string, Exercise>();
  for (const ex of exercises) {
    exMap.set(ex.id, ex);
  }

  const title = cleanSessionTitle(session.display_title, session.target_muscle);
  const lines: string[] = [];
  lines.push(`💪 ${title}`);
  if (session.location) lines.push(`📍 地點：${session.location}`);
  if (session.notes?.trim()) lines.push(`📝 備註：${session.notes.trim()}`);
  lines.push("");

  if (session.target_muscle.includes("游泳")) {
    if (sets.length === 0) {
      lines.push("• 游泳訓練");
    } else {
      for (const s of sets) {
        const text = s.notes || s.raw_text?.replace(/^-+\s*/, "") || "游泳";
        lines.push(`• ${text}`);
      }
    }
    return lines.join("\n");
  }

  const sortedSets = [...sets].sort((a, b) => a.set_order - b.set_order);
  const exerciseIdOrder: string[] = [];
  for (const s of sortedSets) {
    if (!exerciseIdOrder.includes(s.exercise_id)) {
      exerciseIdOrder.push(s.exercise_id);
    }
  }

  for (const exId of exerciseIdOrder) {
    const ex = exMap.get(exId);
    const exSets = sortedSets.filter((s) => s.exercise_id === exId);
    const exName = ex?.name || "動作";

    const setSummaries: string[] = [];
    for (const s of exSets) {
      const cleanBody = s.raw_text
        ? s.raw_text.replace(/^set\s*\d+:\s*/i, "").trim()
        : s.weight_kg > 0
        ? `${s.weight_kg}kg x ${s.reps}`
        : `${s.reps}下`;
      setSummaries.push(cleanBody);
    }

    lines.push(`• ${exName}:`);
    lines.push(`  ${setSummaries.join(" | ")}`);
  }

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
    let armCount = 0;
    let coreCount = 0;
    let swimCount = 0;

    for (const s of mSessions) {
      if (s.target_muscle.includes("胸")) chestCount++;
      else if (s.target_muscle.includes("背")) backCount++;
      else if (s.target_muscle.includes("腿")) legCount++;
      else if (s.target_muscle.includes("肩")) shoulderCount++;
      else if (s.target_muscle.includes("臂") || s.target_muscle.includes("二頭") || s.target_muscle.includes("三頭")) armCount++;
      else if (s.target_muscle.includes("核") || s.target_muscle.includes("腹")) coreCount++;
      else if (s.target_muscle.includes("游泳") || s.target_muscle.includes("泳")) swimCount++;
    }

    const countsDesc = [];
    if (chestCount > 0) countsDesc.push(`胸: ${chestCount}`);
    if (backCount > 0) countsDesc.push(`背: ${backCount}`);
    if (legCount > 0) countsDesc.push(`腿: ${legCount}`);
    if (shoulderCount > 0) countsDesc.push(`肩: ${shoulderCount}`);
    if (armCount > 0) countsDesc.push(`手臂: ${armCount}`);
    if (coreCount > 0) countsDesc.push(`核心: ${coreCount}`);
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

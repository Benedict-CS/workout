"use client";

import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  TrendingUp,
  History,
  Timer,
  Play,
  Pause,
  RotateCcw,
  X,
  Dumbbell,
  Pencil,
  MapPin,
  Copy,
  FileText,
  Repeat,
  Check,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Search,
  Zap,
} from "lucide-react";
import { db } from "@/lib/db/schema";
import {
  getLastExerciseSets,
  getPreviousSessionTemplate,
  getExerciseHistorySessions,
} from "@/lib/db/crud";
import { formatSessionToMarkdown } from "@/lib/markdown-generator";
import { runFullSync, deleteRemoteSession, deleteRemoteSet } from "@/lib/db/sync";
import type { Exercise, SetItem, WorkoutSession, WeightType, SetType, SetSubField } from "@/lib/types";

const LOCATION_OPTIONS = [
  "三健客",
  "交大健身房",
  "交大游泳池",
];

export default function WorkoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sets, setSets] = useState<SetItem[]>([]);
  const [ghostMap, setGhostMap] = useState<Record<string, SetItem[]>>({});

  // 場次編輯
  const [showEditSessionModal, setShowEditSessionModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTargetMuscle, setEditTargetMuscle] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [showLocationQuickPicker, setShowLocationQuickPicker] = useState(false);

  // Markdown Modal
  const [showMarkdownModal, setShowMarkdownModal] = useState(false);
  const [copyToast, setCopyToast] = useState(false);

  // 單組編輯狀態 (支援多欄位)
  const [editingSet, setEditingSet] = useState<SetItem | null>(null);
  const [editSetWeight, setEditSetWeight] = useState("");
  const [editSetReps, setEditSetReps] = useState("");
  const [editSetType, setEditSetType] = useState<SetType>("normal");
  const [editSetSubFields, setEditSetSubFields] = useState<SetSubField[]>([]);
  const [editSetNotes, setEditSetNotes] = useState("");

  // 新增組數表單狀態
  const [selectedExId, setSelectedExId] = useState<string>("");
  const [inputWeight, setInputWeight] = useState<string>("");
  const [inputReps, setInputReps] = useState<string>("");
  const [inputType, setInputType] = useState<SetType>("normal"); // 正式, 熱身, 遞減
  const [inputSubFields, setInputSubFields] = useState<SetSubField[]>([]);
  const [inputNotes, setInputNotes] = useState<string>("");

  // 動作列表過濾與搜尋
  const [dockExerciseSearch, setDockExerciseSearch] = useState<string>("");

  // 休息計時器狀態 (純視覺，無音效震動)
  const [targetEndTime, setTargetEndTime] = useState<number | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const [defaultRestDuration, setDefaultRestDuration] = useState<number>(150); // 預設 2 分半 (150秒)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 動作歷史記錄 Modal
  const [viewHistoryEx, setViewHistoryEx] = useState<{
    exercise: Exercise;
    history: { session: WorkoutSession; sets: SetItem[] }[];
  } | null>(null);

  // 替換動作 Modal
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapSourceExercise, setSwapSourceExercise] = useState<Exercise | null>(null);
  const [swapSearchQuery, setSwapSearchQuery] = useState("");

  // 保持螢幕常亮 (Screen Wake Lock) - 訓練進行中手機不自動休眠黑屏
  const wakeLockRef = useRef<any>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function requestWakeLock() {
      if (typeof window !== "undefined" && "wakeLock" in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
          if (isMounted) setWakeLockActive(true);
          wakeLockRef.current.addEventListener("release", () => {
            if (isMounted) setWakeLockActive(false);
          });
        } catch {}
      }
    }
    requestWakeLock();

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (wakeLockRef.current) {
        try {
          wakeLockRef.current.release();
        } catch {}
        wakeLockRef.current = null;
      }
    };
  }, []);

  // 計時器倒數邏輯 (手動觸發，結束時輕微震動提醒)
  useEffect(() => {
    function checkTimer() {
      if (!targetEndTime || !timerActive) return;
      const now = Date.now();
      const remain = Math.ceil((targetEndTime - now) / 1000);
      if (remain <= 0) {
        setTimerSeconds(0);
        setTimerActive(false);
        setTargetEndTime(null);
        localStorage.removeItem("workout_timer_end");
        if (typeof window !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate([200, 100, 200]);
          } catch {}
        }
      } else {
        setTimerSeconds(remain);
      }
    }

    if (timerActive && targetEndTime) {
      checkTimer();
      timerIntervalRef.current = setInterval(checkTimer, 500);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [timerActive, targetEndTime]);

  function startRestTimer(seconds: number) {
    const end = Date.now() + seconds * 1000;
    setTargetEndTime(end);
    setTimerSeconds(seconds);
    setTimerActive(true);
    localStorage.setItem("workout_timer_end", end.toString());
    if (session) {
      const loc = session.location ? ` (${session.location})` : "";
      localStorage.setItem(
        "workout_timer_info",
        JSON.stringify({
          sessionId: session.id,
          title: `${session.target_muscle}${loc}`,
        })
      );
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("workout_timer_update"));
    }
  }

  function addRestSeconds(seconds: number) {
    if (!targetEndTime || !timerActive) {
      startRestTimer(seconds);
      return;
    }
    const newEnd = targetEndTime + seconds * 1000;
    const now = Date.now();
    const remain = Math.ceil((newEnd - now) / 1000);
    setTargetEndTime(newEnd);
    setTimerSeconds(remain);
    localStorage.setItem("workout_timer_end", newEnd.toString());
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("workout_timer_update"));
    }
  }

  function stopRestTimer() {
    setTimerActive(false);
    setTimerSeconds(null);
    setTargetEndTime(null);
    localStorage.removeItem("workout_timer_end");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("workout_timer_update"));
    }
  }

  // 載入當前 session 與數據
  useEffect(() => {
    async function load() {
      try {
        const sess = await db.sessions.get(id);
        if (!sess) {
          router.push("/");
          return;
        }
        setSession(sess);
        setEditTitle(sess.display_title);
        setEditDate(sess.date);
        setEditTargetMuscle(sess.target_muscle);
        setEditLocation(sess.location || "三健客");

        // 讀取所有動作，並排除「繩索夾胸」
        const allEx = await db.exercises
          .filter((e) => !e.deleted_at && !e.name.includes("繩索夾胸"))
          .toArray();
        setExercises(allEx);

        const currentSets = await db.sets
          .where("session_id")
          .equals(id)
          .filter((s) => !s.deleted_at)
          .sortBy("set_order");
        setSets(currentSets);

        // 讀取上次對照 ghost
        const distinctExIds = Array.from(new Set(currentSets.map((s) => s.exercise_id)));
        const ghostRecord: Record<string, SetItem[]> = {};
        for (const exId of distinctExIds) {
          const res = await getLastExerciseSets(exId, id);
          if (res) ghostRecord[exId] = res.sets;
        }
        setGhostMap(ghostRecord);

        // 初始化選取的動作
        if (distinctExIds.length > 0) {
          const initialExId = distinctExIds[0];
          setSelectedExId(initialExId);
          const exSets = currentSets.filter((s) => s.exercise_id === initialExId);
          if (exSets.length > 0) {
            const last = exSets[exSets.length - 1];
            setInputWeight(last.weight_kg.toString());
            setInputReps(last.reps.toString());
          }
        } else {
          // 根據部位選取第一個推薦動作
          const matchingEx = allEx.filter((e) => e.muscle_group === sess.target_muscle);
          const initial = matchingEx[0] || allEx[0];
          if (initial) {
            setSelectedExId(initial.id);
            const res = await getLastExerciseSets(initial.id, id);
            if (res && res.sets.length > 0) {
              const normalSet = res.sets.find((s) => s.set_type === "normal") || res.sets[0];
              setInputWeight(normalSet.weight_kg.toString());
              setInputReps(normalSet.reps.toString());
              setGhostMap((prev) => ({ ...prev, [initial.id]: res.sets }));
            }
          }
        }
      } catch (err) {
        console.error("Failed to load workout:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, router]);

  // 切換動作時智慧預填
  function handleSelectExercise(exId: string) {
    setSelectedExId(exId);
    setInputSubFields([]);
    const existingSets = sets.filter((s) => s.exercise_id === exId);
    if (existingSets.length > 0) {
      const last = existingSets[existingSets.length - 1];
      setInputWeight(last.weight_kg.toString());
      setInputReps(last.reps.toString());
    } else if (ghostMap[exId] && ghostMap[exId].length > 0) {
      const firstNormal = ghostMap[exId].find((s) => s.set_type === "normal") || ghostMap[exId][0];
      setInputWeight(firstNormal.weight_kg.toString());
      setInputReps(firstNormal.reps.toString());
    }
  }

  // 判定是否為熱身或激發/試重組 (不佔用正式組序號)
  function isWarmupOrActivation(s: SetItem): boolean {
    if (s.set_type === "warmup") return true;
    const raw = s.raw_text || "";
    const notes = s.notes || "";
    if (raw.includes("熱身") || raw.includes("激發") || raw.includes("試重")) return true;
    if (notes.includes("熱身") || notes.includes("激發") || notes.includes("試重")) return true;
    return false;
  }

  // 取得熱身組徽章標籤 (如：熱身、激發、試重)
  function getWarmupLabel(s: SetItem): string {
    const text = `${s.raw_text || ""} ${s.notes || ""}`;
    if (text.includes("神經激發") || text.includes("激發")) return "激發";
    if (text.includes("試重")) return "試重";
    return "熱身";
  }

  // 取得單組對應的上次做組紀錄 (Ghost Set 緊密對比)
  function getMatchingGhostSet(
    targetSet: SetItem,
    exSets: SetItem[],
    ghostSets?: SetItem[]
  ): SetItem | null {
    if (!ghostSets || ghostSets.length === 0) return null;
    const isWarmup = isWarmupOrActivation(targetSet);

    if (isWarmup) {
      const warmupSets = exSets.filter((s) => isWarmupOrActivation(s));
      const wIdx = warmupSets.findIndex((s) => s.id === targetSet.id);
      const ghostWarmups = ghostSets.filter((s) => isWarmupOrActivation(s));
      return ghostWarmups[wIdx] || null;
    } else {
      const formalSets = exSets.filter((s) => !isWarmupOrActivation(s));
      const fIdx = formalSets.findIndex((s) => s.id === targetSet.id);
      const ghostFormals = ghostSets.filter((s) => !isWarmupOrActivation(s));
      return ghostFormals[fIdx] || null;
    }
  }

  // 開啟替換動作 Modal (現場器材有人用時一鍵替換)
  function handleOpenSwapModal(ex?: Exercise) {
    if (!ex) return;
    setSwapSourceExercise(ex);
    setSwapSearchQuery("");
    setShowSwapModal(true);
  }

  // 確認替換動作：將原動作所有組數直接移轉至新動作
  async function handleConfirmSwapExercise(newEx: Exercise) {
    if (!swapSourceExercise || swapSourceExercise.id === newEx.id) {
      setShowSwapModal(false);
      return;
    }

    const oldExId = swapSourceExercise.id;
    const targetSets = sets.filter((s) => s.exercise_id === oldExId);
    if (targetSets.length === 0) {
      setShowSwapModal(false);
      return;
    }

    const updatedSets: SetItem[] = targetSets.map((s) => ({
      ...s,
      exercise_id: newEx.id,
      updated_at: new Date().toISOString(),
      sync_status: "pending" as const,
    }));

    await db.sets.bulkPut(updatedSets);
    setSets((prev) =>
      prev.map((s) =>
        s.exercise_id === oldExId
          ? { ...s, exercise_id: newEx.id, updated_at: new Date().toISOString(), sync_status: "pending" }
          : s
      )
    );

    // 載入新動作上次做組歷史
    getLastExerciseSets(newEx.id, id).then((res) => {
      if (res && res.sets.length > 0) {
        setGhostMap((prev) => ({ ...prev, [newEx.id]: res.sets }));
      }
    });

    if (!exercises.some((e) => e.id === newEx.id)) {
      setExercises((prev) => [...prev, newEx]);
    }

    runFullSync().catch(() => {});
    setShowSwapModal(false);
    setSwapSourceExercise(null);
  }

  // 格式化組數 raw_text
  function formatSetRawText(
    formalIndex: number,
    setType: SetType,
    weight: number,
    reps: number,
    subFields: SetSubField[] = [],
    notes = ""
  ): string {
    let mainPart = "";
    if (setType === "warmup") {
      if (notes.includes("激發") || notes.includes("試重")) {
        mainPart = `${weight}Kg x${reps}`;
      } else {
        mainPart = `${weight}Kg x${reps} 熱身`;
      }
    } else if (setType === "drop" && subFields.length === 0) {
      mainPart = `set ${formalIndex}: ${weight}Kg x${reps} (遞減組)`;
    } else {
      mainPart = `set ${formalIndex}: ${weight}Kg x${reps}`;
    }

    const subParts = subFields.map((sub) => {
      if (sub.mode === "休") {
        return sub.weight_kg !== undefined && sub.weight_kg > 0
          ? `+ 休 + ${sub.weight_kg}Kg x${sub.reps}`
          : `+ 休 ${sub.reps}下`;
      }
      if (sub.mode === "補") {
        return `+ 補${sub.reps}`;
      }
      if (sub.mode === "遞減") {
        return `+ ${sub.weight_kg || 0}Kg x${sub.reps} (遞減組)`;
      }
      return "";
    }).filter(Boolean);

    let full = [mainPart, ...subParts].join(" ");
    if (notes.trim()) {
      full += ` ${notes.trim()}`;
    }
    return full;
  }

  // 快速新增單組
  async function handleAddSet() {
    if (!selectedExId || !inputReps) return;
    const repsNum = parseInt(inputReps, 10) || 0;
    if (repsNum <= 0) return;

    const newOrder = sets.length + 1;
    const weightNum = parseFloat(inputWeight) || 0;

    const exSets = sets.filter((s) => s.exercise_id === selectedExId);
    const formalIndex = inputType === "warmup" ? 0 : exSets.filter((s) => !isWarmupOrActivation(s)).length + 1;

    const raw = formatSetRawText(
      formalIndex,
      inputType,
      weightNum,
      repsNum,
      inputSubFields,
      inputNotes
    );

    const newSet: SetItem = {
      id: `set-${Date.now()}-${newOrder}`,
      session_id: id,
      exercise_id: selectedExId,
      set_order: newOrder,
      set_type: inputType,
      weight_kg: weightNum,
      reps: repsNum,
      raw_text: raw,
      sub_fields: inputSubFields.length > 0 ? inputSubFields : undefined,
      notes: inputNotes || undefined,
      is_completed: true,
      feedback: "completed",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.sets.add(newSet);
    setSets((prev) => [...prev, newSet]);
    runFullSync().catch(() => {});

    // 重設子欄位
    setInputSubFields([]);
    setInputNotes("");
  }

  // 重複上一組
  async function handleRepeatLastSet() {
    if (!selectedExId) return;
    const exSets = sets.filter((s) => s.exercise_id === selectedExId);
    if (exSets.length === 0) return;
    const last = exSets[exSets.length - 1];

    const newOrder = sets.length + 1;
    const formalIndex = isWarmupOrActivation(last) ? 0 : exSets.filter((s) => !isWarmupOrActivation(s)).length + 1;
    const raw = formatSetRawText(
      formalIndex,
      last.set_type,
      last.weight_kg,
      last.reps,
      last.sub_fields,
      last.notes || ""
    );

    const newSet: SetItem = {
      id: `set-${Date.now()}-${newOrder}`,
      session_id: id,
      exercise_id: selectedExId,
      set_order: newOrder,
      set_type: last.set_type,
      weight_kg: last.weight_kg,
      reps: last.reps,
      raw_text: raw,
      sub_fields: last.sub_fields,
      notes: last.notes,
      is_completed: true,
      feedback: "completed",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.sets.add(newSet);
    setSets((prev) => [...prev, newSet]);
    runFullSync().catch(() => {});
  }

  // 檢查組數是否已完成
  function isSetCompleted(s: SetItem, sessionDate?: string): boolean {
    if (s.is_completed === true) return true;
    if (s.is_completed === false) return false;
    if (s.feedback && s.feedback.includes("completed")) return true;
    const today = new Date().toISOString().split("T")[0];
    if (sessionDate && sessionDate < today) return true;
    return false;
  }

  // 標記/切換單組完成狀態 (一組一組往下做，由使用者自主決定何時手動觸發休息)
  async function handleToggleSetCompleted(setId: string) {
    const target = sets.find((s) => s.id === setId);
    if (!target) return;

    const currentStatus = isSetCompleted(target, session?.date);
    const newStatus = !currentStatus;

    const updated: SetItem = {
      ...target,
      is_completed: newStatus,
      feedback: newStatus
        ? (target.feedback ? `${target.feedback.replace(/\|?completed/g, "")}|completed` : "completed")
        : (target.feedback ? target.feedback.replace(/\|?completed/g, "").trim() || undefined : undefined),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.sets.put(updated);
    setSets((prev) => prev.map((s) => (s.id === setId ? updated : s)));
    runFullSync().catch(() => {});
  }

  // 更換動作順序 (上移 / 下移) - 當健身房器材有人使用時可彈性調換
  async function handleMoveExercise(exIdx: number, direction: "up" | "down") {
    const targetIdx = direction === "up" ? exIdx - 1 : exIdx + 1;
    if (targetIdx < 0 || targetIdx >= setsByExercise.length) return;

    const currentOrderIds = setsByExercise.map((item) => item.exercise?.id).filter(Boolean) as string[];
    const [movedId] = currentOrderIds.splice(exIdx, 1);
    currentOrderIds.splice(targetIdx, 0, movedId);

    // 依據調換後的新動作順序，重新編排所有 sets 的 set_order
    let currentOrder = 1;
    const newSetsList: SetItem[] = [];

    for (const exId of currentOrderIds) {
      const exSets = sets.filter((s) => s.exercise_id === exId);
      for (const st of exSets) {
        newSetsList.push({
          ...st,
          set_order: currentOrder++,
          updated_at: new Date().toISOString(),
          sync_status: "pending",
        });
      }
    }

    // 補齊未匹配到的組數 (邊緣情況保護)
    const remainingSets = sets.filter((s) => !currentOrderIds.includes(s.exercise_id));
    for (const st of remainingSets) {
      newSetsList.push({
        ...st,
        set_order: currentOrder++,
        updated_at: new Date().toISOString(),
        sync_status: "pending",
      });
    }

    await db.sets.bulkPut(newSetsList);
    setSets(newSetsList);
    runFullSync().catch(() => {});
  }

  // 乾淨格式化組數文字（過濾掉殘留的舊 set X: 字樣）
  function cleanSetDisplay(s: SetItem): string {
    if (s.raw_text) {
      const cleaned = s.raw_text.replace(/^set\s*\d+:\s*/i, "").trim();
      if (cleaned) return cleaned;
    }
    return `${s.weight_kg}Kg x ${s.reps}`;
  }

  // 結束 / 完成本次訓練並返回首頁
  async function handleFinishWorkout() {
    // 1. 自動清除任何誤加的空組數 (0Kg x 0下)
    const emptySets = sets.filter(
      (s) => s.weight_kg === 0 && s.reps === 0 && !s.sub_fields?.length && session?.target_muscle !== "游泳"
    );
    if (emptySets.length > 0) {
      await db.sets.bulkDelete(emptySets.map((s) => s.id));
      setSets((prev) => prev.filter((s) => !emptySets.some((e) => e.id === s.id)));
    }

    // 2. 觸發完整同步
    runFullSync().catch(() => {});

    // 3. 返回首頁
    router.push("/");
  }

  // 記錄游泳 (3 個快選：早上游、下午游、晚上游)
  async function handleLogSwim(swimTimeLabel: string) {
    let swimEx = exercises.find((e) => e.id === "ex-swim" || e.name === "游泳");
    if (!swimEx) {
      swimEx = await db.exercises.get("ex-swim");
      if (!swimEx) {
        swimEx = {
          id: "ex-swim",
          name: "游泳",
          muscle_group: "游泳",
          weight_type: "bodyweight",
          is_favorite: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: "pending",
        };
        await db.exercises.put(swimEx);
      }
      setExercises((prev) => [...prev, swimEx!]);
    }
    const newOrder = sets.length + 1;
    const newSet: SetItem = {
      id: `set-${Date.now()}-${newOrder}`,
      session_id: id,
      exercise_id: swimEx ? swimEx.id : "ex-swim",
      set_order: newOrder,
      set_type: "normal",
      weight_kg: 0,
      reps: 1,
      raw_text: `${swimTimeLabel} (${session?.location || "交大游泳池"})`,
      notes: swimTimeLabel,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.sets.add(newSet);
    setSets((prev) => [...prev, newSet]);
    runFullSync().catch(() => {});
  }

  // 刪除組數
  async function handleDeleteSet(setId: string) {
    if (!confirm("確定刪除此組？")) return;
    await db.sets.delete(setId);
    setSets((prev) => prev.filter((s) => s.id !== setId));
    deleteRemoteSet(setId).catch(() => {});
    runFullSync().catch(() => {});
  }

  // 刪除整個動作組 (包含該動作的所有組數)
  async function handleDeleteEntireExercise(exId?: string, exName?: string, count?: number) {
    if (!exId) return;
    const targetName = exName || "此動作";
    const toDelete = sets.filter((s) => s.exercise_id === exId);
    if (toDelete.length === 0) return;

    if (!confirm(`確定要刪除整個動作【${targetName}】及其所有 ${toDelete.length} 組紀錄嗎？`)) {
      return;
    }

    const remaining = sets.filter((s) => s.exercise_id !== exId);
    let currentOrder = 1;
    const reordered: SetItem[] = remaining.map((s) => ({
      ...s,
      set_order: currentOrder++,
      updated_at: new Date().toISOString(),
      sync_status: "pending" as const,
    }));

    await db.transaction("rw", [db.sets], async () => {
      await db.sets.bulkDelete(toDelete.map((s) => s.id));
      if (reordered.length > 0) {
        await db.sets.bulkPut(reordered);
      }
    });

    setSets(reordered);

    // 同步至雲端刪除
    toDelete.forEach((s) => {
      deleteRemoteSet(s.id).catch(() => {});
    });
    runFullSync().catch(() => {});
  }

  // 開啟修改單組
  function handleStartEditSet(s: SetItem) {
    setEditingSet(s);
    setEditSetWeight(s.weight_kg.toString());
    setEditSetReps(s.reps.toString());
    setEditSetType(s.set_type);
    setEditSetSubFields(s.sub_fields ? [...s.sub_fields] : []);
    setEditSetNotes(s.notes || "");
  }

  // 儲存修改單組
  async function handleSaveEditSet() {
    if (!editingSet) return;
    const w = parseFloat(editSetWeight) || 0;
    const r = parseInt(editSetReps, 10) || 0;

    const exSets = sets.filter((s) => s.exercise_id === editingSet.exercise_id);
    const formalIndex = editSetType === "warmup" ? 0 : exSets.filter((s) => s.id !== editingSet.id && !isWarmupOrActivation(s)).length + 1;

    const raw = formatSetRawText(
      formalIndex,
      editSetType,
      w,
      r,
      editSetSubFields,
      editSetNotes
    );

    const updated: SetItem = {
      ...editingSet,
      weight_kg: w,
      reps: r,
      set_type: editSetType,
      raw_text: raw,
      sub_fields: editSetSubFields.length > 0 ? editSetSubFields : undefined,
      notes: editSetNotes || undefined,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.sets.put(updated);
    setSets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setEditingSet(null);
    runFullSync().catch(() => {});
  }

  // 快速切換場地
  async function handleQuickUpdateLocation(newLoc: string) {
    if (!session) return;
    let newTitle = session.display_title;
    if (session.location && newTitle.includes(session.location)) {
      newTitle = newTitle.replace(session.location, newLoc);
    } else {
      const parts = newTitle.split(" - ");
      if (parts.length >= 2) {
        newTitle = `${parts[0]} - ${newLoc} - ${parts.slice(1).join(" - ")}`;
      } else {
        newTitle = `${newTitle} - ${newLoc}`;
      }
    }

    const updated: WorkoutSession = {
      ...session,
      location: newLoc,
      display_title: newTitle,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.sessions.put(updated);
    setSession(updated);
    setShowLocationQuickPicker(false);
    runFullSync().catch(() => {});
  }

  // 一鍵複製 Markdown
  function handleCopyMarkdown() {
    if (!session) return;
    const md = formatSessionToMarkdown(session, sets, exercises);
    navigator.clipboard.writeText(md);
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2000);
  }

  // 刪除整場
  async function handleDeleteEntireSession() {
    if (!confirm(`確定要刪除這場訓練【${session?.display_title}】嗎？`)) return;
    await db.transaction("rw", [db.sessions, db.sets], async () => {
      await db.sets.where("session_id").equals(id).delete();
      await db.sessions.delete(id);
    });
    deleteRemoteSession(id).catch(() => {});
    runFullSync().catch(() => {});
    router.push("/");
  }

  if (loading || !session) {
    return (
      <div className="flex justify-center items-center min-h-[50vh] text-gray-400">
        載入中...
      </div>
    );
  }

  // 依動作群組化顯示
  const setsByExercise: { exercise: Exercise | undefined; sets: SetItem[] }[] = [];
  const exerciseIdOrder: string[] = [];
  for (const s of sets) {
    if (!exerciseIdOrder.includes(s.exercise_id)) {
      exerciseIdOrder.push(s.exercise_id);
    }
  }
  for (const exId of exerciseIdOrder) {
    const ex = exercises.find((e) => e.id === exId);
    const exSets = sets.filter((s) => s.exercise_id === exId);
    setsByExercise.push({ exercise: ex, sets: exSets });
  }

  // 訓練整體進度與當前進行中組數 (一組一組往下做)
  const totalSetsCount = sets.length;
  const completedSetsCount = sets.filter((s) => isSetCompleted(s, session.date)).length;
  const progressPct = totalSetsCount > 0 ? Math.round((completedSetsCount / totalSetsCount) * 100) : 0;
  const nextUpSet = sets.find((s) => !isSetCompleted(s, session.date));
  const nextUpExercise = nextUpSet ? exercises.find((e) => e.id === nextUpSet.exercise_id) : null;

  // 當前進行中組數之歷史對照
  const nextUpGhost = nextUpSet
    ? getMatchingGhostSet(
        nextUpSet,
        sets.filter((s) => s.exercise_id === nextUpSet.exercise_id),
        ghostMap[nextUpSet.exercise_id]
      )
    : null;

  // 計算當日訓練總容量 (Total Volume，已排組數或進行中所有有重量之組數累積)
  const totalVolume = sets.reduce((sum, s) => {
    if (s.weight_kg <= 0 || s.reps <= 0) return sum;
    const ex = exercises.find((e) => e.id === s.exercise_id);
    const multiplier = ex?.weight_type === "dumbbell_single" ? 2 : 1;
    let setVol = s.weight_kg * s.reps;
    if (s.sub_fields && s.sub_fields.length > 0) {
      for (const sf of s.sub_fields) {
        if (sf.weight_kg && sf.reps) {
          setVol += sf.weight_kg * sf.reps;
        }
      }
    }
    return sum + setVol * multiplier;
  }, 0);

  // 動作過濾（排除繩索夾胸，只顯示對應部位或搜尋，並依動作名稱去重）
  const seenExNames = new Set<string>();
  const displayExercises = exercises.filter((e) => {
    if (e.name.includes("繩索夾胸")) return false;
    if (dockExerciseSearch.trim()) {
      if (!e.name.toLowerCase().includes(dockExerciseSearch.trim().toLowerCase())) return false;
    } else if (e.muscle_group !== session.target_muscle) {
      return false;
    }
    if (seenExNames.has(e.name)) return false;
    seenExNames.add(e.name);
    return true;
  });

  return (
    <div className="space-y-4 pb-28">
      {/* 頂部導覽列 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            className="p-2 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] rounded-xl text-gray-300"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-base font-black text-white">{session.display_title}</h1>
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5 relative">
              <span>{session.date}</span>
              <span>•</span>
              <button
                type="button"
                onClick={() => setShowLocationQuickPicker((p) => !p)}
                className="flex items-center gap-1 text-emerald-400 font-bold bg-[#181b26] px-2 py-0.5 rounded-lg border border-[#262b3d]"
              >
                <MapPin className="w-3 h-3" />
                <span>{session.location || "三健客"}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {/* 螢幕常亮標記 */}
              {wakeLockActive && (
                <span
                  className="text-[10px] text-amber-300 font-bold bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0"
                  title="訓練期間螢幕保持常亮，不自動休眠黑屏"
                >
                  <span>🔆</span>
                  <span className="hidden sm:inline">螢幕常亮</span>
                </span>
              )}

              {/* 切換場地下拉 (只可切換三健客、交大健身房、交大游泳池) */}
              {showLocationQuickPicker && (
                <div className="absolute top-6 left-12 z-30 bg-[#12141c] border border-emerald-500/40 rounded-xl p-1.5 shadow-2xl space-y-1 text-xs min-w-[130px]">
                  {LOCATION_OPTIONS.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => handleQuickUpdateLocation(loc)}
                      className={`w-full text-left px-2 py-1 rounded-lg text-xs ${
                        session.location === loc
                          ? "bg-emerald-500 text-black font-black"
                          : "text-gray-300 hover:bg-[#181b26]"
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleFinishWorkout}
            className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-black flex items-center gap-1.5 shadow active:scale-95 cursor-pointer"
            title="完成本次訓練並返回首頁"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>完成訓練</span>
          </button>

          <button
            onClick={handleCopyMarkdown}
            className="p-2 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1"
            title="複製 Markdown"
          >
            <Copy className="w-4 h-4" />
            <span className="hidden sm:inline">複製</span>
          </button>

          <button
            onClick={() => setShowMarkdownModal(true)}
            className="p-2 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] text-gray-300 rounded-xl"
            title="檢視 Markdown"
          >
            <FileText className="w-4 h-4" />
          </button>

          <button
            onClick={handleDeleteEntireSession}
            className="p-2 bg-[#12141c] hover:bg-red-950/40 border border-[#262b3d] text-gray-400 hover:text-red-400 rounded-xl"
            title="刪除訓練"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {copyToast && (
        <div className="bg-emerald-500 text-black px-4 py-2 rounded-xl text-xs font-black shadow-2xl flex items-center gap-2">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>已複製 Markdown！</span>
        </div>
      )}

      {/* 休息計時器控制列 (重訓專用，手動點擊觸發) */}
      {session.target_muscle !== "游泳" && (
        <div className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-3 flex items-center justify-between text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <Timer className={`w-4 h-4 ${timerActive ? "text-amber-400 animate-pulse" : "text-gray-400"}`} />
            <span className="font-bold text-gray-200">休息計時：</span>
            {timerActive && timerSeconds !== null && timerSeconds > 0 ? (
              <span className="text-amber-400 font-mono font-black text-sm animate-pulse">
                {Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, "0")}
              </span>
            ) : timerSeconds === 0 ? (
              <span className="text-emerald-400 font-bold">時間到！</span>
            ) : (
              <span className="text-gray-500">手動點擊啟動</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {timerActive ? (
              <>
                <button
                  type="button"
                  onClick={() => addRestSeconds(30)}
                  className="px-2.5 py-1 bg-[#181b26] hover:bg-[#202533] border border-amber-500/40 text-amber-300 rounded-lg text-[11px] font-bold active:scale-95 cursor-pointer"
                  title="延長 30 秒休息"
                >
                  +30秒
                </button>
                <button
                  type="button"
                  onClick={stopRestTimer}
                  className="px-2 py-1 bg-red-950/30 hover:bg-red-900/50 border border-red-500/30 text-red-300 rounded-lg text-[11px] font-bold flex items-center gap-1 active:scale-95 cursor-pointer"
                  title="結束休息計時"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>結束</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => startRestTimer(90)}
                  className="px-2 py-1 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-300 hover:text-white rounded-lg text-[11px] font-bold active:scale-95 cursor-pointer"
                >
                  1.5分
                </button>
                <button
                  type="button"
                  onClick={() => startRestTimer(120)}
                  className="px-2 py-1 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-300 hover:text-white rounded-lg text-[11px] font-bold active:scale-95 cursor-pointer"
                >
                  2分
                </button>
                <button
                  type="button"
                  onClick={() => startRestTimer(150)}
                  className="px-2.5 py-1 bg-[#181b26] hover:bg-[#202533] border border-amber-500/40 text-amber-300 rounded-lg text-[11px] font-black active:scale-95 shadow-sm cursor-pointer"
                >
                  2.5分
                </button>
                <button
                  type="button"
                  onClick={() => startRestTimer(180)}
                  className="px-2 py-1 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-300 hover:text-white rounded-lg text-[11px] font-bold active:scale-95 cursor-pointer"
                >
                  3分
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 訓練進度看板 & 當前進行中組數 (重訓專用，一組一組往下做) */}
      {session.target_muscle !== "游泳" && totalSetsCount > 0 && (
        <div className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-3 shadow-md">
          <div className="flex items-center justify-between text-xs">
            <span className="font-black text-gray-200 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>訓練進度</span>
            </span>
            <span className="font-mono font-black text-emerald-400 text-xs">
              {completedSetsCount} / {totalSetsCount} 組 ({progressPct}%)
            </span>
          </div>

          {/* 進度條 */}
          <div className="w-full bg-[#181b26] h-2.5 rounded-full overflow-hidden border border-[#262b3d]/60">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300 shadow"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* 當前進行中組數提醒 */}
          {nextUpSet ? (
            <div className="bg-[#181b26] border border-emerald-500/50 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 shadow-sm">
              <div className="min-w-0">
                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 mb-0.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>當前進行中組數 ({(() => {
                    if (isWarmupOrActivation(nextUpSet)) {
                      return `${getWarmupLabel(nextUpSet)}組`;
                    }
                    const nextUpExSets = sets.filter((s) => s.exercise_id === nextUpSet.exercise_id);
                    const formalIdx = nextUpExSets
                      .slice(0, nextUpExSets.findIndex((s) => s.id === nextUpSet.id) + 1)
                      .filter((s) => !isWarmupOrActivation(s)).length;
                    return `第 #${formalIdx} 正式組`;
                  })()})</span>
                </div>
                <div className="text-sm font-black text-white truncate">
                  【{nextUpExercise?.name || "動作"}】
                  <span className="text-gray-300 font-bold ml-1.5">
                    {cleanSetDisplay(nextUpSet)}
                  </span>
                </div>

                {nextUpGhost && (
                  <div className="text-[11px] text-amber-300 font-medium flex items-center gap-1.5 mt-1">
                    <span className="text-gray-400">上次此組成績：</span>
                    <span className="bg-[#090a0f] text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 font-mono font-bold">
                      {cleanSetDisplay(nextUpGhost)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!timerActive && (
                  <button
                    type="button"
                    onClick={() => startRestTimer(150)}
                    className="px-3 py-2.5 bg-[#181b26] hover:bg-[#202533] border border-amber-500/40 text-amber-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all cursor-pointer"
                    title="手動啟動 2 分半休息"
                  >
                    <Timer className="w-3.5 h-3.5 text-amber-400" />
                    <span>休息 2:30</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleToggleSetCompleted(nextUpSet.id)}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all shrink-0 cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>完成此組</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-3 text-center text-xs font-black text-emerald-300">
              🎉 太棒了！本次訓練預排組數已全數完成！
            </div>
          )}
        </div>
      )}

      {/* 已記錄組數區塊 */}
      <div className="space-y-3">
        {setsByExercise.length === 0 ? (
          <div className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-6 text-center text-xs text-gray-500">
            {session.target_muscle === "游泳"
              ? "目前已記錄為游泳訓練，可點擊下方時段補充記錄！"
              : "尚未記錄任何組數，請在下方輸入重量次數並按「＋記錄完成」！"}
          </div>
        ) : (
          setsByExercise.map(({ exercise, sets: exSets }, exIdx) => {
            const ghostSets = exercise ? ghostMap[exercise.id] : undefined;

            return (
              <div
                key={exercise?.id || "unknown"}
                className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-2.5 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-[#262b3d]/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black bg-[#181b26] text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-lg shrink-0">
                      #{exIdx + 1}
                    </span>
                    <Dumbbell className="w-4 h-4 text-emerald-400 shrink-0" />
                    <h3 className="font-black text-gray-100 text-sm">{exercise?.name}</h3>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* 組數標籤：區分正式組與熱身組 */}
                    {(() => {
                      const warmupCount = exSets.filter((s) => isWarmupOrActivation(s)).length;
                      const formalCount = exSets.length - warmupCount;
                      if (warmupCount > 0) {
                        return (
                          <span className="text-xs bg-[#181b26] text-gray-300 px-2 py-0.5 rounded border border-[#262b3d] font-medium">
                            <span className="text-emerald-400 font-bold">{formalCount}</span> 正式組
                            <span className="text-gray-500 mx-1">•</span>
                            <span className="text-blue-400 font-bold">{warmupCount}</span> 熱身
                          </span>
                        );
                      }
                      return (
                        <span className="text-xs bg-[#181b26] text-gray-400 px-2 py-0.5 rounded border border-[#262b3d]">
                          {exSets.length} 組
                        </span>
                      );
                    })()}

                    {/* 換順序按鈕：當健身器材有人使用時可彈性調換 */}
                    <div className="flex items-center gap-0.5 bg-[#181b26] p-0.5 rounded-lg border border-[#262b3d]">
                      <button
                        type="button"
                        disabled={exIdx === 0}
                        onClick={() => handleMoveExercise(exIdx, "up")}
                        className="p-1 rounded text-gray-400 hover:text-white disabled:opacity-20 hover:bg-[#262b3d] transition-all cursor-pointer disabled:cursor-not-allowed"
                        title="動作順序上移"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={exIdx === setsByExercise.length - 1}
                        onClick={() => handleMoveExercise(exIdx, "down")}
                        className="p-1 rounded text-gray-400 hover:text-white disabled:opacity-20 hover:bg-[#262b3d] transition-all cursor-pointer disabled:cursor-not-allowed"
                        title="動作順序下移"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* 替換動作按鈕 (現場器材有人用時直接一鍵更換器材/動作，保留組數) */}
                    <button
                      type="button"
                      onClick={() => handleOpenSwapModal(exercise)}
                      className="p-1.5 bg-[#181b26] hover:bg-[#202533] text-gray-400 hover:text-amber-400 rounded-lg border border-[#262b3d] hover:border-amber-500/40 transition-all cursor-pointer"
                      title={`替換動作【${exercise?.name || "此動作"}】(保留已排組數)`}
                    >
                      <Repeat className="w-3.5 h-3.5" />
                    </button>

                    {/* 刪除整個動作組按鈕 (一鍵移除此動作與所有組數) */}
                    <button
                      type="button"
                      onClick={() => handleDeleteEntireExercise(exercise?.id, exercise?.name, exSets.length)}
                      className="p-1.5 bg-[#181b26] hover:bg-red-950/40 text-gray-400 hover:text-red-400 rounded-lg border border-[#262b3d] hover:border-red-500/40 transition-all cursor-pointer"
                      title={`刪除整個動作【${exercise?.name || "此動作"}】及所有組數`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 上次對照基準 */}
                {ghostSets && ghostSets.length > 0 && (
                  <div className="bg-[#181b26]/70 border border-[#262b3d] rounded-xl p-2 text-xs text-gray-300">
                    <span className="text-gray-400 text-[11px] mr-1.5 font-bold">上次做組：</span>
                    {ghostSets.map((gs, i) => (
                      <span
                        key={gs.id || i}
                        className="inline-block bg-[#090a0f] text-gray-400 px-1.5 py-0.5 rounded text-[11px] border border-[#262b3d] mr-1 mb-1"
                      >
                        {gs.raw_text || `${gs.weight_kg}Kg x${gs.reps}`}
                      </span>
                    ))}
                  </div>
                )}

                {/* 組數清單 (一組一組往下做，標示進行中與完成打勾) */}
                <div className="space-y-1.5">
                  {exSets.map((s, sIdx) => {
                    const isDone = isSetCompleted(s, session.date);
                    const isCurrent = nextUpSet?.id === s.id;
                    const isWarmup = isWarmupOrActivation(s);
                    const warmupLabel = isWarmup ? getWarmupLabel(s) : "";
                    const formalIndex = !isWarmup
                      ? exSets.slice(0, sIdx + 1).filter((x) => !isWarmupOrActivation(x)).length
                      : 0;
                    const matchingGhost = getMatchingGhostSet(s, exSets, ghostSets);

                    return (
                      <div
                        key={s.id}
                        className={`px-3 py-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                          isCurrent
                            ? "bg-[#14261f] border-emerald-500 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/50"
                            : isDone
                            ? "bg-[#141722] border-[#262b3d]/60 opacity-80"
                            : "bg-[#181b26] border-[#262b3d]/80"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          {/* 打勾按鈕 */}
                          <button
                            type="button"
                            onClick={() => handleToggleSetCompleted(s.id)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                              isDone
                                ? "bg-emerald-500 text-black border border-emerald-400 shadow"
                                : isCurrent
                                ? "bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 hover:bg-emerald-500 hover:text-black"
                                : "border border-gray-600 hover:border-emerald-400 text-transparent hover:text-emerald-400"
                            }`}
                            title={isDone ? "點擊取消完成" : "點擊標記此組完成"}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>

                          {/* 序號標記：熱身/激發組顯示藍色標籤 (不佔用正式組序號)，正式組依序由 #1 起算 */}
                          {isWarmup ? (
                            <span
                              className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 shrink-0"
                              title="熱身/準備組 (不計入正式組序號)"
                            >
                              {warmupLabel}
                            </span>
                          ) : (
                            <span
                              className={`font-mono font-bold ${isCurrent ? "text-emerald-400 font-black" : "text-gray-400"} w-5 shrink-0 text-xs`}
                              title={`第 ${formalIndex} 正式組`}
                            >
                              #{formalIndex}
                            </span>
                          )}

                          <span className={`font-bold truncate ${isDone ? "text-gray-400 line-through decoration-emerald-500/50" : isCurrent ? "text-white font-black" : "text-gray-100"}`}>
                            {cleanSetDisplay(s)}
                          </span>

                          {/* 緊貼顯示上次做組紀錄 */}
                          {matchingGhost && (
                            <span
                              className={`text-[10px] shrink-0 font-medium ${
                                isCurrent ? "text-amber-300 font-bold" : "text-gray-500"
                              }`}
                              title={`上次此組實測：${cleanSetDisplay(matchingGhost)}`}
                            >
                              (上次: {cleanSetDisplay(matchingGhost)})
                            </span>
                          )}

                          {isCurrent && (
                            <span className="bg-emerald-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 animate-pulse">
                              進行中
                            </span>
                          )}
                          {isDone && (
                            <span className="text-[10px] text-emerald-400 font-bold hidden sm:inline shrink-0">
                              已完成
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {s.set_type === "drop" && (
                            <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded font-bold">
                              遞減
                            </span>
                          )}

                          {isCurrent && (
                            <button
                              type="button"
                              onClick={() => handleToggleSetCompleted(s.id)}
                              className="bg-emerald-500 hover:bg-emerald-400 text-black px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer active:scale-95 transition-all shadow"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>完成</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleStartEditSet(s)}
                            className="text-gray-400 hover:text-amber-400 p-1.5 rounded-lg hover:bg-[#202533] transition-colors"
                            title="修改此組"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteSet(s.id)}
                            className="text-gray-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-950/30 transition-colors"
                            title="刪除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 游泳專用介面 vs 重訓記組介面 */}
      {session.target_muscle === "游泳" ? (
        <div className="bg-[#12141c] border border-cyan-500/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-black text-cyan-400 flex items-center gap-1.5">
              <span>🏊</span>
              <span>游泳記錄 (點選直接新增)</span>
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {["早上游", "下午游", "晚上游"].map((timeLabel) => (
              <button
                key={timeLabel}
                type="button"
                onClick={() => handleLogSwim(timeLabel)}
                className="py-3 px-2 rounded-xl bg-[#181b26] hover:bg-cyan-500 hover:text-black border border-[#262b3d] hover:border-cyan-400 text-gray-200 font-black text-xs transition-all active:scale-95"
              >
                {timeLabel}
              </button>
            ))}
          </div>

          <div className="pt-2">
            <Link
              href="/"
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-black py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition-all active:scale-98"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>完成並返回訓練日誌</span>
            </Link>
          </div>
        </div>
      ) : (
        /* 額外組數新增面板 (如加碼動作或臨時加組) */
        <div className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-emerald-400 stroke-[3]" />
              <span>＋ 新增組數 (加碼動作或臨時加組)</span>
            </h4>

            <button
              type="button"
              onClick={handleRepeatLastSet}
              className="text-xs bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-emerald-400 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 active:scale-95"
              title="重複上一組"
            >
              <Repeat className="w-3 h-3" />
              <span>重複上一組</span>
            </button>
          </div>

          {/* 動作切換膠囊 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {displayExercises.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => handleSelectExercise(ex.id)}
                  className={`text-xs px-3 py-1.5 rounded-xl border shrink-0 transition-all font-bold ${
                    selectedExId === ex.id
                      ? "bg-emerald-500 text-black border-emerald-400 shadow-md font-black"
                      : "bg-[#181b26] border-[#262b3d] text-gray-300 hover:text-white"
                  }`}
                >
                  {ex.name}
                </button>
              ))}
            </div>
          </div>

          {/* 組別模式切換：正式組、熱身組、遞減組 */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setInputType("normal")}
              className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                inputType === "normal"
                  ? "bg-emerald-500 text-black border-emerald-400 font-black shadow-sm"
                  : "bg-[#181b26] text-gray-400 border-[#262b3d]"
              }`}
            >
              正式組
            </button>
            <button
              type="button"
              onClick={() => setInputType("warmup")}
              className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                inputType === "warmup"
                  ? "bg-blue-600 text-white border-blue-400 font-black shadow-sm"
                  : "bg-[#181b26] text-gray-400 border-[#262b3d]"
              }`}
            >
              熱身組
            </button>
            <button
              type="button"
              onClick={() => setInputType("drop")}
              className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                inputType === "drop"
                  ? "bg-amber-500 text-black border-amber-400 font-black shadow-sm"
                  : "bg-[#181b26] text-gray-400 border-[#262b3d]"
              }`}
            >
              遞減模式
            </button>
          </div>

          {/* 主輸入框：重量 (Kg) 與 次數 (次) - 直接輸入，無步進廢鍵 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-gray-400 block mb-1 font-bold">重量 (Kg)</label>
              <input
                type="number"
                step="any"
                placeholder="60"
                value={inputWeight}
                onChange={(e) => setInputWeight(e.target.value)}
                className="w-full bg-[#181b26] border border-[#262b3d] text-white text-lg font-black rounded-xl p-2.5 text-center focus:border-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-gray-400 block mb-1 font-bold">次數 (下)</label>
              <input
                type="number"
                placeholder="8"
                value={inputReps}
                onChange={(e) => setInputReps(e.target.value)}
                className="w-full bg-[#181b26] border border-[#262b3d] text-white text-lg font-black rounded-xl p-2.5 text-center focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* ⭐ 支援在同一組內增加多個欄位 (休 / 補 / 遞減) */}
          <div className="space-y-2 pt-1 border-t border-[#262b3d]/60">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[11px] text-gray-400 font-bold">同一組附加欄位：</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const curW = parseFloat(inputWeight) || 0;
                    setInputSubFields((prev) => [
                      ...prev,
                      { mode: "休", weight_kg: curW, reps: 4 },
                    ]);
                  }}
                  className="px-2.5 py-1 bg-[#181b26] hover:bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-bold active:scale-95"
                >
                  ＋ 休
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInputSubFields((prev) => [...prev, { mode: "補", reps: 2 }]);
                  }}
                  className="px-2.5 py-1 bg-[#181b26] hover:bg-blue-950/40 border border-blue-500/40 text-blue-300 rounded-lg text-xs font-bold active:scale-95"
                >
                  ＋ 補
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const curW = parseFloat(inputWeight) || 0;
                    const dropW = Math.max(0, curW - 5);
                    setInputSubFields((prev) => [
                      ...prev,
                      { mode: "遞減", weight_kg: dropW, reps: 4 },
                    ]);
                  }}
                  className="px-2.5 py-1 bg-[#181b26] hover:bg-amber-950/40 border border-amber-500/40 text-amber-300 rounded-lg text-xs font-bold active:scale-95"
                >
                  ＋ 遞減
                </button>
              </div>
            </div>

            {/* 已加入的同一組子欄位清單 */}
            {inputSubFields.map((field, idx) => (
              <div
                key={idx}
                className="bg-[#181b26] p-2 rounded-xl border border-[#262b3d] flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded font-black text-[10px] ${
                    field.mode === "休" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" :
                    field.mode === "補" ? "bg-blue-500/20 text-blue-300 border border-blue-500/40" :
                    "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  }`}>
                    {field.mode}
                  </span>

                  {field.mode !== "補" ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="any"
                        placeholder="重量"
                        value={field.weight_kg ?? ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setInputSubFields((prev) =>
                            prev.map((f, i) => (i === idx ? { ...f, weight_kg: val } : f))
                          );
                        }}
                        className="w-16 bg-[#090a0f] border border-[#262b3d] text-white p-1 rounded-lg text-center font-bold"
                      />
                      <span>Kg ×</span>
                      <input
                        type="number"
                        placeholder="次數"
                        value={field.reps}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setInputSubFields((prev) =>
                            prev.map((f, i) => (i === idx ? { ...f, reps: val } : f))
                          );
                        }}
                        className="w-14 bg-[#090a0f] border border-[#262b3d] text-white p-1 rounded-lg text-center font-bold"
                      />
                      <span>下</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span>輔助補</span>
                      <input
                        type="number"
                        placeholder="次數"
                        value={field.reps}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setInputSubFields((prev) =>
                            prev.map((f, i) => (i === idx ? { ...f, reps: val } : f))
                          );
                        }}
                        className="w-14 bg-[#090a0f] border border-[#262b3d] text-white p-1 rounded-lg text-center font-bold"
                      />
                      <span>下</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setInputSubFields((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  className="text-gray-400 hover:text-red-400 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddSet}
            disabled={!inputReps || parseInt(inputReps, 10) <= 0}
            className="w-full bg-[#181b26] hover:bg-[#202533] border border-emerald-500/40 text-emerald-300 disabled:opacity-40 font-bold py-3 rounded-xl transition-all active:scale-[0.98] text-xs flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>＋ 加入此組至紀錄</span>
          </button>
        </div>
      )}

      {/* 當日訓練總容量 (Total Volume 噸數統計) */}
      {session.target_muscle !== "游泳" && totalSetsCount > 0 && (
        <div className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-gray-300 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>本日累積訓練量 (Total Volume)</span>
            </span>
            <span className="text-emerald-400 font-bold text-[11px]">
              {completedSetsCount} / {totalSetsCount} 組完成 ({progressPct}%)
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            <div className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d]/60">
              <span className="text-[10px] text-gray-400 block">動作數</span>
              <span className="text-sm sm:text-base font-black text-white">{setsByExercise.length} 項</span>
            </div>
            <div className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d]/60">
              <span className="text-[10px] text-gray-400 block">完成組數</span>
              <span className="text-sm sm:text-base font-black text-emerald-400">{completedSetsCount} 組</span>
            </div>
            <div className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d]/60">
              <span className="text-[10px] text-gray-400 block">總訓練噸數</span>
              <span className="text-sm sm:text-base font-black text-amber-400">
                {totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}t` : `${totalVolume}kg`}
              </span>
              <span className="text-[9px] text-gray-500 block">({totalVolume.toLocaleString()} Kg)</span>
            </div>
          </div>
        </div>
      )}

      {/* 完成本次訓練主要按鈕 */}
      <div className="pt-2 pb-8 space-y-2">
        <button
          type="button"
          onClick={handleFinishWorkout}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-4 rounded-2xl shadow-2xl transition-all active:scale-[0.98] text-base flex items-center justify-center gap-2 cursor-pointer"
        >
          <Check className="w-5 h-5 stroke-[3]" />
          <span>完成本次訓練並儲存 (返回日誌)</span>
        </button>
        <p className="text-center text-[11px] text-gray-500 font-medium">
          點擊後自動儲存所有組數進度並同步雲端，返回訓練日誌首頁
        </p>
      </div>

      {/* 修改單組 Modal (包含多欄位編輯) */}
      {editingSet && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12141c] border border-amber-500/40 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#262b3d] pb-2.5">
              <h3 className="font-bold text-white text-sm">修改第 #{editingSet.set_order} 組紀錄</h3>
              <button onClick={() => setEditingSet(null)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setEditSetType("normal")}
                className={`py-1 rounded-lg text-xs font-bold border ${
                  editSetType === "normal"
                    ? "bg-emerald-500 text-black border-emerald-400"
                    : "bg-[#181b26] text-gray-400 border-[#262b3d]"
                }`}
              >
                正式組
              </button>
              <button
                type="button"
                onClick={() => setEditSetType("warmup")}
                className={`py-1 rounded-lg text-xs font-bold border ${
                  editSetType === "warmup"
                    ? "bg-blue-600 text-white border-blue-400"
                    : "bg-[#181b26] text-gray-400 border-[#262b3d]"
                }`}
              >
                熱身組
              </button>
              <button
                type="button"
                onClick={() => setEditSetType("drop")}
                className={`py-1 rounded-lg text-xs font-bold border ${
                  editSetType === "drop"
                    ? "bg-amber-500 text-black border-amber-400"
                    : "bg-[#181b26] text-gray-400 border-[#262b3d]"
                }`}
              >
                遞減組
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">重量 (Kg)</label>
                <input
                  type="number"
                  step="any"
                  value={editSetWeight}
                  onChange={(e) => setEditSetWeight(e.target.value)}
                  className="w-full bg-[#181b26] border border-[#262b3d] text-white text-sm font-bold rounded-xl p-2.5 text-center outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">次數 (下)</label>
                <input
                  type="number"
                  value={editSetReps}
                  onChange={(e) => setEditSetReps(e.target.value)}
                  className="w-full bg-[#181b26] border border-[#262b3d] text-white text-sm font-bold rounded-xl p-2.5 text-center outline-none"
                />
              </div>
            </div>

            {/* 編輯附加欄位 */}
            <div className="space-y-2 border-t border-[#262b3d] pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] text-gray-400 font-bold">同一組附加欄位：</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const curW = parseFloat(editSetWeight) || 0;
                      setEditSetSubFields((p) => [...p, { mode: "休", weight_kg: curW, reps: 4 }]);
                    }}
                    className="px-2 py-0.5 bg-[#181b26] border border-emerald-500/40 text-emerald-300 rounded text-[11px] font-bold"
                  >
                    ＋ 休
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditSetSubFields((p) => [...p, { mode: "補", reps: 2 }]);
                    }}
                    className="px-2 py-0.5 bg-[#181b26] border border-blue-500/40 text-blue-300 rounded text-[11px] font-bold"
                  >
                    ＋ 補
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const curW = parseFloat(editSetWeight) || 0;
                      setEditSetSubFields((p) => [...p, { mode: "遞減", weight_kg: Math.max(0, curW - 5), reps: 4 }]);
                    }}
                    className="px-2 py-0.5 bg-[#181b26] border border-amber-500/40 text-amber-300 rounded text-[11px] font-bold"
                  >
                    ＋ 遞減
                  </button>
                </div>
              </div>

              {editSetSubFields.map((field, idx) => (
                <div
                  key={idx}
                  className="bg-[#181b26] p-1.5 rounded-lg border border-[#262b3d] flex items-center justify-between gap-1 text-xs"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[10px] text-amber-300">{field.mode}</span>
                    {field.mode !== "補" ? (
                      <div className="flex items-center gap-1 text-[11px]">
                        <input
                          type="number"
                          step="any"
                          value={field.weight_kg ?? ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setEditSetSubFields((p) => p.map((f, i) => (i === idx ? { ...f, weight_kg: val } : f)));
                          }}
                          className="w-14 bg-[#090a0f] border border-[#262b3d] text-white p-1 rounded text-center"
                        />
                        <span>Kg ×</span>
                        <input
                          type="number"
                          value={field.reps}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            setEditSetSubFields((p) => p.map((f, i) => (i === idx ? { ...f, reps: val } : f)));
                          }}
                          className="w-12 bg-[#090a0f] border border-[#262b3d] text-white p-1 rounded text-center"
                        />
                        <span>下</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px]">
                        <span>補</span>
                        <input
                          type="number"
                          value={field.reps}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            setEditSetSubFields((p) => p.map((f, i) => (i === idx ? { ...f, reps: val } : f)));
                          }}
                          className="w-12 bg-[#090a0f] border border-[#262b3d] text-white p-1 rounded text-center"
                        />
                        <span>下</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditSetSubFields((p) => p.filter((_, i) => i !== idx))}
                    className="text-gray-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditingSet(null)}
                className="flex-1 bg-[#181b26] text-gray-300 py-2.5 rounded-xl text-xs font-bold"
              >
                取消
              </button>
              <button
                onClick={handleSaveEditSet}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-black py-2.5 rounded-xl text-xs font-black shadow"
              >
                儲存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Markdown 檢視 Modal */}
      {showMarkdownModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12141c] border border-[#262b3d] rounded-2xl max-w-lg w-full p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#262b3d] pb-2">
              <h3 className="font-bold text-white text-sm">Markdown 格式日誌</h3>
              <button onClick={() => setShowMarkdownModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              readOnly
              rows={12}
              value={formatSessionToMarkdown(session, sets, exercises)}
              className="w-full bg-[#090a0f] border border-[#262b3d] text-emerald-400 text-xs font-mono p-3 rounded-xl outline-none select-all"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setShowMarkdownModal(false)}
                className="flex-1 bg-[#181b26] text-gray-300 py-2 rounded-xl text-xs font-bold"
              >
                關閉
              </button>
              <button
                onClick={handleCopyMarkdown}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>複製全文</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 替換動作 Modal (現場器材有人在用時一鍵替換) */}
      {showSwapModal && swapSourceExercise && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12141c] border border-amber-500/40 rounded-2xl max-w-md w-full p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#262b3d] pb-2.5">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <Repeat className="w-4 h-4 text-amber-400" />
                  <span>替換動作</span>
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  將【<span className="text-amber-300 font-bold">{swapSourceExercise.name}</span>】替換為其他動作，保留已排組數
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSwapModal(false);
                  setSwapSourceExercise(null);
                }}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 搜尋欄位 */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="搜尋欲替換之動作名稱..."
                value={swapSearchQuery}
                onChange={(e) => setSwapSearchQuery(e.target.value)}
                className="w-full bg-[#181b26] border border-[#262b3d] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-400"
              />
            </div>

            {/* 動作清單 */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {(() => {
                const query = swapSearchQuery.trim().toLowerCase();
                const available = exercises.filter((e) => {
                  if (e.id === swapSourceExercise.id) return false;
                  if (e.name.includes("繩索夾胸")) return false;
                  if (query) {
                    return e.name.toLowerCase().includes(query) || e.muscle_group.toLowerCase().includes(query);
                  }
                  return e.muscle_group === session.target_muscle;
                });

                if (available.length === 0) {
                  return (
                    <div className="text-center py-6 text-xs text-gray-500">
                      查無可替換之動作，請輸入關鍵字搜尋
                    </div>
                  );
                }

                // 依動作名稱去重
                const seen = new Set<string>();
                const deduped = available.filter((e) => {
                  if (seen.has(e.name)) return false;
                  seen.add(e.name);
                  return true;
                });

                return deduped.map((newEx) => (
                  <button
                    key={newEx.id}
                    type="button"
                    onClick={() => handleConfirmSwapExercise(newEx)}
                    className="w-full text-left p-2.5 rounded-xl bg-[#181b26] hover:bg-amber-500 hover:text-black border border-[#262b3d] hover:border-amber-400 transition-all group flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-xs text-gray-100 group-hover:text-black block">
                        {newEx.name}
                      </span>
                      <span className="text-[10px] text-gray-400 group-hover:text-black/80">
                        {newEx.muscle_group}
                        {newEx.weight_type === "dumbbell_single" && " • 單邊啞鈴"}
                        {newEx.weight_type === "bodyweight" && " • 自重"}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-amber-400 group-hover:text-black shrink-0">
                      選擇 ➔
                    </span>
                  </button>
                ));
              })()}
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowSwapModal(false);
                  setSwapSourceExercise(null);
                }}
                className="w-full bg-[#181b26] text-gray-300 py-2.5 rounded-xl text-xs font-bold hover:bg-[#202533] cursor-pointer"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

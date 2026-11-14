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
  AlertTriangle,
  Trophy,
  Sparkles,
} from "lucide-react";
import { db } from "@/lib/db/schema";
import {
  getLastExerciseSets,
  getPreviousSessionTemplate,
  getExerciseHistorySessions,
} from "@/lib/db/crud";
import { formatSessionToMarkdown } from "@/lib/markdown-generator";
import { runFullSync, deleteRemoteSession, deleteRemoteSet } from "@/lib/db/sync";
import type { Exercise, SetItem, WorkoutSession, WeightType, SetType, SetSubField, MuscleGroup } from "@/lib/types";

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

  // 離開與結算確認對話框
  const [showExitModal, setShowExitModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);

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

  // 動作列表過濾與搜尋 (支援在訓練中自由跨部位選動作，如練腿加練肩)
  const [dockMuscleFilter, setDockMuscleFilter] = useState<string>("default");
  const [dockExerciseSearch, setDockExerciseSearch] = useState<string>("");

  // 休息計時器狀態 (純視覺，無音效震動)
  const [targetEndTime, setTargetEndTime] = useState<number | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const [defaultRestDuration, setDefaultRestDuration] = useState<number>(150); // 預設 2 分半 (150秒)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 做組打勾完成後的快速休息氣泡
  const [restPromptSetId, setRestPromptSetId] = useState<string | null>(null);
  const restPromptTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 動作歷史記錄 Modal
  const [viewHistoryEx, setViewHistoryEx] = useState<{
    exercise: Exercise;
    history: { session: WorkoutSession; sets: SetItem[] }[];
  } | null>(null);

  // 替換動作 Modal
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapSourceExercise, setSwapSourceExercise] = useState<Exercise | null>(null);
  const [swapSearchQuery, setSwapSearchQuery] = useState("");
  const [sessionNotFound, setSessionNotFound] = useState(false);

  // ＋ 自訂新動作 Modal (現場隨時自訂新器材或新動作)
  const [showNewExerciseModal, setShowNewExerciseModal] = useState(false);
  const [newExName, setNewExName] = useState("");
  const [newExMuscle, setNewExMuscle] = useState<MuscleGroup>("胸");
  const [newExType, setNewExType] = useState<WeightType>("dumbbell_single");

  // 歷史各動作 PR (最高重量與次數) 對照表
  const [prMap, setPrMap] = useState<Record<string, { maxWeight: number; maxReps: number }>>({});

  // 🏆 PR 突破個人紀錄即時高光慶祝
  const [prCelebration, setPrCelebration] = useState<{
    exerciseName: string;
    weight: number;
    reps: number;
    diffText: string;
    prevText: string;
  } | null>(null);
  const prCelebrationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 計時器倒數邏輯 (手動觸發、跨頁面/鎖屏無縫恢復、結束時震動提醒)
  useEffect(() => {
    function syncTimerState() {
      const storedEndStr = localStorage.getItem("workout_timer_end");
      if (!storedEndStr) {
        setTimerActive(false);
        setTimerSeconds(null);
        setTargetEndTime(null);
        return;
      }

      const endMs = parseInt(storedEndStr, 10);
      const now = Date.now();
      const remain = Math.ceil((endMs - now) / 1000);

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
        setTargetEndTime(endMs);
        setTimerSeconds(remain);
        setTimerActive(true);
      }
    }

    // 掛載與切換進來時第一時間立即恢復計時狀態
    syncTimerState();

    const interval = setInterval(syncTimerState, 500);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncTimerState();
      }
    };

    window.addEventListener("workout_timer_update", syncTimerState);
    window.addEventListener("storage", syncTimerState);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener("workout_timer_update", syncTimerState);
      window.removeEventListener("storage", syncTimerState);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  function startRestTimer(seconds: number) {
    const end = Date.now() + seconds * 1000;
    setTargetEndTime(end);
    setTimerSeconds(seconds);
    setTimerActive(true);
    localStorage.setItem("workout_timer_end", end.toString());
    const loc = session?.location ? ` (${session.location})` : "";
    const title = session ? `${session.target_muscle}${loc}` : "訓練休息";
    localStorage.setItem(
      "workout_timer_info",
      JSON.stringify({
        sessionId: id,
        title,
      })
    );
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("workout_timer_update"));
    }
  }

  function adjustRestSeconds(seconds: number) {
    const storedEndStr = localStorage.getItem("workout_timer_end");
    const currentEnd = storedEndStr ? parseInt(storedEndStr, 10) : (targetEndTime || Date.now());
    const newEnd = currentEnd + seconds * 1000;
    const now = Date.now();
    const remain = Math.ceil((newEnd - now) / 1000);

    if (remain <= 0) {
      stopRestTimer();
      return;
    }

    setTargetEndTime(newEnd);
    setTimerSeconds(remain);
    setTimerActive(true);
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
    localStorage.removeItem("workout_timer_info");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("workout_timer_update"));
    }
  }

  // 載入當前 session 與數據 (手機鎖屏喚醒與重試保護)
  useEffect(() => {
    let isCancelled = false;

    async function load() {
      try {
        if (!db.isOpen()) {
          await db.open();
        }

        let sess = await db.sessions.get(id);

        // 防呆重試機制：手機鎖屏喚醒或冷開機時，IndexedDB 可能需 100~300ms 就緒，切勿立即跳頁
        if (!sess) {
          for (let retry = 0; retry < 3; retry++) {
            await new Promise((r) => setTimeout(r, 250));
            if (isCancelled) return;
            sess = await db.sessions.get(id);
            if (sess) break;
          }
        }

        // 若仍未讀到，嘗試向 Supabase 撈取
        if (!sess) {
          try {
            await runFullSync();
            sess = await db.sessions.get(id);
          } catch {}
        }

        if (!sess) {
          if (!isCancelled) {
            setSessionNotFound(true);
            setLoading(false);
          }
          return;
        }

        if (isCancelled) return;
        setSessionNotFound(false);
        setSession(sess);

        // 記錄正在進行中的訓練 ID，供首頁置頂即時恢復
        if (sess.status === "in_progress") {
          localStorage.setItem("active_workout_session_id", id);
          localStorage.setItem("active_workout_session_title", sess.display_title);
        } else {
          const curActive = localStorage.getItem("active_workout_session_id");
          if (curActive === id) {
            localStorage.removeItem("active_workout_session_id");
            localStorage.removeItem("active_workout_session_title");
          }
        }

        setEditTitle(sess.display_title);
        setEditDate(sess.date);
        setEditTargetMuscle(sess.target_muscle);
        setEditLocation(sess.location || "交大健身房");

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

        // 讀取上次對照 ghost 與歷史 PR (排除本次 session)
        const distinctExIds = Array.from(new Set(currentSets.map((s) => s.exercise_id)));
        const ghostRecord: Record<string, SetItem[]> = {};
        const prRecord: Record<string, { maxWeight: number; maxReps: number }> = {};

        for (const exId of distinctExIds) {
          const res = await getLastExerciseSets(exId, id);
          if (res) ghostRecord[exId] = res.sets;

          const exObj = allEx.find((e) => e.id === exId);
          const historySets = await db.sets
            .filter(
              (s) =>
                !s.deleted_at &&
                s.session_id !== id &&
                s.weight_kg > 0 &&
                !isWarmupOrActivation(s) &&
                s.is_completed !== false &&
                Boolean(s.exercise_id === exId || (exObj && allEx.find((e) => e.id === s.exercise_id)?.name === exObj.name))
            )
            .toArray();

          let maxW = 0;
          let maxR = 0;
          for (const s of historySets) {
            if (s.weight_kg > maxW || (s.weight_kg === maxW && s.reps > maxR)) {
              maxW = s.weight_kg;
              maxR = s.reps;
            }
          }
          if (maxW > 0) {
            prRecord[exId] = { maxWeight: maxW, maxReps: maxR };
          }
        }
        setGhostMap(ghostRecord);
        setPrMap(prRecord);

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
        if (!isCancelled) setLoading(false);
      }
    }

    load();

    // 監聽手機鎖屏喚醒與切回視窗，自動保持同步
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        load();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isCancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [id, router]);

  // 切換動作時智慧預填 (若為全新動作或跨部位動作，自動即時從歷史紀錄抓取上次重量與次數預填)
  async function handleSelectExercise(exId: string) {
    setSelectedExId(exId);
    setInputSubFields([]);
    const existingSets = sets.filter((s) => s.exercise_id === exId);
    if (existingSets.length > 0) {
      const last = existingSets[existingSets.length - 1];
      setInputWeight(last.weight_kg > 0 ? last.weight_kg.toString() : "");
      setInputReps(last.reps > 0 ? last.reps.toString() : "");
      return;
    }

    if (ghostMap[exId] && ghostMap[exId].length > 0) {
      const firstNormal = ghostMap[exId].find((s) => s.set_type === "normal") || ghostMap[exId][0];
      setInputWeight(firstNormal.weight_kg > 0 ? firstNormal.weight_kg.toString() : "");
      setInputReps(firstNormal.reps > 0 ? firstNormal.reps.toString() : "");
      return;
    }

    // ⭐ 若 ghostMap 尚未快取 (如在練腿時跨部位點選啞鈴側平舉)，即時向歷史訓練 DB 查詢該動作上次實測！
    try {
      const res = await getLastExerciseSets(exId, session?.id);
      if (res && res.sets.length > 0) {
        setGhostMap((prev) => ({ ...prev, [exId]: res.sets }));
        const firstNormal = res.sets.find((s) => s.set_type === "normal") || res.sets[0];
        setInputWeight(firstNormal.weight_kg > 0 ? firstNormal.weight_kg.toString() : "");
        setInputReps(firstNormal.reps > 0 ? firstNormal.reps.toString() : "");
        return;
      }
    } catch (e) {
      console.error("Failed to query last exercise sets:", e);
    }

    setInputWeight("");
    setInputReps("");
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

  // 確認替換動作：將原動作替換為新動作，智慧重設組數重量為新動作的歷史水準，防止把推蹬機 90Kg 誤套到腿彎舉
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

    // 防呆：禁止替換為當前訓練已存在的動作（防止把兩個動作的組數攪拌在一起）
    const alreadyExists = sets.some((s) => s.exercise_id === newEx.id && s.exercise_id !== oldExId);
    if (alreadyExists) {
      alert(`【${newEx.name}】已存在於本次訓練中！\n請選擇其他尚未加入菜單的器材或動作進行替換。`);
      return;
    }

    // 取得新動作的歷史做組水準 (避免沿用舊動作的過重重量)
    let newExGhostSets: SetItem[] = [];
    try {
      const res = await getLastExerciseSets(newEx.id, id);
      if (res && res.sets.length > 0) {
        newExGhostSets = res.sets;
        setGhostMap((prev) => ({ ...prev, [newEx.id]: res.sets }));
      }
    } catch {}

    const updatedSets: SetItem[] = targetSets.map((s, idx) => {
      // 若新動作有做組歷史，帶入新動作的對應組數重量；若無歷史，重量歸零防誤測 PR！
      const ghostForThis = newExGhostSets[idx] || newExGhostSets[newExGhostSets.length - 1];
      const newWeight = ghostForThis ? ghostForThis.weight_kg : 0;
      const newReps = ghostForThis ? ghostForThis.reps : s.reps;
      const raw = formatSetRawText(idx + 1, s.set_type, newWeight, newReps, [], s.notes || "");

      return {
        ...s,
        exercise_id: newEx.id,
        weight_kg: newWeight,
        reps: newReps,
        raw_text: raw,
        sub_fields: undefined, // 清除上一動作的特殊加減組欄位
        is_completed: false, // 換動作後組數重設為未打勾，等待現場重新輸入打勾
        updated_at: new Date().toISOString(),
        sync_status: "pending" as const,
      };
    });

    await db.sets.bulkPut(updatedSets);
    setSets((prev) =>
      prev.map((s) => {
        const found = updatedSets.find((u) => u.id === s.id);
        return found || s;
      })
    );

    // 載入新動作歷史 PR
    const exObj = exercises.find((e) => e.id === newEx.id);
    const historySets = await db.sets
      .filter(
        (s) =>
          !s.deleted_at &&
          s.session_id !== id &&
          s.weight_kg > 0 &&
          !isWarmupOrActivation(s) &&
          s.is_completed !== false &&
          Boolean(s.exercise_id === newEx.id || (exObj && exercises.find((e) => e.id === s.exercise_id)?.name === exObj.name))
      )
      .toArray();

    let maxW = 0;
    let maxR = 0;
    for (const s of historySets) {
      if (s.weight_kg > maxW || (s.weight_kg === maxW && s.reps > maxR)) {
        maxW = s.weight_kg;
        maxR = s.reps;
      }
    }
    if (maxW > 0) {
      setPrMap((prev) => ({ ...prev, [newEx.id]: { maxWeight: maxW, maxReps: maxR } }));
    }

    if (!exercises.some((e) => e.id === newEx.id)) {
      setExercises((prev) => [...prev, newEx]);
    }

    // 若底欄正選中該動作，同步更新預設重量
    if (selectedExId === oldExId) {
      setSelectedExId(newEx.id);
      if (updatedSets.length > 0) {
        setInputWeight(updatedSets[0].weight_kg > 0 ? updatedSets[0].weight_kg.toString() : "");
        setInputReps(updatedSets[0].reps > 0 ? updatedSets[0].reps.toString() : "");
      }
    }

    runFullSync().catch(() => {});
    setShowSwapModal(false);
    setSwapSourceExercise(null);
  }

  // 現場自訂建立新動作 (如啞鈴側平舉) 並直接選取
  async function handleCreateCustomExercise() {
    if (!newExName.trim()) return;
    const name = newExName.trim();
    const newEx: Exercise = {
      id: `ex-${Date.now()}`,
      name,
      muscle_group: newExMuscle,
      weight_type: newExType,
      is_favorite: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.exercises.add(newEx);
    setExercises((prev) => [...prev, newEx]);
    setSelectedExId(newEx.id);
    setInputWeight("");
    setInputReps("");
    setShowNewExerciseModal(false);
    setNewExName("");
    runFullSync().catch(() => {});
  }

  // 取得某組 PR 突破詳情 (重量新高、次數新高)
  function getSetPRDetails(s: SetItem): { isPR: boolean; type: "weight" | "reps" | null; diffText: string; prevText: string } {
    if (s.weight_kg <= 0 || !s.reps || s.reps <= 0) {
      return { isPR: false, type: null, diffText: "", prevText: "" };
    }
    if (isWarmupOrActivation(s)) {
      return { isPR: false, type: null, diffText: "", prevText: "" }; // 熱身組不計入 PR
    }

    const historyPR = prMap[s.exercise_id];
    if (!historyPR || historyPR.maxWeight <= 0) {
      return { isPR: false, type: null, diffText: "", prevText: "" };
    }

    // 1. 重量直接突破歷史最高
    if (s.weight_kg > historyPR.maxWeight) {
      const diff = Math.round((s.weight_kg - historyPR.maxWeight) * 10) / 10;
      return {
        isPR: true,
        type: "weight",
        diffText: `+${diff}Kg`,
        prevText: `${historyPR.maxWeight}Kg × ${historyPR.maxReps}下`,
      };
    }

    // 2. 重量同歷史最高，但次數超越歷史最高次數
    if (s.weight_kg === historyPR.maxWeight && s.reps > historyPR.maxReps) {
      const diff = s.reps - historyPR.maxReps;
      return {
        isPR: true,
        type: "reps",
        diffText: `+${diff}下`,
        prevText: `${historyPR.maxWeight}Kg × ${historyPR.maxReps}下`,
      };
    }

    return { isPR: false, type: null, diffText: "", prevText: "" };
  }

  // 判斷某組是否突破個人歷史紀錄 (新 PR)
  function isSetNewPR(s: SetItem): boolean {
    return getSetPRDetails(s).isPR;
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

  // 快速新增單組 (熱身組自動插入至熱身區，正式組依序遞增)
  async function handleAddSet() {
    if (!selectedExId || !inputReps) return;
    const repsNum = parseInt(inputReps, 10) || 0;
    if (repsNum <= 0) return;

    const weightNum = parseFloat(inputWeight) || 0;
    const exSets = sets.filter((s) => s.exercise_id === selectedExId);

    let targetOrder = sets.length + 1;
    if (inputType === "warmup") {
      const lastWarmup = exSets.filter((s) => isWarmupOrActivation(s)).pop();
      if (lastWarmup) {
        targetOrder = lastWarmup.set_order + 1;
      } else if (exSets.length > 0) {
        targetOrder = exSets[0].set_order;
      }
    } else {
      if (exSets.length > 0) {
        targetOrder = exSets[exSets.length - 1].set_order + 1;
      }
    }

    const setsToShift = sets.filter((s) => s.set_order >= targetOrder);
    if (setsToShift.length > 0) {
      await db.transaction("rw", [db.sets], async () => {
        for (const s of setsToShift) {
          await db.sets.update(s.id, { set_order: s.set_order + 1 });
        }
      });
    }

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
      id: `set-${Date.now()}-${targetOrder}`,
      session_id: id,
      exercise_id: selectedExId,
      set_order: targetOrder,
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
    setSets((prev) =>
      [...prev.map((s) => (s.set_order >= targetOrder ? { ...s, set_order: s.set_order + 1 } : s)), newSet].sort(
        (a, b) => a.set_order - b.set_order
      )
    );
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

  // 標記/切換單組完成狀態 (一組一組往下做，完成時彈出快速休息氣泡)
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

    // 若剛標記為已完成，檢查是否打破個人紀錄 (PR) 並彈出高光慶祝
    if (newStatus) {
      const prDetails = getSetPRDetails(target);
      if (prDetails.isPR) {
        const exObj = exercises.find((e) => e.id === target.exercise_id);
        setPrCelebration({
          exerciseName: exObj?.name || "此動作",
          weight: target.weight_kg,
          reps: target.reps,
          diffText: prDetails.diffText,
          prevText: prDetails.prevText,
        });

        // 手機震動反饋節奏
        if (typeof window !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate([100, 60, 150, 60, 300]);
          } catch {}
        }

        if (prCelebrationTimerRef.current) clearTimeout(prCelebrationTimerRef.current);
        prCelebrationTimerRef.current = setTimeout(() => {
          setPrCelebration(null);
        }, 5500);
      }
    }

    // 若剛標記為已完成，且非游泳訓練，立即彈出快速休息氣泡（5秒不點擊自動隱藏）
    if (newStatus && session?.target_muscle !== "游泳") {
      setRestPromptSetId(setId);
      if (restPromptTimerRef.current) clearTimeout(restPromptTimerRef.current);
      restPromptTimerRef.current = setTimeout(() => {
        setRestPromptSetId(null);
      }, 5000);
    } else {
      if (restPromptSetId === setId) setRestPromptSetId(null);
    }
  }

  // 快速複製該動作上一組多做一組 (0.5秒極速加組)
  async function handleAddOneMoreSet(last: SetItem) {
    if (!last) return;
    const exSets = sets.filter((s) => s.exercise_id === last.exercise_id);
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
      id: `set-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      session_id: id,
      exercise_id: last.exercise_id,
      set_order: last.set_order + 1,
      set_type: last.set_type,
      weight_kg: last.weight_kg,
      reps: last.reps,
      raw_text: raw,
      sub_fields: last.sub_fields,
      notes: last.notes,
      is_completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    // 插入在該動作最後一組之後，並重新計算全體 set_order
    const lastIdx = sets.findIndex((s) => s.id === last.id);
    const newSetsList = [...sets];
    if (lastIdx !== -1) {
      newSetsList.splice(lastIdx + 1, 0, newSet);
    } else {
      newSetsList.push(newSet);
    }
    const reordered = newSetsList.map((s, idx) => ({ ...s, set_order: idx + 1 }));

    await db.transaction("rw", [db.sets], async () => {
      await db.sets.bulkPut(reordered);
    });

    setSets(reordered);
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

  // 微調單一組數順序 (組數上移 / 下移)
  async function handleMoveSet(setId: string, direction: "up" | "down") {
    const targetSet = sets.find((s) => s.id === setId);
    if (!targetSet) return;
    const exSets = sets.filter((s) => s.exercise_id === targetSet.exercise_id);
    const currIdx = exSets.findIndex((s) => s.id === setId);
    if (currIdx < 0) return;
    if (direction === "up" && currIdx === 0) return;
    if (direction === "down" && currIdx === exSets.length - 1) return;

    const swapIdx = direction === "up" ? currIdx - 1 : currIdx + 1;
    const otherSet = exSets[swapIdx];

    const targetOrder = targetSet.set_order;
    const otherOrder = otherSet.set_order;

    await db.transaction("rw", [db.sets], async () => {
      await db.sets.update(targetSet.id, { set_order: otherOrder, updated_at: new Date().toISOString() });
      await db.sets.update(otherSet.id, { set_order: targetOrder, updated_at: new Date().toISOString() });
    });

    setSets((prev) =>
      prev.map((s) => {
        if (s.id === targetSet.id) return { ...s, set_order: otherOrder };
        if (s.id === otherSet.id) return { ...s, set_order: targetOrder };
        return s;
      }).sort((a, b) => a.set_order - b.set_order)
    );
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

  // 快捷結算整場為已完成 (無未做組數時)
  async function handleCompleteSessionQuick() {
    if (!session) {
      router.push("/");
      return;
    }
    const emptySets = sets.filter(
      (s) => s.weight_kg === 0 && s.reps === 0 && !s.sub_fields?.length && session.target_muscle !== "游泳"
    );
    if (emptySets.length > 0) {
      await db.sets.bulkDelete(emptySets.map((s) => s.id));
      emptySets.forEach((s) => deleteRemoteSet(s.id).catch(() => {}));
    }
    const updated: WorkoutSession = {
      ...session,
      status: "completed",
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };
    await db.sessions.put(updated);
    localStorage.removeItem("active_workout_session_id");
    localStorage.removeItem("active_workout_session_title");
    runFullSync().catch(() => {});
    router.push("/");
  }

  // 點擊返回鍵：檢查當前訓練進度，彈出確認選項，避免預設將未做完場次當作完整保存
  function handleExitClick() {
    if (!session) {
      router.push("/");
      return;
    }

    const uncompleted = sets.filter((s) => !isSetCompleted(s, session.date));

    // 若歷史紀錄本身已完成，且現場沒有遺留未做的草稿組數，直接返回首頁
    if (session.status === "completed" && uncompleted.length === 0) {
      router.push("/");
      return;
    }

    // 若全部組數皆已完成打勾
    if (sets.length > 0 && uncompleted.length === 0) {
      handleCompleteSessionQuick();
      return;
    }

    // 0 組完成，或有未做完組數 -> 開啟離開確認對話框
    setShowExitModal(true);
  }

  // 結束並只保留已完成組數（自動清除未執行的計劃組數，真實反映訓練紀錄）
  async function handlePruneAndFinish() {
    if (!session) {
      router.push("/");
      return;
    }

    const uncompletedSets = sets.filter((s) => !isSetCompleted(s, session.date));
    const emptySets = sets.filter(
      (s) => s.weight_kg === 0 && s.reps === 0 && !s.sub_fields?.length && session.target_muscle !== "游泳"
    );

    const idsToDelete = Array.from(new Set([...uncompletedSets.map((s) => s.id), ...emptySets.map((s) => s.id)]));
    if (idsToDelete.length > 0) {
      await db.sets.bulkDelete(idsToDelete);
      idsToDelete.forEach((sId) => deleteRemoteSet(sId).catch(() => {}));
    }

    // 重整剩餘已完成組數的 set_order
    const remainingSets = sets.filter((s) => !idsToDelete.includes(s.id));
    let order = 1;
    const reordered: SetItem[] = remainingSets.map((s) => ({
      ...s,
      set_order: order++,
      updated_at: new Date().toISOString(),
      sync_status: "pending" as const,
    }));
    if (reordered.length > 0) {
      await db.sets.bulkPut(reordered);
    }

    const updatedSession: WorkoutSession = {
      ...session,
      status: "completed",
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.sessions.put(updatedSession);
    localStorage.removeItem("active_workout_session_id");
    localStorage.removeItem("active_workout_session_title");
    runFullSync().catch(() => {});
    router.push("/");
  }

  // 放棄本次訓練：徹底刪除此場訓練紀錄與所有組數（不留假紀錄）
  async function handleAbandonSessionAndExit() {
    if (!session) {
      router.push("/");
      return;
    }

    await db.transaction("rw", [db.sessions, db.sets], async () => {
      await db.sets.where("session_id").equals(id).delete();
      await db.sessions.delete(id);
    });
    localStorage.removeItem("active_workout_session_id");
    localStorage.removeItem("active_workout_session_title");
    deleteRemoteSession(id).catch(() => {});
    runFullSync().catch(() => {});
    router.push("/");
  }

  // 保留為進行中草稿（稍後繼續訓練）
  async function handleSaveAsDraftAndExit() {
    if (!session) {
      router.push("/");
      return;
    }

    const updatedSession: WorkoutSession = {
      ...session,
      status: "in_progress",
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.sessions.put(updatedSession);
    localStorage.removeItem("active_workout_session_id");
    localStorage.removeItem("active_workout_session_title");
    runFullSync().catch(() => {});
    router.push("/");
  }

  // 將所有組數皆標記為已完成並結束
  async function handleMarkAllCompletedAndFinish() {
    if (!session) {
      router.push("/");
      return;
    }

    const emptySets = sets.filter(
      (s) => s.weight_kg === 0 && s.reps === 0 && !s.sub_fields?.length && session.target_muscle !== "游泳"
    );
    if (emptySets.length > 0) {
      await db.sets.bulkDelete(emptySets.map((s) => s.id));
      emptySets.forEach((s) => deleteRemoteSet(s.id).catch(() => {}));
    }

    const validSets = sets.filter(
      (s) => !(s.weight_kg === 0 && s.reps === 0 && !s.sub_fields?.length && session.target_muscle !== "游泳")
    );

    const allCompletedSets = validSets.map((s) => ({
      ...s,
      is_completed: true,
      feedback: s.feedback
        ? (s.feedback.includes("completed") ? s.feedback : `${s.feedback}|completed`)
        : "completed",
      updated_at: new Date().toISOString(),
      sync_status: "pending" as const,
    }));

    if (allCompletedSets.length > 0) {
      await db.sets.bulkPut(allCompletedSets);
    }

    const updatedSession: WorkoutSession = {
      ...session,
      status: "completed",
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.sessions.put(updatedSession);
    localStorage.removeItem("active_workout_session_id");
    localStorage.removeItem("active_workout_session_title");
    runFullSync().catch(() => {});
    router.push("/");
  }

  // 結束 / 完成本次訓練（點擊上方或下方完成按鈕）
  async function handleFinishWorkout() {
    if (!session) {
      router.push("/");
      return;
    }

    const uncompleted = sets.filter((s) => !isSetCompleted(s, session.date));

    // 若還有未完成組數，詢問使用者如何處理
    if (uncompleted.length > 0) {
      setShowFinishModal(true);
      return;
    }

    // 全部皆已完成，直接完成並結算
    await handlePruneAndFinish();
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
    localStorage.removeItem("active_workout_session_id");
    localStorage.removeItem("active_workout_session_title");
    deleteRemoteSession(id).catch(() => {});
    runFullSync().catch(() => {});
    router.push("/");
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-400 gap-2">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs">正在載入訓練紀錄...</span>
      </div>
    );
  }

  if (sessionNotFound || !session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 px-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#181b26] border border-[#262b3d] flex items-center justify-center text-amber-400">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="font-black text-white text-base">未找到此場訓練紀錄</h3>
          <p className="text-xs text-gray-400 max-w-xs">
            訓練可能已移轉、已刪除或尚未從雲端同步
          </p>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            重新整理
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-black"
          >
            返回訓練首頁
          </Link>
        </div>
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
    // 動作內組數嚴格排序：熱身組在最前面，正式組依序遞增
    const sortedSets = [...exSets].sort((a, b) => {
      const aW = isWarmupOrActivation(a);
      const bW = isWarmupOrActivation(b);
      if (aW && !bW) return -1;
      if (!aW && bW) return 1;
      return a.set_order - b.set_order;
    });
    setsByExercise.push({ exercise: ex, sets: sortedSets });
  }

  // 訓練整體進度與當前進行中組數（熱身組不計入組數，只統計正式組）
  const formalSets = sets.filter((s) => !isWarmupOrActivation(s));
  const totalSetsCount = formalSets.length;
  const completedSetsCount = formalSets.filter((s) => isSetCompleted(s, session.date)).length;
  const nextUpSet = sets.find((s) => !isSetCompleted(s, session.date));

  // 動作過濾（排除繩索夾胸，支援推薦部位/全部/指定部位篩選，並依動作名稱去重）
  const seenExNames = new Set<string>();
  const displayExercises = exercises.filter((e) => {
    if (e.name.includes("繩索夾胸")) return false;
    if (dockExerciseSearch.trim()) {
      if (!e.name.toLowerCase().includes(dockExerciseSearch.trim().toLowerCase())) return false;
    } else if (dockMuscleFilter === "default") {
      const target = (session.target_muscle || "").replace("部", "").slice(0, 1);
      if (e.muscle_group !== target && !session.target_muscle.includes(e.muscle_group)) {
        return false;
      }
    } else if (dockMuscleFilter !== "all") {
      if (e.muscle_group !== dockMuscleFilter) return false;
    }
    if (seenExNames.has(e.name)) return false;
    seenExNames.add(e.name);
    return true;
  });

  return (
    <div className="space-y-4 pb-28">
      {/* 頂部導覽列 — 手機版改為上下兩列佈局避免擠壓 */}
      <div className="space-y-2">
        {/* 第一列：返回 + 標題 */}
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            onClick={handleExitClick}
            className="p-2.5 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] rounded-xl text-gray-300 shrink-0 mt-0.5 active:scale-95 transition-all cursor-pointer"
            title="返回首頁"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black text-white leading-tight break-words">{session.display_title}</h1>
            <div className="flex items-center gap-2 text-xs text-gray-300 mt-1 relative flex-wrap font-medium">
              <span>{session.date}</span>
              <span>•</span>
              <button
                type="button"
                onClick={() => setShowLocationQuickPicker((p) => !p)}
                className="flex items-center gap-1 text-emerald-400 font-bold bg-[#181b26] px-2.5 py-0.5 rounded-lg border border-[#262b3d] active:scale-95"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{session.location || "三健客"}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {/* 切換場地下拉 */}
              {showLocationQuickPicker && (
                <div className="absolute top-7 left-12 z-30 bg-[#12141c] border border-emerald-500/40 rounded-xl p-1.5 shadow-2xl space-y-1 text-xs min-w-[130px]">
                  {LOCATION_OPTIONS.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => handleQuickUpdateLocation(loc)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs ${
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

        {/* 第二列：操作按鈕群 — 均分排列，手機完整顯示 */}
        <div className="flex items-center gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={handleFinishWorkout}
            className="flex-1 px-3 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 shadow active:scale-95 cursor-pointer"
            title="完成本次訓練並返回首頁"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>完成訓練</span>
          </button>

          <button
            onClick={handleCopyMarkdown}
            className="p-2.5 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] text-emerald-400 rounded-xl flex items-center gap-1 active:scale-95"
            title="複製 Markdown"
          >
            <Copy className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowMarkdownModal(true)}
            className="p-2.5 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] text-gray-300 rounded-xl active:scale-95"
            title="檢視 Markdown"
          >
            <FileText className="w-4 h-4" />
          </button>

          <button
            onClick={handleDeleteEntireSession}
            className="p-2.5 bg-[#12141c] hover:bg-red-950/40 border border-[#262b3d] text-gray-400 hover:text-red-400 rounded-xl active:scale-95"
            title="刪除訓練"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {copyToast && (
        <div className="bg-emerald-500 text-black px-4 py-2.5 rounded-xl text-xs font-black shadow-2xl flex items-center gap-2">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>已複製 Markdown！</span>
        </div>
      )}

      {/* 休息計時器控制列 (重訓專用，手動點擊觸發) — 手機版自適應換行 */}
      {session.target_muscle !== "游泳" && (
        <div className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-3 sm:p-3.5 text-xs shadow-sm space-y-2.5">
          {/* 狀態列 */}
          <div className="flex items-center gap-2">
            <Timer className={`w-4 h-4 shrink-0 ${timerActive ? "text-amber-400 animate-pulse" : "text-gray-400"}`} />
            <span className="font-bold text-gray-200 shrink-0 text-xs sm:text-sm">休息計時：</span>
            {timerActive && timerSeconds !== null && timerSeconds > 0 ? (
              <span className="text-amber-400 font-mono font-black text-base animate-pulse">
                {Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, "0")}
              </span>
            ) : timerSeconds === 0 ? (
              <span className="text-emerald-400 font-bold text-xs sm:text-sm">時間到！</span>
            ) : (
              <span className="text-gray-500 text-xs">手動點擊啟動</span>
            )}
          </div>

          {/* 按鈕列 — 均分排列，加大觸控面積 */}
          <div className="flex items-center gap-1.5">
            {timerActive ? (
              <>
                <button
                  type="button"
                  onClick={() => adjustRestSeconds(-30)}
                  className="flex-1 py-2 bg-[#181b26] hover:bg-[#202533] border border-red-500/40 text-red-300 rounded-xl text-xs font-bold active:scale-95 cursor-pointer text-center"
                  title="減少 30 秒休息"
                >
                  -30秒
                </button>
                <button
                  type="button"
                  onClick={() => adjustRestSeconds(30)}
                  className="flex-1 py-2 bg-[#181b26] hover:bg-[#202533] border border-amber-500/40 text-amber-300 rounded-xl text-xs font-bold active:scale-95 cursor-pointer text-center"
                  title="延長 30 秒休息"
                >
                  +30秒
                </button>
                <button
                  type="button"
                  onClick={stopRestTimer}
                  className="flex-1 py-2 bg-red-950/30 hover:bg-red-900/50 border border-red-500/30 text-red-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
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
                  className="flex-1 py-2 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-300 hover:text-white rounded-xl text-xs font-bold active:scale-95 cursor-pointer text-center"
                >
                  1.5分
                </button>
                <button
                  type="button"
                  onClick={() => startRestTimer(120)}
                  className="flex-1 py-2 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-300 hover:text-white rounded-xl text-xs font-bold active:scale-95 cursor-pointer text-center"
                >
                  2分
                </button>
                <button
                  type="button"
                  onClick={() => startRestTimer(150)}
                  className="flex-1 py-2 bg-[#181b26] hover:bg-[#202533] border border-amber-500/40 text-amber-300 rounded-xl text-xs font-black active:scale-95 shadow-sm cursor-pointer text-center"
                >
                  2.5分
                </button>
                <button
                  type="button"
                  onClick={() => startRestTimer(180)}
                  className="flex-1 py-2 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-300 hover:text-white rounded-xl text-xs font-bold active:scale-95 cursor-pointer text-center"
                >
                  3分
                </button>
              </>
            )}
          </div>
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
                <div className="border-b border-[#262b3d]/60 pb-2 space-y-2">
                  {/* 第一行：動作序號 + 完整動作名稱 + PR 徽章（100% 完整寬度，永不擠壓、永不切字） */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-black bg-[#181b26] text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-lg shrink-0">
                      #{exIdx + 1}
                    </span>
                    <Dumbbell className="w-4 h-4 text-emerald-400 shrink-0" />
                    <h3 className="font-black text-gray-100 text-sm break-words flex-1 min-w-0 leading-tight">
                      {exercise?.name}
                    </h3>
                    {exSets.some((s) => isSetNewPR(s)) && (
                      <span className="text-[10px] font-black text-amber-300 bg-amber-500/20 border border-amber-400/50 px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0 shadow-sm animate-pulse">
                        <Trophy className="w-3.5 h-3.5 text-amber-300" />
                        <span>破紀錄 PR</span>
                      </span>
                    )}
                  </div>

                  {/* 第二行：組數標籤（左） + 操作按鈕群（右），自適應排版 */}
                  <div className="flex items-center justify-between gap-1.5 text-xs pt-0.5">
                    {/* 組數標籤：區分正式組與熱身組 */}
                    <div>
                      {(() => {
                        const warmupCount = exSets.filter((s) => isWarmupOrActivation(s)).length;
                        const formalCount = exSets.length - warmupCount;
                        if (warmupCount > 0) {
                          return (
                            <span className="text-xs bg-[#181b26] text-gray-300 px-2 py-0.5 rounded border border-[#262b3d] font-medium">
                              <span className="text-emerald-400 font-bold">{formalCount}</span> 正式
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
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
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
                </div>

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
                        className={`px-3 py-2.5 rounded-xl border transition-all ${
                          isCurrent
                            ? "bg-[#14261f] border-emerald-500 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/50"
                            : isDone
                            ? "bg-[#141722] border-[#262b3d]/60 opacity-80"
                            : "bg-[#181b26] border-[#262b3d]/80"
                        }`}
                      >
                        {/* 主行：勾 + 序號 + 重量文字 + 右側按鈕 */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* 打勾按鈕 — 加大為 w-7 h-7 提升健身房單手點擊體驗 */}
                          <button
                            type="button"
                            onClick={() => handleToggleSetCompleted(s.id)}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                              isDone
                                ? "bg-emerald-500 text-black border border-emerald-400 shadow"
                                : isCurrent
                                ? "bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 hover:bg-emerald-500 hover:text-black"
                                : "border border-gray-600 hover:border-emerald-400 text-transparent hover:text-emerald-400"
                            }`}
                            title={isDone ? "點擊取消完成" : "點擊標記此組完成"}
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                          </button>

                          {/* 序號標記 */}
                          {isWarmup ? (
                            <span
                              className="font-mono text-[11px] font-black px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 shrink-0"
                              title="熱身/準備組 (不計入正式組序號)"
                            >
                              {warmupLabel}
                            </span>
                          ) : (
                            <span
                              className={`font-mono font-bold ${isCurrent ? "text-emerald-400 font-black" : "text-gray-400"} w-5 shrink-0 text-xs sm:text-sm`}
                              title={`第 ${formalIndex} 正式組`}
                            >
                              #{formalIndex}
                            </span>
                          )}

                          {/* 重量文字：稍微放大至 text-sm，允許換行不截斷 */}
                          <span className={`text-[13px] sm:text-sm font-bold flex-1 min-w-0 break-words ${isDone ? "text-gray-400 line-through decoration-emerald-500/50" : isCurrent ? "text-white font-black" : "text-gray-100"}`}>
                            {cleanSetDisplay(s)}
                          </span>

                          {/* 右側：完成標記（桌機） + 編輯 + 刪除 */}
                          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                            {isCurrent && (
                              <button
                                type="button"
                                onClick={() => handleToggleSetCompleted(s.id)}
                                className="hidden sm:flex bg-emerald-500 hover:bg-emerald-400 text-black px-2 py-0.5 rounded-lg text-xs font-black items-center gap-1 cursor-pointer active:scale-95 transition-all shadow"
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>完成</span>
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={sIdx === 0}
                              onClick={() => handleMoveSet(s.id, "up")}
                              className="text-gray-500 hover:text-white disabled:opacity-20 p-1 rounded hover:bg-[#202533] transition-colors disabled:cursor-not-allowed"
                              title="此組上移"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={sIdx === exSets.length - 1}
                              onClick={() => handleMoveSet(s.id, "down")}
                              className="text-gray-500 hover:text-white disabled:opacity-20 p-1 rounded hover:bg-[#202533] transition-colors disabled:cursor-not-allowed"
                              title="此組下移"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
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

                        {/* 副行：上次紀錄 + PR + 進行中/完成 徽章 + 快速休息氣泡 */}
                        {(matchingGhost || isSetNewPR(s) || isCurrent || isDone || s.set_type === "drop" || restPromptSetId === s.id) && (
                          <div className="flex items-center gap-2 mt-1.5 ml-9 flex-wrap text-xs">
                            {/* 做組完成時彈出的極簡快速休息氣泡 */}
                            {restPromptSetId === s.id && !timerActive && (
                              <button
                                type="button"
                                onClick={() => {
                                  startRestTimer(defaultRestDuration || 150);
                                  setRestPromptSetId(null);
                                }}
                                className="animate-in fade-in zoom-in-95 duration-200 bg-amber-500 hover:bg-amber-400 text-black px-2.5 py-1 rounded-lg text-xs font-black shadow-lg flex items-center gap-1.5 active:scale-95 cursor-pointer ring-2 ring-amber-400/60"
                                title="一鍵啟動 2 分半組間休息計時"
                              >
                                <Timer className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>⏱️ 啟動 {Math.floor((defaultRestDuration || 150) / 60)}:{((defaultRestDuration || 150) % 60).toString().padStart(2, "0")} 休息</span>
                              </button>
                            )}
                            {matchingGhost && (
                              <span
                                className={`text-[11px] font-medium ${
                                  isCurrent ? "text-amber-300 font-bold" : "text-gray-400"
                                }`}
                                title={`上次此組實測：${cleanSetDisplay(matchingGhost)}`}
                              >
                                上次: {cleanSetDisplay(matchingGhost)}
                              </span>
                            )}
                            {(() => {
                              const prDetails = getSetPRDetails(s);
                              if (prDetails.isPR) {
                                return (
                                  <span
                                    className="px-2 py-0.5 rounded-lg text-[11px] font-black bg-gradient-to-r from-amber-500/25 via-yellow-500/30 to-amber-500/25 text-amber-300 border border-amber-400/60 flex items-center gap-1 shadow-md shadow-amber-500/10 animate-pulse"
                                    title={`突破個人歷史紀錄！(原最高：${prDetails.prevText})`}
                                  >
                                    <Trophy className="w-3 h-3 text-amber-300 shrink-0" />
                                    <span>PR 新高 {prDetails.diffText}</span>
                                  </span>
                                );
                              }
                              return null;
                            })()}
                            {s.set_type === "drop" && (
                              <span className="bg-amber-500/20 text-amber-300 text-[11px] px-1.5 py-0.5 rounded font-bold">
                                遞減
                              </span>
                            )}
                            {isCurrent && (
                              <span className="bg-emerald-500 text-black text-[11px] font-black px-1.5 py-0.5 rounded-md animate-pulse">
                                進行中
                              </span>
                            )}
                            {isDone && (
                              <span className="text-[11px] text-emerald-400 font-bold">
                                已完成 ✓
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* 動作卡片底部：＋ 多做一組快速加組按鈕 */}
                  {session.target_muscle !== "游泳" && exSets.length > 0 && (
                    <div className="pt-1.5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleAddOneMoreSet(exSets[exSets.length - 1])}
                        className="text-xs bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] hover:border-emerald-500/50 text-emerald-400 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-sm"
                        title="快速複製上一組的重量與次數加做一組"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        <span>＋ 多做一組 ({exSets[exSets.length - 1].weight_kg}Kg x {exSets[exSets.length - 1].reps})</span>
                      </button>
                    </div>
                  )}
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
            <button
              type="button"
              onClick={handleFinishWorkout}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-black py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition-all active:scale-98 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>完成並返回訓練日誌</span>
            </button>
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

          {/* 部位篩選標籤 + 搜尋 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-1.5 flex-wrap">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                <button
                  type="button"
                  onClick={() => setDockMuscleFilter("default")}
                  className={`text-xs px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                    dockMuscleFilter === "default"
                      ? "bg-emerald-500 text-black shadow-sm font-black"
                      : "bg-[#181b26] text-gray-400 hover:text-white border border-[#262b3d]"
                  }`}
                >
                  推薦 ({session.target_muscle})
                </button>
                <button
                  type="button"
                  onClick={() => setDockMuscleFilter("all")}
                  className={`text-xs px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                    dockMuscleFilter === "all"
                      ? "bg-emerald-500 text-black shadow-sm font-black"
                      : "bg-[#181b26] text-gray-400 hover:text-white border border-[#262b3d]"
                  }`}
                >
                  全部
                </button>
                {(["胸", "背", "腿", "肩"] as const).map((mg) => (
                  <button
                    key={mg}
                    type="button"
                    onClick={() => setDockMuscleFilter(mg)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                      dockMuscleFilter === mg
                        ? "bg-emerald-500 text-black shadow-sm font-black"
                        : "bg-[#181b26] text-gray-400 hover:text-white border border-[#262b3d]"
                    }`}
                  >
                    {mg}
                  </button>
                ))}
              </div>

              {/* 動作快速搜尋 */}
              <div className="relative shrink-0">
                <input
                  type="text"
                  placeholder="搜尋動作..."
                  value={dockExerciseSearch}
                  onChange={(e) => setDockExerciseSearch(e.target.value)}
                  className="w-24 sm:w-28 bg-[#181b26] border border-[#262b3d] text-white text-[11px] rounded-lg pl-2 pr-5 py-1 outline-none focus:border-emerald-500 placeholder-gray-500"
                />
                {dockExerciseSearch && (
                  <button
                    type="button"
                    onClick={() => setDockExerciseSearch("")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* 動作切換膠囊 */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {displayExercises.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => handleSelectExercise(ex.id)}
                  className={`text-xs sm:text-sm px-3.5 py-2 rounded-xl border shrink-0 transition-all font-bold cursor-pointer ${
                    selectedExId === ex.id
                      ? "bg-emerald-500 text-black border-emerald-400 shadow-md font-black"
                      : "bg-[#181b26] border-[#262b3d] text-gray-300 hover:text-white"
                  }`}
                >
                  {ex.name}
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  const m =
                    dockMuscleFilter !== "default" && dockMuscleFilter !== "all"
                      ? (dockMuscleFilter as MuscleGroup)
                      : ((session.target_muscle || "").replace("部", "").slice(0, 1) as MuscleGroup);
                  const validM: MuscleGroup = ["胸", "背", "腿", "肩"].includes(m) ? m : "胸";
                  setNewExMuscle(validM);
                  setShowNewExerciseModal(true);
                }}
                className="text-xs sm:text-sm px-3 py-2 rounded-xl border border-dashed border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 shrink-0 font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                title="自訂建立新動作（如啞鈴側平舉）"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>自訂動作</span>
              </button>
            </div>
          </div>

          {/* 組別模式切換：正式組、熱身組、遞減組 */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setInputType("normal")}
              className={`py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
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
              className={`py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
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
              className={`py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
                inputType === "drop"
                  ? "bg-amber-500 text-black border-amber-400 font-black shadow-sm"
                  : "bg-[#181b26] text-gray-400 border-[#262b3d]"
              }`}
            >
              遞減模式
            </button>
          </div>

          {/* 主輸入框：重量 (Kg) 與 次數 (次) - 直接輸入，無步進廢鍵 */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs text-gray-300 block mb-1 font-bold">重量 (Kg)</label>
              <input
                type="number"
                step="any"
                placeholder="60"
                value={inputWeight}
                onChange={(e) => setInputWeight(e.target.value)}
                className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xl font-black rounded-xl p-3 text-center focus:border-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-gray-300 block mb-1 font-bold">次數 (下)</label>
              <input
                type="number"
                placeholder="8"
                value={inputReps}
                onChange={(e) => setInputReps(e.target.value)}
                className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xl font-black rounded-xl p-3 text-center focus:border-emerald-500 outline-none"
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
            className="w-full bg-[#181b26] hover:bg-[#202533] border border-emerald-500/40 text-emerald-300 disabled:opacity-40 font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:cursor-not-allowed shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>＋ 加入此組至紀錄</span>
          </button>
        </div>
      )}

      {/* 完成本次訓練主要按鈕 */}
      <div className="pt-2 pb-8 space-y-2">
        <button
          type="button"
          onClick={handleFinishWorkout}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-4 rounded-2xl shadow-2xl transition-all active:scale-[0.98] text-base sm:text-lg flex items-center justify-center gap-2 cursor-pointer"
        >
          <Check className="w-5 h-5 stroke-[3]" />
          <span>完成本次訓練並儲存 (返回日誌)</span>
        </button>
        <p className="text-center text-xs text-gray-400 font-medium">
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
                const currentSessionExIds = new Set(sets.map((s) => s.exercise_id));
                const available = exercises.filter((e) => {
                  if (e.id === swapSourceExercise.id) return false;
                  if (currentSessionExIds.has(e.id)) return false; // 嚴格排除本次訓練已包含的動作，防組數混雜
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
      {/* 退出確認 Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#12141c] border border-[#262b3d] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#262b3d] pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <h3 className="font-bold text-white text-base">
                  {completedSetsCount === 0 ? "尚未開始訓練" : "訓練尚未全部完成"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="text-gray-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-gray-300 space-y-2">
              {completedSetsCount === 0 ? (
                <p>
                  本次訓練尚未完成任何組數。若現在退出，您可以選擇直接放棄刪除，或保留為待辦草稿。
                </p>
              ) : (
                <p>
                  本次訓練預排了 <span className="text-white font-bold">{totalSetsCount}</span> 組，目前已打勾完成{" "}
                  <span className="text-emerald-400 font-bold">{completedSetsCount}</span> 組，還有{" "}
                  <span className="text-amber-400 font-bold">{totalSetsCount - completedSetsCount}</span> 組尚未完成。
                </p>
              )}
            </div>

            <div className="space-y-2 pt-1">
              {completedSetsCount === 0 ? (
                <>
                  <button
                    type="button"
                    onClick={handleAbandonSessionAndExit}
                    className="w-full text-left p-3 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <span className="text-xs font-bold text-red-300 block">放棄並刪除本次訓練</span>
                      <span className="text-[11px] text-gray-400">清除此場次，不留下任何空白假紀錄</span>
                    </div>
                    <span className="text-xs text-red-400 font-bold shrink-0">確認放棄 ➔</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveAsDraftAndExit}
                    className="w-full text-left p-3 rounded-xl bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <span className="text-xs font-bold text-amber-300 block">保留為進行中草稿</span>
                      <span className="text-[11px] text-gray-400">保留在日誌首頁標記為「進行中」，稍後隨時繼續</span>
                    </div>
                    <span className="text-xs text-amber-400 font-bold shrink-0">存為草稿 ➔</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handlePruneAndFinish}
                    className="w-full text-left p-3 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <span className="text-xs font-black text-emerald-300 block">
                        結束訓練，只儲存已做的 {completedSetsCount} 組
                      </span>
                      <span className="text-[11px] text-gray-400">
                        自動清除未做的 {totalSetsCount - completedSetsCount} 組預排組數，忠實記錄訓練
                      </span>
                    </div>
                    <span className="text-xs text-emerald-400 font-bold shrink-0">結算保存 ➔</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveAsDraftAndExit}
                    className="w-full text-left p-3 rounded-xl bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <span className="text-xs font-bold text-amber-300 block">
                        保留為進行中草稿（稍後繼續訓練）
                      </span>
                      <span className="text-[11px] text-gray-400">
                        保留未做組數，首頁標記為「進行中」，方便稍後接續完成
                      </span>
                    </div>
                    <span className="text-xs text-amber-400 font-bold shrink-0">暫存草稿 ➔</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="w-full bg-[#181b26] text-gray-300 py-2.5 rounded-xl text-xs font-bold hover:bg-[#202533] cursor-pointer mt-1"
              >
                繼續訓練
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 完成訓練確認 Modal (有未完成組數時) */}
      {showFinishModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#12141c] border border-emerald-500/40 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#262b3d] pb-3">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-400 stroke-[3] shrink-0" />
                <h3 className="font-bold text-white text-base">結算本次訓練</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFinishModal(false)}
                className="text-gray-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-gray-300 space-y-1.5">
              <p>
                規劃組數共 <span className="text-white font-bold">{totalSetsCount}</span> 組，目前已完成打勾{" "}
                <span className="text-emerald-400 font-bold">{completedSetsCount}</span> 組，尚有{" "}
                <span className="text-amber-400 font-bold">{totalSetsCount - completedSetsCount}</span> 組未完成。
              </p>
              <p className="text-gray-400 text-[11px]">
                請選擇本次訓練的結算方式：
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handlePruneAndFinish}
                className="w-full text-left p-3 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-emerald-300 block">
                      清除未做組數，只儲存已完成的 {completedSetsCount} 組
                    </span>
                    <span className="text-[10px] bg-emerald-500 text-black px-1.5 py-0.5 rounded font-black">
                      推薦
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400 block mt-0.5">
                    不會把沒做的組數算進紀錄，真實反映今天訓練量
                  </span>
                </div>
                <span className="text-xs text-emerald-400 font-bold shrink-0">確認結算 ➔</span>
              </button>

              <button
                type="button"
                onClick={handleMarkAllCompletedAndFinish}
                className="w-full text-left p-3 rounded-xl bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] transition-all flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <span className="text-xs font-bold text-gray-200 block">
                    將全部 {totalSetsCount} 組標記為已完成
                  </span>
                  <span className="text-[11px] text-gray-400 block mt-0.5">
                    若現場已全部做完但剛剛忘記打勾，一鍵全部打勾結算
                  </span>
                </div>
                <span className="text-xs text-gray-300 font-bold shrink-0">全部完成 ➔</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFinishModal(false)}
                className="w-full bg-[#181b26] text-gray-300 py-2.5 rounded-xl text-xs font-bold hover:bg-[#202533] cursor-pointer mt-1"
              >
                返回繼續記錄
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🏆 PR 突破個人紀錄即時高光慶祝橫幅 (自動浮現 5.5 秒或手動關閉) */}
      {prCelebration && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm animate-in zoom-in-95 duration-200">
          <div className="bg-gradient-to-b from-[#241a06] via-[#1a1408] to-[#120e06] border-2 border-amber-400/90 backdrop-blur-md rounded-2xl p-4 shadow-2xl shadow-amber-500/30 space-y-2 text-center relative overflow-hidden">
            {/* 金色光暈背板 */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-400/15 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between relative">
              <div className="flex items-center gap-1.5 text-amber-300 font-black text-xs tracking-wider">
                <Trophy className="w-4 h-4 text-amber-300 animate-bounce" />
                <span>突破個人新高 (PR)！🎉</span>
              </div>
              <button
                type="button"
                onClick={() => setPrCelebration(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg cursor-pointer"
                title="關閉提示"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="relative space-y-0.5">
              <h4 className="text-white font-black text-base">
                {prCelebration.exerciseName}
              </h4>
              <div className="text-2xl font-black text-amber-300 tracking-tight">
                {prCelebration.weight}Kg × {prCelebration.reps}下
              </div>
            </div>

            <div className="inline-flex items-center gap-1 bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold px-3 py-1 rounded-full relative">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>實質突破 {prCelebration.diffText}（歷史原最高：{prCelebration.prevText}）</span>
            </div>
          </div>
        </div>
      )}

      {/* 做組打勾完成後，螢幕底部大拇指極速快捷休息氣泡 (5秒自動消失) */}
      {restPromptSetId && !timerActive && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <button
            type="button"
            onClick={() => {
              startRestTimer(defaultRestDuration || 150);
              setRestPromptSetId(null);
            }}
            className="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black px-4 py-2.5 rounded-full font-black text-xs shadow-2xl flex items-center gap-2 ring-4 ring-amber-400/40 active:scale-95 cursor-pointer transition-all"
          >
            <Timer className="w-4 h-4 stroke-[2.5]" />
            <span>⏱️ 啟動 {Math.floor((defaultRestDuration || 150) / 60)}:{((defaultRestDuration || 150) % 60).toString().padStart(2, "0")} 休息</span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                setRestPromptSetId(null);
              }}
              className="ml-1 p-0.5 rounded-full hover:bg-black/20 text-black/70 hover:text-black cursor-pointer"
              title="關閉提示"
            >
              <X className="w-3 h-3" />
            </span>
          </button>
        </div>
      )}

      {/* 🚀 浮動吸頂/吸底休息倒數膠囊 (無論滑到哪裡，隨時直覺掌握剩餘休息秒數，不必滑回頂部) */}
      {timerActive && timerSeconds !== null && timerSeconds > 0 && (
        <div className="fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-auto">
          <div className="bg-[#12141c]/95 border-2 border-amber-400 backdrop-blur-md px-4 py-2 rounded-full shadow-2xl shadow-amber-500/30 flex items-center gap-2.5 text-white">
            <div className="flex items-center gap-1.5 text-amber-400 font-mono font-black text-sm">
              <Timer className="w-4 h-4 animate-spin" style={{ animationDuration: "3s" }} />
              <span>
                {Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, "0")}
              </span>
            </div>
            <div className="h-4 w-px bg-white/20" />
            <button
              type="button"
              onClick={() => adjustRestSeconds(-30)}
              className="text-[11px] font-black bg-red-500/20 hover:bg-red-500/30 text-red-300 px-2 py-0.5 rounded-full border border-red-500/40 active:scale-95 transition-all cursor-pointer"
              title="減少 30 秒"
            >
              -30s
            </button>
            <button
              type="button"
              onClick={() => adjustRestSeconds(30)}
              className="text-[11px] font-black bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/40 active:scale-95 transition-all cursor-pointer"
              title="增加 30 秒"
            >
              +30s
            </button>
            <button
              type="button"
              onClick={stopRestTimer}
              className="text-gray-400 hover:text-white p-0.5 rounded-full hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
              title="結束計時"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 現場自訂建立新動作 Modal (隨時自訂啞鈴側平舉等新器材/動作) */}
      {showNewExerciseModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#12141c] border border-emerald-500/40 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#262b3d] pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400 stroke-[3]" />
                <h3 className="font-bold text-white text-base">現場自訂新動作</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewExerciseModal(false)}
                className="text-gray-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-300 block mb-1 font-bold">動作名稱</label>
                <input
                  type="text"
                  placeholder="例如：啞鈴側平舉、羅馬尼亞硬舉"
                  value={newExName}
                  onChange={(e) => setNewExName(e.target.value)}
                  className="w-full bg-[#181b26] border border-[#262b3d] text-white text-sm rounded-xl p-3 focus:border-emerald-500 outline-none font-bold"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs text-gray-300 block mb-1 font-bold">訓練部位</label>
                <select
                  value={newExMuscle}
                  onChange={(e) => setNewExMuscle(e.target.value as MuscleGroup)}
                  className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-2.5 focus:border-emerald-500 outline-none"
                >
                  <option value="胸">胸部</option>
                  <option value="背">背部</option>
                  <option value="腿">腿部</option>
                  <option value="肩">肩部</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-300 block mb-1 font-bold">重量類型</label>
                <select
                  value={newExType}
                  onChange={(e) => setNewExType(e.target.value as WeightType)}
                  className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-2.5 focus:border-emerald-500 outline-none"
                >
                  <option value="dumbbell_single">啞鈴重量 (單邊，如側平舉)</option>
                  <option value="barbell_total">槓鈴標準總重 (包含 20Kg 槓重)</option>
                  <option value="machine_stack">機械插銷重量 (總重)</option>
                  <option value="machine_single">機械掛片單邊重量</option>
                  <option value="bodyweight">自身體重 (自重引體/伏地挺身)</option>
                  <option value="assisted_inverse">輔助反向機 (配重越重越輕鬆)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewExerciseModal(false)}
                className="flex-1 bg-[#181b26] text-gray-300 py-2.5 rounded-xl text-xs font-bold hover:bg-[#202533] cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                disabled={!newExName.trim()}
                onClick={handleCreateCustomExercise}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black py-2.5 rounded-xl text-xs font-black shadow transition-all cursor-pointer"
              >
                建立並立即選取
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

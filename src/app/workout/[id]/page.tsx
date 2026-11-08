"use client";

import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  History,
  Timer,
  Play,
  Pause,
  RotateCcw,
  X,
  Volume2,
  Dumbbell,
  Sparkles,
  Pencil,
  Edit3,
  Calendar,
  MapPin,
  Copy,
  FileText,
  Calculator,
  Trophy,
  Repeat,
  Check,
  ChevronUp,
  ChevronDown,
  VolumeX,
  Share2,
  Flame,
  BookOpen,
  RefreshCw,
} from "lucide-react";
import { db } from "@/lib/db/schema";
import {
  getLastExerciseSets,
  getPreviousSessionTemplate,
  getExerciseMaxPR,
  getExerciseHistorySessions,
} from "@/lib/db/crud";
import {
  calculate1RM,
  calculateBarbellPlates,
  generateWarmupPlan,
  type WarmupSetPlan,
} from "@/lib/calc";
import { formatSessionToMarkdown } from "@/lib/markdown-generator";
import type { Exercise, SetItem, WorkoutSession, WeightType, MuscleGroup, SetType } from "@/lib/types";

function matchesTargetMuscle(ex: Exercise, target: string): boolean {
  if (!target) return true;
  if (target.includes("胸")) {
    if (
      ex.muscle_group === "胸部" ||
      ex.name.includes("胸") ||
      ex.name.includes("臥推") ||
      ex.name.includes("夾胸")
    )
      return true;
    if (target.includes("三頭") && (ex.name.includes("三頭") || ex.muscle_group === "手臂"))
      return true;
  }
  if (target.includes("背")) {
    if (
      ex.muscle_group === "背部" ||
      ex.name.includes("背") ||
      ex.name.includes("划船") ||
      ex.name.includes("下拉") ||
      ex.name.includes("引體向上") ||
      ex.name.includes("硬舉")
    )
      return true;
    if (target.includes("二頭") && (ex.name.includes("二頭") || ex.muscle_group === "手臂"))
      return true;
  }
  if (target.includes("腿")) {
    if (
      ex.muscle_group === "腿部" ||
      ex.name.includes("腿") ||
      ex.name.includes("蹲") ||
      ex.name.includes("推蹬") ||
      ex.name.includes("勾") ||
      ex.name.includes("伸展")
    )
      return true;
  }
  if (target.includes("肩")) {
    if (
      ex.muscle_group === "肩部" ||
      ex.name.includes("肩") ||
      ex.name.includes("推舉") ||
      ex.name.includes("側平舉")
    )
      return true;
  }
  if (target.includes("游泳")) {
    if (ex.muscle_group === "游泳" || ex.name.includes("游泳")) return true;
  }
  return ex.muscle_group.includes(target) || target.includes(ex.muscle_group);
}

const FEELING_TAGS = [
  "力竭",
  "完全力竭",
  "強迫次數",
  "遞減組",
  "熱身",
  "神經激發",
  "感受度佳",
  "補1",
  "補2",
  "姿勢良好",
];

const LOCATION_PRESETS = [
  "交大健身房",
  "三劍客",
  "學校健身房",
  "健身工廠",
  "成吉思汗",
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
  const [maxPrMap, setMaxPrMap] = useState<Record<string, { maxWeight: number; max1RM: number }>>({});

  // 整場訓練編輯 Modal
  const [showEditSessionModal, setShowEditSessionModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTargetMuscle, setEditTargetMuscle] = useState("");
  const [editLocation, setEditLocation] = useState("");

  // 單組編輯狀態
  const [editingSet, setEditingSet] = useState<SetItem | null>(null);
  const [editSetWeight, setEditSetWeight] = useState("");
  const [editSetReps, setEditSetReps] = useState("");
  const [editSetType, setEditSetType] = useState<SetType>("normal");
  const [editSetNotes, setEditSetNotes] = useState("");

  // 快速加組表單狀態
  const [selectedExId, setSelectedExId] = useState<string>("");
  const [inputWeight, setInputWeight] = useState<string>("");
  const [inputReps, setInputReps] = useState<string>("");
  const [inputType, setInputType] = useState<SetType>("normal");
  const [inputNotes, setInputNotes] = useState<string>("");

  // Markdown 檢視與複製 Modal
  const [showMarkdownModal, setShowMarkdownModal] = useState(false);
  const [copyToast, setCopyToast] = useState(false);

  // 槓鈴片計算器 Modal
  const [showPlateCalcModal, setShowPlateCalcModal] = useState(false);
  const [plateCalcWeight, setPlateCalcWeight] = useState<number>(60);
  const [barWeight, setBarWeight] = useState<number>(20);

  // 複製上一次菜單功能
  const [showCloneConfirm, setShowCloneConfirm] = useState(false);
  const [prevTemplateInfo, setPrevTemplateInfo] = useState<{
    date: string;
    title: string;
    setCount: number;
    exCount: number;
    sets: SetItem[];
  } | null>(null);

  // 自訂新動作模式
  const [showAddCustom, setShowAddCustom] = useState<boolean>(false);
  const [newExName, setNewExName] = useState<string>("");
  const [newExWeightType, setNewExWeightType] = useState<WeightType>("barbell_total");

  // 熱身組規劃 Modal
  const [showWarmupModal, setShowWarmupModal] = useState(false);

  // 查看動作歷史記錄 Drawer / Modal
  const [viewHistoryEx, setViewHistoryEx] = useState<{
    exercise: Exercise;
    history: { session: WorkoutSession; sets: SetItem[] }[];
  } | null>(null);

  // 替換動作 Modal (機台有人用時一鍵換動作)
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapSourceExercise, setSwapSourceExercise] = useState<Exercise | null>(null);
  const [swapSearchQuery, setSwapSearchQuery] = useState("");

  // 組間休息計時器狀態 (時間戳基準，背景不暫停)
  const [targetEndTime, setTargetEndTime] = useState<number | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const [autoTimerEnabled, setAutoTimerEnabled] = useState<boolean>(true);
  const [defaultRestDuration, setDefaultRestDuration] = useState<number>(90);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 提示音效與震動
  function playAlarm() {
    if (!isMuted) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc.start();
        osc.stop(ctx.currentTime + 0.8);
      } catch {}
    }

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 400]);
    }
  }

  // 背景安全的真實時間戳計時器倒數
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
        playAlarm();
      } else {
        setTimerSeconds(remain);
      }
    }

    if (timerActive && targetEndTime) {
      checkTimer();
      timerIntervalRef.current = setInterval(checkTimer, 500);
      window.addEventListener("visibilitychange", checkTimer);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      window.removeEventListener("visibilitychange", checkTimer);
    };
  }, [timerActive, targetEndTime, isMuted]);

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

  function stopRestTimer() {
    setTimerActive(false);
    setTimerSeconds(null);
    setTargetEndTime(null);
    localStorage.removeItem("workout_timer_end");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("workout_timer_update"));
    }
  }

  function adjustTimer(delta: number) {
    if (targetEndTime) {
      const newEnd = targetEndTime + delta * 1000;
      setTargetEndTime(newEnd);
      const remain = Math.max(0, Math.ceil((newEnd - Date.now()) / 1000));
      setTimerSeconds(remain);
      localStorage.setItem("workout_timer_end", newEnd.toString());
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("workout_timer_update"));
      }
    } else if (timerSeconds !== null) {
      startRestTimer(Math.max(10, timerSeconds + delta));
    }
  }

  // 批次加入熱身組
  async function handleAddWarmupSets(plan: WarmupSetPlan[]) {
    if (!selectedExId || plan.length === 0) return;
    const baseOrder = sets.length;
    const newSets: SetItem[] = plan.map((p, i) => ({
      id: `set-${Date.now()}-${baseOrder + i + 1}`,
      session_id: id,
      exercise_id: selectedExId,
      set_order: baseOrder + i + 1,
      set_type: p.type,
      weight_kg: p.weightKg,
      reps: p.reps,
      raw_text: `${p.weightKg}Kg x${p.reps} ${p.label}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    }));

    await db.sets.bulkAdd(newSets);
    setSets((prev) => [...prev, ...newSets]);
    setShowWarmupModal(false);
  }

  // 查詢動作過往歷史紀錄
  async function handleOpenExerciseHistory(ex: Exercise) {
    const history = await getExerciseHistorySessions(ex.id, 5);
    setViewHistoryEx({ exercise: ex, history });
  }

  // 切換動作時智慧預填上一組數據
  function handleSelectExercise(exId: string) {
    setSelectedExId(exId);
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
        setEditLocation(sess.location || "");

        const allEx = await db.exercises.toArray();
        setExercises(allEx);

        const currentSets = await db.sets
          .where("session_id")
          .equals(id)
          .filter((s) => !s.deleted_at)
          .sortBy("set_order");
        setSets(currentSets);

        // 載入動作最高 PR
        const prRecord: Record<string, { maxWeight: number; max1RM: number }> = {};
        for (const ex of allEx) {
          const pr = await getExerciseMaxPR(ex.id);
          prRecord[ex.id] = { maxWeight: pr.maxWeight, max1RM: pr.max1RM };
        }
        setMaxPrMap(prRecord);

        // 檢查是否有同部位上一次菜單
        const prevMatch = await getPreviousSessionTemplate(sess.target_muscle);
        if (prevMatch && prevMatch.session.id !== id && prevMatch.sets.length > 0) {
          setPrevTemplateInfo({
            date: prevMatch.session.date,
            title: prevMatch.session.display_title,
            setCount: prevMatch.sets.length,
            exCount: prevMatch.exerciseIds.length,
            sets: prevMatch.sets,
          });
        }

        const distinctExIds = Array.from(new Set(currentSets.map((s) => s.exercise_id)));
        const ghostRecord: Record<string, SetItem[]> = {};
        for (const exId of distinctExIds) {
          const res = await getLastExerciseSets(exId, id);
          if (res) ghostRecord[exId] = res.sets;
        }
        setGhostMap(ghostRecord);

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
          const targetMatches = allEx.filter((e) => matchesTargetMuscle(e, sess.target_muscle));
          const initial = targetMatches.length > 0 ? targetMatches[0] : allEx[0];
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

  // 使用者自訂新增動作
  async function handleCreateCustomExercise() {
    if (!newExName.trim() || !session) return;

    let group: MuscleGroup = "胸部";
    if (session.target_muscle.includes("背")) group = "背部";
    else if (session.target_muscle.includes("腿")) group = "腿部";
    else if (session.target_muscle.includes("肩")) group = "肩部";

    const customId = `custom-ex-${Date.now()}`;
    const newEx: Exercise = {
      id: customId,
      name: newExName.trim(),
      muscle_group: group,
      weight_type: newExWeightType,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.exercises.add(newEx);
    setExercises((prev) => [...prev, newEx]);
    handleSelectExercise(customId);
    setNewExName("");
    setShowAddCustom(false);
  }

  // 儲存整場訓練編輯 (修改標題、日期、部位、場地)
  async function handleSaveEditSession() {
    if (!session || !editTitle.trim() || !editDate) return;
    const parts = editDate.split("-");
    const monthKey = `${parts[0]}-${parts[1]}`;

    const updated: WorkoutSession = {
      ...session,
      display_title: editTitle.trim(),
      date: editDate,
      month_key: monthKey,
      target_muscle: editTargetMuscle,
      location: editLocation.trim() || undefined,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.sessions.put(updated);
    setSession(updated);
    setShowEditSessionModal(false);
  }

  // 刪除整場訓練
  async function handleDeleteEntireSession() {
    if (!confirm(`確定要刪除這場訓練【${session?.display_title}】嗎？\n所有已記錄的組數都會被永久清除。`)) {
      return;
    }

    await db.transaction("rw", [db.sessions, db.sets], async () => {
      await db.sets.where("session_id").equals(id).delete();
      await db.sessions.delete(id);
    });

    router.push("/");
  }

  // 開啟修改單組
  function handleStartEditSet(s: SetItem) {
    setEditingSet(s);
    setEditSetWeight(s.weight_kg.toString());
    setEditSetReps(s.reps.toString());
    setEditSetType(s.set_type);
    setEditSetNotes(s.feedback || s.notes || "");
  }

  // 儲存修改單組
  async function handleSaveEditSet() {
    if (!editingSet) return;
    const wNum = parseFloat(editSetWeight) || 0;
    const rNum = parseInt(editSetReps, 10) || 0;

    let generatedRaw = `${wNum}Kg x${rNum}`;
    if (editSetType === "warmup") generatedRaw += " 熱身";
    if (editSetType === "primer") generatedRaw += " 神經激發";
    if (editSetNotes.trim()) generatedRaw += ` ${editSetNotes.trim()}`;

    const updated: SetItem = {
      ...editingSet,
      weight_kg: wNum,
      reps: rNum,
      set_type: editSetType,
      raw_text: generatedRaw,
      feedback: editSetNotes || undefined,
      notes: editSetNotes || undefined,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.sets.put(updated);
    setSets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setEditingSet(null);
  }

  // 快速新增單組
  async function handleAddSet() {
    if (!selectedExId || !inputReps) return;

    const newOrder = sets.length + 1;
    const weightNum = parseFloat(inputWeight) || 0;
    const repsNum = parseInt(inputReps, 10) || 0;

    const exSets = sets.filter((s) => s.exercise_id === selectedExId);
    const formalIndex = exSets.filter((s) => s.set_type === "normal").length + 1;

    let raw = "";
    if (inputType === "warmup") {
      raw = `${weightNum}Kg x${repsNum} 熱身`;
    } else if (inputType === "primer") {
      raw = `${weightNum}Kg x${repsNum} 神經激發`;
    } else {
      raw = `set ${formalIndex}: ${weightNum}Kg x${repsNum}`;
    }

    if (inputNotes.trim()) {
      raw += ` ${inputNotes.trim()}`;
    }

    const isFailure = inputNotes.includes("力竭") || inputType === "cooldown";

    const newSet: SetItem = {
      id: `set-${Date.now()}-${newOrder}`,
      session_id: id,
      exercise_id: selectedExId,
      set_order: newOrder,
      set_type: inputType,
      weight_kg: weightNum,
      reps: repsNum,
      raw_text: raw,
      is_failure: isFailure,
      feedback: inputNotes || undefined,
      notes: inputNotes || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.sets.add(newSet);
    setSets((prev) => [...prev, newSet]);

    // 更新 ghost 對照
    if (!ghostMap[selectedExId]) {
      const res = await getLastExerciseSets(selectedExId, id);
      if (res) {
        setGhostMap((prev) => ({ ...prev, [selectedExId]: res.sets }));
      }
    }

    if (autoTimerEnabled) {
      startRestTimer(defaultRestDuration);
    }

    if (isNewPR && typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([150, 80, 250]);
    }

    setInputNotes("");
  }

  // 一鍵重複上一組 (Duplicate Last Set)
  async function handleRepeatLastSet() {
    if (!selectedExId) return;
    const exSets = sets.filter((s) => s.exercise_id === selectedExId);
    if (exSets.length === 0) return;
    const last = exSets[exSets.length - 1];

    setInputWeight(last.weight_kg.toString());
    setInputReps(last.reps.toString());
    setInputType(last.set_type);
    setInputNotes(last.notes || "");

    const newOrder = sets.length + 1;
    const formalIndex = exSets.filter((s) => s.set_type === "normal").length + 1;
    let raw = `set ${formalIndex}: ${last.weight_kg}Kg x${last.reps}`;
    if (last.set_type === "warmup") raw = `${last.weight_kg}Kg x${last.reps} 熱身`;

    const newSet: SetItem = {
      id: `set-${Date.now()}-${newOrder}`,
      session_id: id,
      exercise_id: selectedExId,
      set_order: newOrder,
      set_type: last.set_type,
      weight_kg: last.weight_kg,
      reps: last.reps,
      raw_text: raw,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.sets.add(newSet);
    setSets((prev) => [...prev, newSet]);

    if (autoTimerEnabled) {
      startRestTimer(defaultRestDuration);
    }
  }

  // 刪除組數
  async function handleDeleteSet(setId: string) {
    if (!confirm("確定要刪除此組紀錄嗎？")) return;
    await db.sets.delete(setId);
    setSets((prev) => prev.filter((s) => s.id !== setId));
  }

  // 替換整套動作 (機台被佔用時快速換成同部位其他動作)
  async function handleConfirmSwapExercise(targetId: string) {
    if (!swapSourceExercise || !targetId || swapSourceExercise.id === targetId) return;

    const targetEx = exercises.find((e) => e.id === targetId);
    if (!targetEx) return;

    const setsToUpdate = sets.filter((s) => s.exercise_id === swapSourceExercise.id);
    for (const s of setsToUpdate) {
      await db.sets.update(s.id, {
        exercise_id: targetId,
        updated_at: new Date().toISOString(),
      });
    }

    setSets((prev) =>
      prev.map((s) => {
        if (s.exercise_id === swapSourceExercise.id) {
          return { ...s, exercise_id: targetId, updated_at: new Date().toISOString() };
        }
        return s;
      })
    );

    setSelectedExId(targetId);
    setShowSwapModal(false);
    setSwapSourceExercise(null);
    setSwapSearchQuery("");

    // 更新 PR 與歷史對照
    const pr = await getExerciseMaxPR(targetId);
    setMaxPrMap((prev) => ({ ...prev, [targetId]: pr }));
    const lastRes = await getLastExerciseSets(targetId, id);
    if (lastRes) {
      setGhostMap((prev) => ({ ...prev, [targetId]: lastRes.sets }));
    }
  }

  // 刪除該動作在本次訓練的所有組數
  async function handleDeleteAllSetsOfExercise(exercise: Exercise) {
    if (!confirm(`確定要刪除今天【${exercise.name}】的全部組數紀錄嗎？`)) return;
    const setsToDelete = sets.filter((s) => s.exercise_id === exercise.id);
    for (const s of setsToDelete) {
      await db.sets.delete(s.id);
    }
    setSets((prev) => prev.filter((s) => s.exercise_id !== exercise.id));
  }

  // 複製上一次同部位菜單組數
  async function handleApplyPrevMenu() {
    if (!prevTemplateInfo || prevTemplateInfo.sets.length === 0) return;
    if (!confirm(`確定要將【${prevTemplateInfo.date}】的菜單動作與組數匯入當前訓練嗎？`)) return;

    const baseOrder = sets.length;
    const newSets: SetItem[] = prevTemplateInfo.sets.map((s, idx) => ({
      id: `set-${Date.now()}-${baseOrder + idx + 1}`,
      session_id: id,
      exercise_id: s.exercise_id,
      set_order: baseOrder + idx + 1,
      set_type: s.set_type,
      weight_kg: s.weight_kg,
      reps: s.reps,
      raw_text: s.raw_text,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    }));

    await db.sets.bulkAdd(newSets);
    setSets((prev) => [...prev, ...newSets]);
    setShowCloneConfirm(false);
    alert(`成功匯入 ${newSets.length} 組訓練動作！`);
  }

  // 一鍵複製 Markdown
  function handleCopyMarkdown() {
    if (!session) return;
    const md = formatSessionToMarkdown(session, sets, exercises);
    navigator.clipboard.writeText(md);
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2500);
  }

  // 原生系統分享
  async function handleShareSession() {
    if (!session) return;
    const md = formatSessionToMarkdown(session, sets, exercises);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: session.display_title,
          text: md,
        });
        return;
      } catch {}
    }
    navigator.clipboard.writeText(md);
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2500);
  }

  // 調整組數上下移動順序
  async function handleMoveSet(setId: string, direction: "up" | "down") {
    const idx = sets.findIndex((s) => s.id === setId);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === sets.length - 1) return;

    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    const newSets = [...sets];
    const temp = newSets[idx];
    newSets[idx] = newSets[targetIdx];
    newSets[targetIdx] = temp;

    newSets.forEach((s, i) => {
      s.set_order = i + 1;
    });

    await db.transaction("rw", db.sets, async () => {
      for (const s of newSets) {
        await db.sets.put(s);
      }
    });

    setSets(newSets);
  }

  // 體感 Tag 單擊切換 / 加入
  function handleToggleFeelingTag(tag: string) {
    if (tag === "熱身") {
      setInputType("warmup");
      return;
    }
    if (tag === "神經激發") {
      setInputType("primer");
      return;
    }
    if (tag === "遞減組") {
      setInputType("drop");
      return;
    }
    if (inputNotes.includes(tag)) {
      setInputNotes((prev) => prev.replace(tag, "").trim());
    } else {
      setInputNotes((prev) => (prev ? `${prev} ${tag}` : tag));
    }
  }

  // 微調重量
  function adjustWeight(delta: number) {
    const cur = parseFloat(inputWeight) || 0;
    const next = Math.max(0, cur + delta);
    setInputWeight(next.toString());
  }

  // 微調次數
  function adjustReps(delta: number) {
    const cur = parseInt(inputReps, 10) || 0;
    const next = Math.max(1, cur + delta);
    setInputReps(next.toString());
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

  const displayExercises = exercises
    .filter((e) => matchesTargetMuscle(e, session.target_muscle))
    .sort((a, b) => {
      if (a.is_favorite && !b.is_favorite) return -1;
      if (!a.is_favorite && b.is_favorite) return 1;
      return 0;
    });

  const current1RM = calculate1RM(parseFloat(inputWeight) || 0, parseInt(inputReps, 10) || 0);
  const exercisePR = selectedExId ? maxPrMap[selectedExId] : null;
  const isNewPR = exercisePR && current1RM > 0 && current1RM > exercisePR.max1RM;

  const currentPlateCalc = calculateBarbellPlates(plateCalcWeight, barWeight);

  return (
    <div className="space-y-4 pb-20">
      {/* 頂部操作列：返回、標題、場地、Markdown匯出、編輯、刪除 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            className="p-2 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] rounded-xl text-gray-300 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-base font-black text-white">{session.display_title}</h1>
              <button
                onClick={() => setShowEditSessionModal(true)}
                className="text-gray-400 hover:text-emerald-400 p-1 transition-colors"
                title="編輯場次資訊"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
              <span>{session.date}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <MapPin className="w-3 h-3" />
                {session.location || "交大健身房"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* 原生分享按鈕 */}
          <button
            onClick={handleShareSession}
            className="p-2 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] text-blue-400 hover:text-blue-300 rounded-xl active:scale-95 transition-all"
            title="分享訓練紀錄"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* 一鍵複製 Markdown 按鈕 */}
          <button
            onClick={handleCopyMarkdown}
            className="p-2 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] text-emerald-400 hover:text-emerald-300 rounded-xl active:scale-95 transition-all flex items-center gap-1 text-xs font-bold"
            title="一鍵複製 Markdown 格式"
          >
            <Copy className="w-4 h-4" />
            <span className="hidden sm:inline">複製 Markdown</span>
          </button>

          {/* 檢視 Markdown 原始碼 */}
          <button
            onClick={() => setShowMarkdownModal(true)}
            className="p-2 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] text-gray-300 hover:text-white rounded-xl active:scale-95 transition-all"
            title="檢視 Markdown 語法"
          >
            <FileText className="w-4 h-4" />
          </button>

          {/* 刪除整場訓練 */}
          <button
            onClick={handleDeleteEntireSession}
            className="p-2 bg-[#12141c] hover:bg-red-950/40 border border-[#262b3d] hover:border-red-500/40 text-gray-400 hover:text-red-400 rounded-xl active:scale-95 transition-all"
            title="刪除整場訓練紀錄"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 訓練總容量與數據看板 */}
      <div className="grid grid-cols-3 gap-2 bg-[#12141c] border border-[#262b3d] rounded-2xl p-2.5 text-center shadow-md">
        <div className="bg-[#181b26] p-2 rounded-xl border border-[#262b3d]/60">
          <span className="text-[10px] text-gray-400 block mb-0.5">本場總容量</span>
          <span className="text-xs sm:text-sm font-black text-white">
            {sets.reduce((sum, s) => sum + s.weight_kg * s.reps, 0) >= 1000
              ? `${Math.round((sets.reduce((sum, s) => sum + s.weight_kg * s.reps, 0) / 1000) * 10) / 10} 噸`
              : `${sets.reduce((sum, s) => sum + s.weight_kg * s.reps, 0)} Kg`}
          </span>
        </div>
        <div className="bg-[#181b26] p-2 rounded-xl border border-[#262b3d]/60">
          <span className="text-[10px] text-gray-400 block mb-0.5">已記錄組數</span>
          <span className="text-xs sm:text-sm font-black text-emerald-400">
            {sets.length} 組
          </span>
        </div>
        <div className="bg-[#181b26] p-2 rounded-xl border border-[#262b3d]/60">
          <span className="text-[10px] text-gray-400 block mb-0.5">執行動作數</span>
          <span className="text-xs sm:text-sm font-black text-amber-300">
            {setsByExercise.length} 個動作
          </span>
        </div>
      </div>

      {/* 複製成功提示 Toast */}
      {copyToast && (
        <div className="bg-emerald-500 text-black px-4 py-2 rounded-xl text-xs font-black shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>已成功複製 Markdown 格式到剪貼簿！可直接貼進筆記中。</span>
        </div>
      )}

      {/* 複製上一次菜單快捷橫幅 (若當前未有組數或使用者想要沿用) */}
      {prevTemplateInfo && sets.length === 0 && (
        <div className="bg-gradient-to-r from-[#181b26] to-[#12141c] border border-emerald-500/40 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <Copy className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-gray-100">
                發現上回【{session.target_muscle}】訓練菜單
              </h4>
              <p className="text-[11px] text-gray-400">
                {prevTemplateInfo.date}（{prevTemplateInfo.setCount} 組 / {prevTemplateInfo.exCount} 動作）
              </p>
            </div>
          </div>
          <button
            onClick={handleApplyPrevMenu}
            className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black px-3 py-1.5 rounded-xl shadow transition-all active:scale-95 flex-shrink-0"
          >
            沿用菜單
          </button>
        </div>
      )}

      {/* 整場訓練編輯 Modal */}
      {showEditSessionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12141c] border border-[#262b3d] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#262b3d] pb-2.5">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Pencil className="w-4 h-4 text-emerald-400" />
                <span>編輯訓練場次資訊</span>
              </h3>
              <button
                onClick={() => setShowEditSessionModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">訓練標題</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs font-bold rounded-xl p-2.5 focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">訓練日期</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-2.5 focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">訓練場地</label>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {LOCATION_PRESETS.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setEditLocation(loc)}
                      className={`text-[10px] px-2 py-1 rounded-lg border font-medium ${
                        editLocation === loc
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                          : "bg-[#181b26] border-[#262b3d] text-gray-400"
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="自訂場地..."
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-2 focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">主攻部位</label>
                <select
                  value={editTargetMuscle}
                  onChange={(e) => setEditTargetMuscle(e.target.value)}
                  className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-2.5 focus:border-emerald-500 outline-none"
                >
                  <option value="胸部">胸部</option>
                  <option value="背部">背部</option>
                  <option value="腿部">腿部</option>
                  <option value="肩部">肩部</option>
                  <option value="手臂">手臂</option>
                  <option value="胸部 + 三頭">胸部 + 三頭</option>
                  <option value="背部 + 二頭">背部 + 二頭</option>
                  <option value="游泳">游泳</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowEditSessionModal(false)}
                className="flex-1 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-300 py-2.5 rounded-xl text-xs font-bold transition-all"
              >
                取消
              </button>
              <button
                onClick={handleSaveEditSession}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black py-2.5 rounded-xl text-xs font-black shadow transition-all"
              >
                儲存更新
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 修改單組組數 Modal */}
      {editingSet && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12141c] border border-amber-500/40 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#262b3d] pb-2.5">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>修改第 #{editingSet.set_order} 組紀錄</span>
              </h3>
              <button
                onClick={() => setEditingSet(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">重量 (Kg)</label>
                <input
                  type="number"
                  step="0.5"
                  value={editSetWeight}
                  onChange={(e) => setEditSetWeight(e.target.value)}
                  className="w-full bg-[#181b26] border border-[#262b3d] text-white text-sm font-bold rounded-xl p-2.5 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">次數 (Reps)</label>
                <input
                  type="number"
                  value={editSetReps}
                  onChange={(e) => setEditSetReps(e.target.value)}
                  className="w-full bg-[#181b26] border border-[#262b3d] text-white text-sm font-bold rounded-xl p-2.5 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            {/* 組別型態 */}
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">組別類型</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: "normal", label: "正式組" },
                  { id: "warmup", label: "熱身組" },
                  { id: "primer", label: "激發組" },
                  { id: "rest_pause", label: "休補組" },
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setEditSetType(type.id as SetType)}
                    className={`text-xs py-1.5 rounded-lg border font-medium transition-all ${
                      editSetType === type.id
                        ? "bg-amber-500/20 border-amber-500 text-amber-300 font-bold"
                        : "bg-[#181b26] border-[#262b3d] text-gray-400"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 體感註記 */}
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">體感備註</label>
              <input
                type="text"
                placeholder="備註 (如: 感受度佳、補2、力竭)..."
                value={editSetNotes}
                onChange={(e) => setEditSetNotes(e.target.value)}
                className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-2.5 focus:border-emerald-500 outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditingSet(null)}
                className="flex-1 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-300 py-2.5 rounded-xl text-xs font-bold transition-all"
              >
                取消
              </button>
              <button
                onClick={handleSaveEditSet}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-black py-2.5 rounded-xl text-xs font-black shadow transition-all"
              >
                儲存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Markdown 原始碼檢視 Modal */}
      {showMarkdownModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12141c] border border-[#262b3d] rounded-2xl max-w-lg w-full p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#262b3d] pb-2.5">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Markdown 格式日誌 (與原筆記 100% 格式相符)</span>
              </h3>
              <button
                onClick={() => setShowMarkdownModal(false)}
                className="text-gray-400 hover:text-white"
              >
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
                <span>一鍵複製全文</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 槓鈴片換算器 Modal (Plate Calculator) */}
      {showPlateCalcModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12141c] border border-blue-500/40 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#262b3d] pb-2.5">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Calculator className="w-4 h-4 text-blue-400" />
                <span>奧林匹克槓鈴片配置換算</span>
              </h3>
              <button
                onClick={() => setShowPlateCalcModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 重量設定 */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">目標總重量 (Kg)</label>
                <input
                  type="number"
                  step="2.5"
                  value={plateCalcWeight}
                  onChange={(e) => setPlateCalcWeight(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#181b26] border border-[#262b3d] text-white text-base font-black rounded-xl p-2.5 focus:border-blue-500 outline-none text-center"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">空槓重量 (Kg)</label>
                <select
                  value={barWeight}
                  onChange={(e) => setBarWeight(parseFloat(e.target.value))}
                  className="w-full bg-[#181b26] border border-[#262b3d] text-white text-sm font-bold rounded-xl p-2.5 outline-none"
                >
                  <option value={20}>標準奧槓 (20 Kg)</option>
                  <option value={15}>女子槓 / 短槓 (15 Kg)</option>
                  <option value={10}>輕槓 (10 Kg)</option>
                </select>
              </div>
            </div>

            {/* 快速重量按鈕 */}
            <div className="flex flex-wrap gap-1.5 justify-center">
              {[40, 50, 60, 70, 80, 85, 90, 100, 110, 120].map((w) => (
                <button
                  key={w}
                  onClick={() => setPlateCalcWeight(w)}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-bold ${
                    plateCalcWeight === w
                      ? "bg-blue-600 text-white border-blue-400"
                      : "bg-[#181b26] border-[#262b3d] text-gray-300"
                  }`}
                >
                  {w}k
                </button>
              ))}
            </div>

            {/* 單邊槓片配置結果視覺化 */}
            <div className="bg-[#090a0f] border border-[#262b3d] rounded-xl p-4 text-center space-y-2">
              <span className="text-[11px] text-gray-400 block">
                單邊需掛片重量：
                <span className="text-white font-black text-sm ml-1">
                  {currentPlateCalc.sideWeight} Kg
                </span>
              </span>

              {currentPlateCalc.plates.length === 0 ? (
                <div className="text-xs text-gray-500 py-2">僅需空槓，無需掛片</div>
              ) : (
                <div className="flex items-center justify-center gap-1.5 flex-wrap pt-2">
                  {currentPlateCalc.plates.map((p, idx) => (
                    <div
                      key={idx}
                      className={`${p.color} ${p.textColor} px-2.5 py-1.5 rounded-lg text-xs font-black shadow flex items-center gap-1`}
                    >
                      <span>{p.weight}Kg</span>
                      <span className="text-[10px] opacity-80">×{p.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setInputWeight(plateCalcWeight.toString());
                  setShowPlateCalcModal(false);
                }}
                className="flex-1 bg-blue-500 hover:bg-blue-400 text-black py-2.5 rounded-xl text-xs font-black shadow transition-all"
              >
                填入記組重量 ({plateCalcWeight} Kg)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 熱身組階梯規劃 Modal */}
      {showWarmupModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12141c] border border-amber-500/40 rounded-2xl max-w-sm w-full p-5 space-y-3.5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#262b3d] pb-2.5">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>科學化熱身組階梯規劃</span>
              </h3>
              <button
                onClick={() => setShowWarmupModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-[11px] text-gray-400">
              目標正式重量：
              <span className="text-white font-black text-xs ml-1">
                {parseFloat(inputWeight) || 60} Kg
              </span>
              <p className="text-[10px] text-gray-500 mt-0.5">
                從空槓 20Kg 循序漸進激活神經系統，且不累積肌肉乳酸疲勞。
              </p>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {generateWarmupPlan(parseFloat(inputWeight) || 60, barWeight).map((plan, i) => (
                <div
                  key={i}
                  className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-[#090a0f] text-amber-300 font-bold px-2 py-0.5 rounded border border-[#262b3d]">
                      {plan.percentage}%
                    </span>
                    <span className="font-bold text-gray-100">
                      {plan.weightKg}Kg × {plan.reps}下
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400">{plan.label}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowWarmupModal(false)}
                className="flex-1 bg-[#181b26] text-gray-300 py-2.5 rounded-xl text-xs font-bold"
              >
                取消
              </button>
              <button
                onClick={() =>
                  handleAddWarmupSets(
                    generateWarmupPlan(parseFloat(inputWeight) || 60, barWeight)
                  )
                }
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-black py-2.5 rounded-xl text-xs font-black shadow transition-all flex items-center justify-center gap-1"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>一鍵帶入熱身組</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 動作過往歷史對照 Drawer / Modal */}
      {viewHistoryEx && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12141c] border border-emerald-500/40 rounded-2xl max-w-md w-full p-5 space-y-3.5 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#262b3d] pb-2.5 flex-shrink-0">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-400" />
                  <span>【{viewHistoryEx.exercise.name}】歷史做組紀錄</span>
                </h3>
                <span className="text-[10px] text-gray-400">
                  {viewHistoryEx.exercise.muscle_group} • 點擊任意組數可直接帶入當前輸入框
                </span>
              </div>
              <button
                onClick={() => setViewHistoryEx(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
              {viewHistoryEx.history.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs">尚無過往做組紀錄</div>
              ) : (
                viewHistoryEx.history.map(({ session: pastSess, sets: pastSets }, i) => (
                  <div
                    key={pastSess.id || i}
                    className="bg-[#181b26] p-3 rounded-xl border border-[#262b3d] space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px] text-gray-400 border-b border-[#262b3d]/60 pb-1">
                      <span className="font-bold text-gray-200">{pastSess.date}</span>
                      {pastSess.location && (
                        <span className="text-blue-400 flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          {pastSess.location}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {pastSets.map((ps, psIdx) => (
                        <button
                          key={ps.id || psIdx}
                          type="button"
                          onClick={() => {
                            setInputWeight(ps.weight_kg.toString());
                            setInputReps(ps.reps.toString());
                            setViewHistoryEx(null);
                          }}
                          className="bg-[#090a0f] hover:bg-emerald-950/60 border border-[#262b3d] hover:border-emerald-500 text-gray-200 hover:text-emerald-300 px-2.5 py-1 rounded-lg text-xs font-medium transition-all text-left flex items-center gap-1 active:scale-95"
                          title="點擊帶入此組數據"
                        >
                          <span>{ps.raw_text || `${ps.weight_kg}Kg x${ps.reps}`}</span>
                          {ps.is_failure && (
                            <span className="text-[9px] text-red-400">力竭</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setViewHistoryEx(null)}
              className="w-full bg-[#181b26] text-gray-300 py-2.5 rounded-xl text-xs font-bold flex-shrink-0"
            >
              關閉
            </button>
          </div>
        </div>
      )}

      {/* 替換動作 Modal (機台佔用時快速切換動作) */}
      {showSwapModal && swapSourceExercise && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12141c] border border-cyan-500/40 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#262b3d] pb-2.5 flex-shrink-0">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-cyan-400" />
                  <span>替換動作</span>
                </h3>
                <span className="text-[11px] text-gray-400">
                  將【<strong className="text-emerald-400">{swapSourceExercise.name}</strong>】的組數替換為其他動作
                </span>
              </div>
              <button
                onClick={() => {
                  setShowSwapModal(false);
                  setSwapSourceExercise(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 搜尋動作 */}
            <div className="flex-shrink-0">
              <input
                type="text"
                placeholder="搜尋替代動作名稱..."
                value={swapSearchQuery}
                onChange={(e) => setSwapSearchQuery(e.target.value)}
                className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-cyan-500"
              />
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {/* 同部位推薦動作 */}
              <div>
                <span className="text-[10px] text-gray-400 font-bold block mb-1.5">
                  推薦同部位【{swapSourceExercise.muscle_group}】候選動作：
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {exercises
                    .filter(
                      (e) =>
                        e.id !== swapSourceExercise.id &&
                        e.muscle_group === swapSourceExercise.muscle_group &&
                        (!swapSearchQuery || e.name.toLowerCase().includes(swapSearchQuery.toLowerCase()))
                    )
                    .map((ex) => (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => handleConfirmSwapExercise(ex.id)}
                        className="p-2.5 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] hover:border-cyan-500 rounded-xl text-left text-xs font-bold text-gray-200 transition-all active:scale-95 flex flex-col justify-between gap-1"
                      >
                        <span className="text-white truncate">{ex.name}</span>
                        <span className="text-[10px] text-gray-500">點擊立即替換</span>
                      </button>
                    ))}
                </div>
              </div>

              {/* 其他所有動作 */}
              {swapSearchQuery && (
                <div>
                  <span className="text-[10px] text-gray-400 font-bold block mb-1.5">
                    其他匹配動作：
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {exercises
                      .filter(
                        (e) =>
                          e.id !== swapSourceExercise.id &&
                          e.muscle_group !== swapSourceExercise.muscle_group &&
                          e.name.toLowerCase().includes(swapSearchQuery.toLowerCase())
                      )
                      .map((ex) => (
                        <button
                          key={ex.id}
                          type="button"
                          onClick={() => handleConfirmSwapExercise(ex.id)}
                          className="p-2.5 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] hover:border-cyan-500 rounded-xl text-left text-xs font-bold text-gray-200 transition-all active:scale-95 flex flex-col justify-between gap-1"
                        >
                          <span className="text-white truncate">{ex.name}</span>
                          <span className="text-[10px] text-cyan-400">{ex.muscle_group}</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setShowSwapModal(false);
                setSwapSourceExercise(null);
              }}
              className="w-full bg-[#181b26] text-gray-400 hover:text-white py-2 rounded-xl text-xs font-bold flex-shrink-0"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 浮動組間休息倒數 Bar */}
      {timerSeconds !== null && (
        <div className="bg-gradient-to-r from-amber-950/80 via-[#181b26] to-[#12141c] border border-amber-500/40 rounded-2xl p-3 shadow-2xl flex items-center justify-between text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-amber-400 animate-pulse" />
            <div>
              <span className="text-gray-400 block text-[10px]">組間休息倒數</span>
              <span className="text-base font-black text-amber-300 font-mono">
                {Math.floor(timerSeconds / 60)}:
                {(timerSeconds % 60).toString().padStart(2, "0")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => adjustTimer(-15)}
              className="px-2 py-1 bg-[#12141c] text-gray-300 rounded-lg border border-[#262b3d] text-[11px]"
            >
              -15s
            </button>
            <button
              onClick={() => adjustTimer(15)}
              className="px-2 py-1 bg-[#12141c] text-gray-300 rounded-lg border border-[#262b3d] text-[11px]"
            >
              +15s
            </button>
            <button
              onClick={() => setTimerActive(!timerActive)}
              className="p-1.5 bg-amber-500/20 text-amber-300 rounded-lg border border-amber-500/40"
            >
              {timerActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-1.5 rounded-lg border transition-all ${
                isMuted
                  ? "bg-red-500/20 text-red-300 border-red-500/40"
                  : "bg-[#181b26] text-gray-400 hover:text-white border-[#262b3d]"
              }`}
              title={isMuted ? "已靜音" : "開啟倒數音效"}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={stopRestTimer}
              className="p-1.5 text-gray-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 動作與組數列表 */}
      <div className="space-y-4">
        {setsByExercise.map(({ exercise, sets: exSets }, idx) => {
          const exId = exercise?.id || "";
          const ghostSets = ghostMap[exId];
          const bestPr = maxPrMap[exId];

          return (
            <div
              key={exId || idx}
              className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-3"
            >
              {/* 動作標題與 PR 徽章 */}
              <div className="flex items-center justify-between border-b border-[#262b3d]/60 pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-emerald-400 text-sm">
                      {exercise?.name || "未命名動作"}
                    </h3>
                    {exercise && (
                      <button
                        type="button"
                        onClick={() => handleOpenExerciseHistory(exercise)}
                        className="text-[10px] bg-[#181b26] hover:bg-[#202533] text-gray-300 border border-[#262b3d] px-1.5 py-0.5 rounded-lg flex items-center gap-1 active:scale-95 transition-all"
                        title="查看過去 5 次該動作的做組紀錄"
                      >
                        <History className="w-2.5 h-2.5 text-amber-400" />
                        <span>查歷史</span>
                      </button>
                    )}
                    {bestPr && bestPr.max1RM > 0 && (
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Trophy className="w-2.5 h-2.5" />
                        PR: {bestPr.maxWeight}Kg (1RM ~{bestPr.max1RM}k)
                      </span>
                    )}
                  </div>
                  {exercise?.default_notes && (
                    <span className="text-[11px] text-gray-400 block">
                      {exercise.default_notes}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs bg-[#181b26] text-gray-300 px-2 py-0.5 rounded border border-[#262b3d]">
                    {exSets.length} 組
                  </span>
                  {exercise && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSwapSourceExercise(exercise);
                          setShowSwapModal(true);
                        }}
                        className="text-[10px] bg-[#181b26] hover:bg-[#202533] text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded-lg flex items-center gap-1 active:scale-95 transition-all"
                        title="機台有人用？換同部位動作"
                      >
                        <RefreshCw className="w-2.5 h-2.5 text-cyan-400" />
                        <span>換動作</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAllSetsOfExercise(exercise)}
                        className="text-[10px] bg-[#181b26] hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-[#262b3d] px-1.5 py-0.5 rounded-lg flex items-center gap-1 active:scale-95 transition-all"
                        title="清空此動作在今日訓練的全部組數"
                      >
                        <Trash2 className="w-2.5 h-2.5 text-red-400" />
                        <span>清空</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 上次對照幽靈卡片 */}
              {ghostSets && ghostSets.length > 0 && (
                <div className="bg-[#181b26]/70 border border-amber-500/20 rounded-xl p-2.5 text-xs text-gray-300">
                  <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-bold mb-1">
                    <History className="w-3.5 h-3.5" />
                    <span>上次訓練對照基準：</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ghostSets.map((gs, i) => (
                      <span
                        key={gs.id || i}
                        className="bg-[#090a0f] text-gray-300 px-2 py-0.5 rounded text-[11px] border border-[#262b3d]"
                      >
                        {gs.raw_text || `${gs.weight_kg}Kg x${gs.reps}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 今日組數清單 (支援修改與刪除) */}
              <div className="space-y-1.5">
                {exSets.map((s, sIdx) => (
                  <div
                    key={s.id}
                    className="bg-[#181b26] px-3 py-2 rounded-xl border border-[#262b3d]/70 flex items-center justify-between text-xs group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-400 w-5">#{sIdx + 1}</span>
                      <span className="font-medium text-gray-100">
                        {s.raw_text || `${s.weight_kg}Kg x ${s.reps}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {s.set_type === "warmup" && (
                        <span className="bg-blue-500/20 text-blue-300 text-[10px] px-1.5 py-0.5 rounded">
                          熱身
                        </span>
                      )}
                      {s.set_type === "primer" && (
                        <span className="bg-purple-500/20 text-purple-300 text-[10px] px-1.5 py-0.5 rounded">
                          激發
                        </span>
                      )}
                      {s.set_type === "drop" && (
                        <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded">
                          遞減
                        </span>
                      )}
                      {s.is_failure && (
                        <span className="bg-red-500/20 text-red-300 text-[10px] px-1.5 py-0.5 rounded">
                          力竭
                        </span>
                      )}

                      {/* ⇅ 調整組數順序 */}
                      <div className="flex items-center text-gray-500 opacity-60 group-hover:opacity-100 transition-opacity">
                        {sIdx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleMoveSet(s.id, "up")}
                            className="p-1 hover:text-white transition-colors"
                            title="往前移動一組"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {sIdx < exSets.length - 1 && (
                          <button
                            type="button"
                            onClick={() => handleMoveSet(s.id, "down")}
                            className="p-1 hover:text-white transition-colors"
                            title="往後移動一組"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* ✏️ 修改此組按鈕 */}
                      <button
                        onClick={() => handleStartEditSet(s)}
                        className="text-gray-400 hover:text-amber-400 p-1 transition-colors"
                        title="修改此組數據"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      {/* 🗑️ 刪除此組按鈕 */}
                      <button
                        onClick={() => handleDeleteSet(s.id)}
                        className="text-gray-400 hover:text-red-400 p-1 transition-colors"
                        title="刪除此組"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 快速加組面板 (Sticky Bottom Panel) */}
      <div className="bg-[#12141c] border border-emerald-500/30 rounded-2xl p-4 space-y-3 shadow-2xl">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            <span>快速記錄下一組</span>
          </h4>

          <div className="flex items-center gap-2">
            {/* 重複上一組按鈕 */}
            <button
              type="button"
              onClick={handleRepeatLastSet}
              className="text-xs bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-emerald-400 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 active:scale-95 transition-all"
              title="一鍵重複上一組重量次數"
            >
              <Repeat className="w-3 h-3" />
              <span>重複上一組</span>
            </button>

            {/* 自訂新動作開關 */}
            <button
              type="button"
              onClick={() => setShowAddCustom(!showAddCustom)}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
            >
              <span>＋ 自訂新動作</span>
            </button>
          </div>
        </div>

        {/* 動作選擇 */}
        <div className="space-y-2">
          {showAddCustom && (
            <div className="bg-[#090a0f] border border-emerald-500/40 rounded-xl p-3 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>新增客製動作 (自動歸入常用選單)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddCustom(false)}
                  className="text-gray-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="動作名稱 (如: 雙槓臂屈伸)..."
                  value={newExName}
                  onChange={(e) => setNewExName(e.target.value)}
                  className="col-span-2 bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-emerald-500"
                />
                <select
                  value={newExWeightType}
                  onChange={(e) => setNewExWeightType(e.target.value as WeightType)}
                  className="bg-[#181b26] border border-[#262b3d] text-gray-200 text-xs rounded-xl px-2 py-2 outline-none"
                >
                  <option value="barbell_total">槓鈴 (總重)</option>
                  <option value="dumbbell_single">啞鈴 (單邊)</option>
                  <option value="machine_stack">訓練機 (插銷/滑輪)</option>
                  <option value="bodyweight">自重動作</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleCreateCustomExercise}
                disabled={!newExName.trim()}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black py-2 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>儲存並立刻選用</span>
              </button>
            </div>
          )}

          {/* 固定動作快速膠囊列 (Quick Buttons)：單擊直接切換 */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {displayExercises.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => handleSelectExercise(ex.id)}
                className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                  selectedExId === ex.id
                    ? "bg-emerald-500 text-black border-emerald-400 font-black shadow-md scale-[1.02]"
                    : "bg-[#181b26] border-[#262b3d] text-gray-300 hover:border-gray-500 font-medium"
                }`}
              >
                {ex.name}
              </button>
            ))}
          </div>
        </div>

        {/* 重量與次數輸入 (附微調按鈕與槓片換算器) */}
        <div className="space-y-1.5 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-gray-400">重量 (Kg)</label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowWarmupModal(true)}
                    className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5"
                    title="科學化熱身組規劃"
                  >
                    <Flame className="w-2.5 h-2.5" />
                    <span>熱身規劃</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPlateCalcWeight(parseFloat(inputWeight) || 60);
                      setShowPlateCalcModal(true);
                    }}
                    className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                    title="槓片換算器"
                  >
                    <Calculator className="w-2.5 h-2.5" />
                    <span>槓片換算</span>
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => adjustWeight(-2.5)}
                  className="px-2 py-2.5 bg-[#181b26] text-gray-300 rounded-xl border border-[#262b3d] text-xs font-bold active:scale-95"
                >
                  -2.5
                </button>
                <input
                  type="number"
                  step="0.5"
                  placeholder="50"
                  value={inputWeight}
                  onChange={(e) => setInputWeight(e.target.value)}
                  className="w-full bg-[#181b26] border border-[#262b3d] text-white text-base font-black rounded-xl p-2.5 text-center focus:border-emerald-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => adjustWeight(2.5)}
                  className="px-2 py-2.5 bg-[#181b26] text-gray-300 rounded-xl border border-[#262b3d] text-xs font-bold active:scale-95"
                >
                  +2.5
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-gray-400">次數 (Reps)</label>
                {current1RM > 0 && (
                  <span className="text-[10px] text-emerald-400 font-bold">
                    1RM ~{current1RM}k
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => adjustReps(-1)}
                  className="px-2 py-2.5 bg-[#181b26] text-gray-300 rounded-xl border border-[#262b3d] text-xs font-bold active:scale-95"
                >
                  -1
                </button>
                <input
                  type="number"
                  placeholder="8"
                  value={inputReps}
                  onChange={(e) => setInputReps(e.target.value)}
                  className="w-full bg-[#181b26] border border-[#262b3d] text-white text-base font-black rounded-xl p-2.5 text-center focus:border-emerald-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => adjustReps(1)}
                  className="px-2 py-2.5 bg-[#181b26] text-gray-300 rounded-xl border border-[#262b3d] text-xs font-bold active:scale-95"
                >
                  +1
                </button>
              </div>
            </div>
          </div>

          {/* 常用次數快速點選 */}
          <div className="flex items-center justify-between gap-1 pt-0.5">
            <span className="text-[10px] text-gray-500">快選次數：</span>
            <div className="flex gap-1">
              {[6, 8, 10, 12, 15].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setInputReps(r.toString())}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-all ${
                    inputReps === r.toString()
                      ? "bg-emerald-500 text-black border-emerald-400"
                      : "bg-[#181b26] text-gray-400 border-[#262b3d] hover:text-white"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* 新 PR 提醒提示 */}
          {isNewPR && (
            <div className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1.5 animate-bounce">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>突破歷史紀錄！這組將創下此動作全新 PR！</span>
            </div>
          )}
        </div>

        {/* 體感標籤快速點選 (快速追加備註) */}
        <div className="space-y-1">
          <label className="text-[10px] text-gray-400 block">快捷體感標記 (點擊自動套入)：</label>
          <div className="flex flex-wrap gap-1">
            {FEELING_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleToggleFeelingTag(tag)}
                className={`text-[11px] px-2 py-0.5 rounded-lg border transition-all ${
                  inputNotes.includes(tag) || (tag === "熱身" && inputType === "warmup")
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold"
                    : "bg-[#181b26] border-[#262b3d] text-gray-400 hover:text-gray-200"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* 備註自由輸入 */}
        <input
          type="text"
          placeholder="自訂體感備註 (例如: 補2下、力竭、感受度佳)..."
          value={inputNotes}
          onChange={(e) => setInputNotes(e.target.value)}
          className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-emerald-500"
        />

        {/* 記錄組數按鈕 */}
        <button
          type="button"
          onClick={handleAddSet}
          disabled={!inputReps}
          className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black py-3 rounded-xl shadow-lg transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>記錄此組完成</span>
        </button>
      </div>
    </div>
  );
}

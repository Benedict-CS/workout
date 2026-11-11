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
import { runFullSync } from "@/lib/db/sync";
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

  // 計時器倒數邏輯 (安靜倒數，不發聲音)
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
      mainPart = `${weight}Kg x${reps} 熱身`;
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

    const newOrder = sets.length + 1;
    const weightNum = parseFloat(inputWeight) || 0;
    const repsNum = parseInt(inputReps, 10) || 0;

    const exSets = sets.filter((s) => s.exercise_id === selectedExId);
    const formalIndex = exSets.filter((s) => s.set_type === "normal" || s.set_type === "drop").length + 1;

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

    // 自動啟動休息計時器 (靜音)
    startRestTimer(defaultRestDuration);
  }

  // 重複上一組
  async function handleRepeatLastSet() {
    if (!selectedExId) return;
    const exSets = sets.filter((s) => s.exercise_id === selectedExId);
    if (exSets.length === 0) return;
    const last = exSets[exSets.length - 1];

    const newOrder = sets.length + 1;
    const formalIndex = exSets.filter((s) => s.set_type === "normal" || s.set_type === "drop").length + 1;
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.sets.add(newSet);
    setSets((prev) => [...prev, newSet]);
    startRestTimer(defaultRestDuration);
    runFullSync().catch(() => {});
  }

  // 記錄游泳 (3 個快選：早上游、下午游、晚上游)
  async function handleLogSwim(swimTimeLabel: string) {
    let swimEx = exercises.find((e) => e.id === "ex-swim" || e.name === "游泳");
    if (!swimEx) {
      swimEx = exercises[0];
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

    const raw = formatSetRawText(
      editingSet.set_order,
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

  // 動作過濾（排除繩索夾胸，只顯示對應部位或搜尋）
  const displayExercises = exercises.filter((e) => {
    if (e.name.includes("繩索夾胸")) return false;
    if (dockExerciseSearch.trim()) {
      return e.name.toLowerCase().includes(dockExerciseSearch.trim().toLowerCase());
    }
    return e.muscle_group === session.target_muscle;
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

      {/* 靜音休息計時器控制列 */}
      <div className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-gray-200">休息計時：</span>
          {timerSeconds !== null && timerSeconds > 0 ? (
            <span className="text-amber-400 font-mono font-black text-sm">
              {Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, "0")}
            </span>
          ) : (
            <span className="text-gray-500">已結束</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => startRestTimer(120)}
            className="px-2 py-1 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-300 hover:text-white rounded-lg text-[11px] font-bold"
          >
            2分
          </button>
          <button
            type="button"
            onClick={() => startRestTimer(150)}
            className="px-2 py-1 bg-[#181b26] hover:bg-[#202533] border border-amber-500/40 text-amber-300 rounded-lg text-[11px] font-black"
          >
            2分半
          </button>
          <button
            type="button"
            onClick={() => startRestTimer(180)}
            className="px-2 py-1 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-300 hover:text-white rounded-lg text-[11px] font-bold"
          >
            3分
          </button>
          {timerActive && (
            <button
              type="button"
              onClick={stopRestTimer}
              className="p-1 text-gray-500 hover:text-white ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 已記錄組數區塊 */}
      <div className="space-y-3">
        {setsByExercise.length === 0 ? (
          <div className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-6 text-center text-xs text-gray-500">
            尚未記錄任何組數，請在下方輸入重量次數並按「＋記錄完成」！
          </div>
        ) : (
          setsByExercise.map(({ exercise, sets: exSets }) => {
            const ghostSets = exercise ? ghostMap[exercise.id] : undefined;

            return (
              <div
                key={exercise?.id || "unknown"}
                className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-2.5 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-[#262b3d]/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Dumbbell className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-black text-gray-100 text-sm">{exercise?.name}</h3>
                  </div>
                  <span className="text-xs bg-[#181b26] text-gray-400 px-2 py-0.5 rounded border border-[#262b3d]">
                    {exSets.length} 組
                  </span>
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

                {/* 組數清單 */}
                <div className="space-y-1.5">
                  {exSets.map((s, sIdx) => (
                    <div
                      key={s.id}
                      className="bg-[#181b26] px-3 py-2 rounded-xl border border-[#262b3d]/70 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-500 w-5">#{sIdx + 1}</span>
                        <span className="font-bold text-gray-100">
                          {s.raw_text || `${s.weight_kg}Kg x ${s.reps}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {s.set_type === "warmup" && (
                          <span className="bg-blue-500/20 text-blue-300 text-[10px] px-1.5 py-0.5 rounded">
                            熱身
                          </span>
                        )}
                        {s.set_type === "drop" && (
                          <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded">
                            遞減
                          </span>
                        )}

                        <button
                          onClick={() => handleStartEditSet(s)}
                          className="text-gray-400 hover:text-amber-400 p-1"
                          title="修改此組"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteSet(s.id)}
                          className="text-gray-400 hover:text-red-400 p-1"
                          title="刪除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
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
        </div>
      ) : (
        /* 重訓記組面板 (支援一個 set 內新增多個欄位：休 / 補 / 遞減) */
        <div className="bg-[#12141c] border border-emerald-500/40 rounded-2xl p-4 space-y-3 shadow-2xl">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>記組</span>
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
            disabled={!inputReps}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black py-3.5 rounded-xl shadow-lg transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 mt-2"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>記錄此組完成</span>
          </button>
        </div>
      )}

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
    </div>
  );
}

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
} from "lucide-react";
import { db } from "@/lib/db/schema";
import { getLastExerciseSets } from "@/lib/db/crud";
import type { Exercise, SetItem, WorkoutSession } from "@/lib/types";

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

  // 快速加組表單狀態
  const [selectedExId, setSelectedExId] = useState<string>("");
  const [inputWeight, setInputWeight] = useState<string>("");
  const [inputReps, setInputReps] = useState<string>("");
  const [inputType, setInputType] = useState<string>("normal");
  const [inputNotes, setInputNotes] = useState<string>("");

  // 組間休息計時器狀態
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const [autoTimerEnabled, setAutoTimerEnabled] = useState<boolean>(true);
  const [defaultRestDuration, setDefaultRestDuration] = useState<number>(90);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 提示音效
  function playAlarm() {
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

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 400]);
    }
  }

  // 計時器倒數邏輯
  useEffect(() => {
    if (timerActive && timerSeconds !== null && timerSeconds > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timerIntervalRef.current!);
            setTimerActive(false);
            playAlarm();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [timerActive, timerSeconds]);

  function startRestTimer(seconds: number) {
    setTimerSeconds(seconds);
    setTimerActive(true);
  }

  function adjustTimer(delta: number) {
    setTimerSeconds((prev) => Math.max(0, (prev || 0) + delta));
  }

  // 切換動作時智慧預填上一組數據
  function handleSelectExercise(exId: string) {
    setSelectedExId(exId);
    // 找出今日已記錄的最後一組
    const existingSets = sets.filter((s) => s.exercise_id === exId);
    if (existingSets.length > 0) {
      const last = existingSets[existingSets.length - 1];
      setInputWeight(last.weight_kg.toString());
      setInputReps(last.reps.toString());
    } else if (ghostMap[exId] && ghostMap[exId].length > 0) {
      // 若今日尚未記錄，從歷史幽靈對照抓第一組做組參考
      const firstNormal = ghostMap[exId].find((s) => s.set_type === "normal") || ghostMap[exId][0];
      setInputWeight(firstNormal.weight_kg.toString());
      setInputReps(firstNormal.reps.toString());
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const sess = await db.sessions.get(id);
        if (!sess) {
          router.push("/");
          return;
        }
        setSession(sess);

        const allEx = await db.exercises.toArray();
        setExercises(allEx);

        const currentSets = await db.sets
          .where("session_id")
          .equals(id)
          .filter((s) => !s.deleted_at)
          .sortBy("set_order");
        setSets(currentSets);

        // 讀取該次訓練中有出現動作的「上次歷史記錄」
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
        } else if (allEx.length > 0) {
          setSelectedExId(allEx[0].id);
        }
      } catch (err) {
        console.error("Failed to load workout:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, router]);

  // 新增組數
  async function handleAddSet() {
    if (!selectedExId || !inputReps) return;

    const newOrder = sets.length + 1;
    const weightNum = parseFloat(inputWeight) || 0;
    const repsNum = parseInt(inputReps, 10) || 0;

    const newSet: SetItem = {
      id: `set-${id}-${Date.now()}`,
      session_id: id,
      exercise_id: selectedExId,
      set_order: newOrder,
      set_type: inputType as any,
      weight_kg: weightNum,
      reps: repsNum,
      raw_text: `${weightNum}Kg x${repsNum} ${inputNotes}`.trim(),
      feedback: inputNotes || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.sets.add(newSet);
    setSets((prev) => [...prev, newSet]);

    // 更新幽靈參照
    if (!ghostMap[selectedExId]) {
      const res = await getLastExerciseSets(selectedExId, id);
      if (res) {
        setGhostMap((prev) => ({ ...prev, [selectedExId]: res.sets }));
      }
    }

    // 自動啟動組間休息倒數計時器
    if (autoTimerEnabled) {
      startRestTimer(defaultRestDuration);
    }

    // 保留重量與次數預填下一組，清空備註
    setInputNotes("");
  }

  // 刪除組數
  async function handleDeleteSet(setId: string) {
    await db.sets.delete(setId);
    setSets((prev) => prev.filter((s) => s.id !== setId));
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

  return (
    <div className="space-y-5 pb-12">
      {/* 頂部標題 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] rounded-xl text-gray-300 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-black text-white">{session.display_title}</h1>
            <p className="text-xs text-gray-400">{session.date}</p>
          </div>
        </div>

        {/* 休息倒數手動快速開關 */}
        <button
          onClick={() => (timerSeconds === null ? startRestTimer(90) : setTimerSeconds(null))}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
            timerSeconds !== null
              ? "bg-amber-500/20 border-amber-500 text-amber-300"
              : "bg-[#181b26] border-[#262b3d] text-gray-400 hover:text-white"
          }`}
        >
          <Timer className="w-4 h-4" />
          <span>{timerSeconds !== null ? `${timerSeconds}s` : "休息計時"}</span>
        </button>
      </div>

      {/* 浮動組間休息倒數 Bar (Sticky Header) */}
      {timerSeconds !== null && (
        <div className="bg-gradient-to-r from-amber-950/80 via-[#181b26] to-[#12141c] border border-amber-500/40 rounded-2xl p-3 shadow-2xl flex items-center justify-between text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-black text-amber-400 text-sm">
              {timerSeconds}
            </div>
            <div>
              <span className="font-bold text-gray-200 block text-xs">
                {timerSeconds === 0 ? "🔔 休息結束！該上槓了" : "組間休息倒數中"}
              </span>
              <span className="text-[10px] text-gray-400">
                {timerActive ? "進行中" : "已暫停"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => adjustTimer(-15)}
              className="bg-[#090a0f] hover:bg-[#202533] text-gray-300 px-2 py-1 rounded-lg border border-[#262b3d] text-[11px]"
            >
              -15s
            </button>
            <button
              onClick={() => adjustTimer(+30)}
              className="bg-[#090a0f] hover:bg-[#202533] text-gray-300 px-2 py-1 rounded-lg border border-[#262b3d] text-[11px]"
            >
              +30s
            </button>
            <button
              onClick={() => setTimerActive(!timerActive)}
              className="p-1.5 bg-amber-500/20 text-amber-300 rounded-lg border border-amber-500/40"
            >
              {timerActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setTimerSeconds(null)}
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

          return (
            <div
              key={exId || idx}
              className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-3"
            >
              {/* 動作標題 */}
              <div className="flex items-center justify-between border-b border-[#262b3d]/60 pb-2">
                <div>
                  <h3 className="font-bold text-emerald-400 text-sm">
                    {exercise?.name || "未命名動作"}
                  </h3>
                  {exercise?.default_notes && (
                    <span className="text-[11px] text-gray-400 block">
                      {exercise.default_notes}
                    </span>
                  )}
                </div>
                <span className="text-xs bg-[#181b26] text-gray-300 px-2 py-0.5 rounded border border-[#262b3d]">
                  {exSets.length} 組
                </span>
              </div>

              {/* 上次對照幽靈卡片 (Ghost Reference) */}
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

              {/* 今日組數清單 */}
              <div className="space-y-1.5">
                {exSets.map((s, sIdx) => (
                  <div
                    key={s.id}
                    className="bg-[#181b26] px-3 py-2 rounded-xl border border-[#262b3d]/70 flex items-center justify-between text-xs"
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
                      {s.set_type === "rest_pause" && (
                        <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded">
                          休補
                        </span>
                      )}
                      {s.is_failure && (
                        <span className="bg-red-500/20 text-red-300 text-[10px] px-1.5 py-0.5 rounded">
                          力竭
                        </span>
                      )}
                      <button
                        onClick={() => handleDeleteSet(s.id)}
                        className="text-gray-500 hover:text-red-400 p-1"
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
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <input
              type="checkbox"
              id="autoTimer"
              checked={autoTimerEnabled}
              onChange={(e) => setAutoTimerEnabled(e.target.checked)}
              className="accent-emerald-500 rounded"
            />
            <label htmlFor="autoTimer" className="cursor-pointer">儲存自動啟動計時</label>
          </div>
        </div>

        {/* 選擇動作 */}
        <select
          value={selectedExId}
          onChange={(e) => handleSelectExercise(e.target.value)}
          className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-2.5 focus:border-emerald-500 outline-none"
        >
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name} ({ex.muscle_group})
            </option>
          ))}
        </select>

        {/* 重量與次數輸入 (智慧預填) */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">重量 (Kg)</label>
            <input
              type="number"
              step="0.5"
              placeholder="e.g. 50"
              value={inputWeight}
              onChange={(e) => setInputWeight(e.target.value)}
              className="w-full bg-[#181b26] border border-[#262b3d] text-white text-sm font-bold rounded-xl p-2.5 focus:border-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">次數 (Reps)</label>
            <input
              type="number"
              placeholder="e.g. 8"
              value={inputReps}
              onChange={(e) => setInputReps(e.target.value)}
              className="w-full bg-[#181b26] border border-[#262b3d] text-white text-sm font-bold rounded-xl p-2.5 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>

        {/* 組別類型 */}
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
              onClick={() => setInputType(type.id)}
              className={`text-xs py-1.5 rounded-lg border font-medium transition-all ${
                inputType === type.id
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                  : "bg-[#181b26] border-[#262b3d] text-gray-400"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* 體感註記 */}
        <input
          type="text"
          placeholder="體感備註 (如: 感受度佳、推進 1 下、補2)..."
          value={inputNotes}
          onChange={(e) => setInputNotes(e.target.value)}
          className="w-full bg-[#181b26] border border-[#262b3d] text-gray-200 text-xs rounded-xl p-2.5 focus:border-emerald-500 outline-none"
        />

        {/* 提交按鈕 */}
        <button
          onClick={handleAddSet}
          disabled={!inputReps}
          className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black py-2.5 rounded-xl transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-1.5"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>儲存此組</span>
        </button>
      </div>
    </div>
  );
}

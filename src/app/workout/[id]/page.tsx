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
} from "lucide-react";
import { db } from "@/lib/db/schema";
import { getLastExerciseSets } from "@/lib/db/crud";
import type { Exercise, SetItem, WorkoutSession, WeightType, MuscleGroup } from "@/lib/types";

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

  // 自訂新動作模式
  const [showAddCustom, setShowAddCustom] = useState<boolean>(false);
  const [newExName, setNewExName] = useState<string>("");
  const [newExWeightType, setNewExWeightType] = useState<WeightType>("barbell_total");

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
      // 若今日尚未記錄，從歷史幽靈對照抓做組參考
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

        // 智慧決定初始選定動作：若已有記錄則選今日第 1 動，若無則預設選今日部位第 1 個常用動作
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
          // 今日部位對應動作
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

  // 嚴格只過濾今日部位的動作（固定常用動作 + 使用者自訂的新動作）
  const displayExercises = exercises.filter((e) =>
    matchesTargetMuscle(e, session.target_muscle)
  );

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

        {/* 動作選擇器：只顯示今日核心固定動作，並支援即時新增自訂動作 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
              <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />
              <span>今日部位動作 ({session.target_muscle})</span>
            </span>

            {/* ＋ 自訂動作開關 */}
            <button
              type="button"
              onClick={() => setShowAddCustom(!showAddCustom)}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>自訂新動作</span>
            </button>
          </div>

          {/* 展開新增自訂動作欄位 */}
          {showAddCustom && (
            <div className="bg-[#090a0f] p-3 rounded-xl border border-emerald-500/40 space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                <span>新增自訂動作至【{session.target_muscle}】</span>
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
                  placeholder="輸入動作名稱 (如: 雙槓臂屈伸)..."
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

        {/* 重量與次數輸入 (智慧預填) */}
        <div className="grid grid-cols-2 gap-2 pt-1">
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

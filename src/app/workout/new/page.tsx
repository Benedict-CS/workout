"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Calendar,
  Dumbbell,
  MapPin,
  Copy,
  Sparkles,
  Layers,
  AlertTriangle,
} from "lucide-react";
import { db } from "@/lib/db/schema";
import { getPreviousSessionTemplate } from "@/lib/db/crud";
import { runFullSync } from "@/lib/db/sync";
import { cleanSessionTitle, getLocalDateString } from "@/lib/workout-utils";
import type { WorkoutSession, SetItem, Exercise } from "@/lib/types";

// 地點膠囊預設
const LOCATION_PRESETS = [
  { id: "三健客", label: "三健客", icon: "📍" },
  { id: "交大健身房", label: "交大健身房", icon: "🏫" },
  { id: "交大游泳池", label: "交大游泳池", icon: "🏊" },
] as const;

// 部位膠囊預設及專屬主題發光色 (胸藍、背綠、腿紫、肩橘、泳青)
const MUSCLE_PRESETS = [
  {
    id: "胸",
    label: "胸",
    icon: "🔥",
    activeClass:
      "bg-blue-500/15 border-blue-500/80 text-blue-300 shadow-[0_0_16px_rgba(59,130,246,0.4)] ring-1 ring-blue-500/50",
  },
  {
    id: "背",
    label: "背",
    icon: "⚡",
    activeClass:
      "bg-emerald-500/15 border-emerald-500/80 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.4)] ring-1 ring-emerald-500/50",
  },
  {
    id: "腿",
    label: "腿",
    icon: "🦵",
    activeClass:
      "bg-purple-500/15 border-purple-500/80 text-purple-300 shadow-[0_0_16px_rgba(168,85,247,0.4)] ring-1 ring-purple-500/50",
  },
  {
    id: "肩",
    label: "肩",
    icon: "🎯",
    activeClass:
      "bg-orange-500/15 border-orange-500/80 text-orange-300 shadow-[0_0_16px_rgba(249,115,22,0.4)] ring-1 ring-orange-500/50",
  },
  {
    id: "游泳",
    label: "游泳",
    icon: "🏊",
    activeClass:
      "bg-cyan-500/15 border-cyan-400/80 text-cyan-300 shadow-[0_0_16px_rgba(6,182,212,0.4)] ring-1 ring-cyan-400/50",
  },
] as const;

function NewWorkoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const todayStr = getLocalDateString();

  const [date, setDate] = useState(todayStr);
  const [targetMuscle, setTargetMuscle] = useState<string>("胸");
  const [location, setLocation] = useState<string>("三健客");

  // 游泳專用時段與備註
  const [swimTimeSlot, setSwimTimeSlot] = useState<"早上" | "下午" | "晚上" | "全天">("下午");
  const [swimNotes, setSwimNotes] = useState("");

  // 上次菜單複製功能
  const [prevTemplate, setPrevTemplate] = useState<{
    session: WorkoutSession;
    exerciseIds: string[];
    sets: SetItem[];
  } | null>(null);
  const [clonePrevMenu, setClonePrevMenu] = useState(false);
  const [exercisesMap, setExercisesMap] = useState<Record<string, Exercise>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingActiveSession, setExistingActiveSession] = useState<WorkoutSession | null>(null);

  // 檢查是否有正在進行中的未完成訓練
  useEffect(() => {
    db.sessions
      .filter((s) => !s.deleted_at && s.status === "in_progress")
      .toArray()
      .then((list) => {
        if (list.length > 0) {
          setExistingActiveSession(list[list.length - 1]);
        } else {
          setExistingActiveSession(null);
        }
      })
      .catch(() => {});
  }, []);

  // 讀取 URL 參數
  useEffect(() => {
    const urlDate = searchParams.get("date");
    if (urlDate) {
      setDate(urlDate);
    }
    const urlMuscle = searchParams.get("muscle");
    if (urlMuscle) {
      if (urlMuscle.includes("胸")) setTargetMuscle("胸");
      else if (urlMuscle.includes("背")) setTargetMuscle("背");
      else if (urlMuscle.includes("腿")) setTargetMuscle("腿");
      else if (urlMuscle.includes("肩")) setTargetMuscle("肩");
      else if (urlMuscle.includes("泳")) {
        setTargetMuscle("游泳");
        setLocation("交大游泳池");
      }
    }
  }, [searchParams]);

  // 載入所有動作名稱快照
  useEffect(() => {
    db.exercises.toArray().then((list) => {
      const map: Record<string, Exercise> = {};
      for (const ex of list) map[ex.id] = ex;
      setExercisesMap(map);
    });
  }, []);

  // 當部位或地點切換時，自動尋找該健身房上次同部位菜單 (如交大健身房 vs 三健客)
  useEffect(() => {
    async function checkPrev() {
      if (targetMuscle === "游泳") {
        setPrevTemplate(null);
        setClonePrevMenu(false);
        return;
      }
      const match = await getPreviousSessionTemplate(targetMuscle, location);
      setPrevTemplate(match);
      if (match && match.sets.length > 0) {
        setClonePrevMenu(true);
      } else {
        setClonePrevMenu(false);
      }
    }
    checkPrev();
  }, [targetMuscle, location]);

  // 地點膠囊點擊切換邏輯
  function handleLocationSelect(locId: string) {
    setLocation(locId);
    if (locId === "交大游泳池" && targetMuscle !== "游泳") {
      setTargetMuscle("游泳");
    } else if (locId !== "交大游泳池" && targetMuscle === "游泳") {
      setTargetMuscle("胸");
    }
  }

  // 部位膠囊點擊切換邏輯
  function handleMuscleSelect(muscleId: string) {
    setTargetMuscle(muscleId);
    if (muscleId === "游泳" && location !== "交大游泳池") {
      setLocation("交大游泳池");
    } else if (muscleId !== "游泳" && location === "交大游泳池") {
      setLocation("三健客");
    }
  }

  // 結束舊場次並開新訓練
  async function handleEndExistingAndStartNew() {
    if (!existingActiveSession) return;
    const confirmed = window.confirm(
      `確定要結束進行中的【${existingActiveSession.target_muscle}】訓練，並在此開新場次嗎？`
    );
    if (!confirmed) return;

    try {
      await db.sessions.update(existingActiveSession.id, {
        status: "completed",
        updated_at: new Date().toISOString(),
        sync_status: "pending",
      });

      if (typeof window !== "undefined") {
        localStorage.removeItem("active_workout_session_id");
        localStorage.removeItem("active_workout_session_title");
        window.dispatchEvent(new Event("workout_session_update"));
      }

      setExistingActiveSession(null);
      runFullSync().catch(() => {});
    } catch (err) {
      console.error("結束舊訓練失敗:", err);
    }
  }

  // 整理複製上次菜單的動作與組數結構
  const groupedTemplateExercises = useMemo(() => {
    if (!prevTemplate) return [];
    const setsByExercise = new Map<string, SetItem[]>();
    for (const set of prevTemplate.sets) {
      const list = setsByExercise.get(set.exercise_id) || [];
      list.push(set);
      setsByExercise.set(set.exercise_id, list);
    }

    return prevTemplate.exerciseIds.map((exId) => ({
      exerciseId: exId,
      exercise: exercisesMap[exId],
      sets: setsByExercise.get(exId) || [],
    }));
  }, [prevTemplate, exercisesMap]);

  async function handleCreate() {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const safeDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : getLocalDateString();
      const parts = safeDate.split("-");
      const monthKey = `${parts[0]}-${parts[1]}`;
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);

      const finalLocation = location.trim();
      const finalMuscle = targetMuscle;
      const sessionId = `session-${safeDate}-${Date.now()}`;

      // 計算當月第幾次
      // 注意：重訓的「第 X 次」是指當月重訓場次（排除游泳）！
      // 游泳不帶「第 X 次」序號，且不計入重訓累計序號
      let monthlyIndex = 1;
      if (finalMuscle === "游泳") {
        const swimCount = await db.sessions
          .where("month_key")
          .equals(monthKey)
          .filter((s) => !s.deleted_at && (s.target_muscle === "游泳" || s.display_title.includes("泳")))
          .count();
        monthlyIndex = swimCount + 1;
      } else {
        const weightSessionsInMonth = await db.sessions
          .where("month_key")
          .equals(monthKey)
          .filter(
            (s) =>
              !s.deleted_at &&
              s.target_muscle !== "游泳" &&
              !s.target_muscle.includes("泳") &&
              !s.display_title.includes("泳")
          )
          .toArray();

        // 依日期正序計算本場次在當月重訓中的精準時間序號
        const sorted = [...weightSessionsInMonth, { date, created_at: new Date().toISOString() } as WorkoutSession].sort(
          (a, b) => {
            const cmp = a.date.localeCompare(b.date);
            if (cmp !== 0) return cmp;
            return (a.created_at || "").localeCompare(b.created_at || "");
          }
        );
        const myIndex = sorted.findIndex((s) => s.date === date);
        monthlyIndex = myIndex >= 0 ? myIndex + 1 : weightSessionsInMonth.length + 1;
      }

      // 格式化標準命名：
      // 若為游泳，如 "11/13 (游泳) - 交大游泳池 (下午)" 或 "11/13 (游泳) - 清大游泳池 [清大 alvaro 請]"
      // 若為重訓，如 "11/13 (胸) - 三健客 - 第 5 次"
      let title = "";
      if (finalMuscle === "游泳") {
        const timeTag = swimTimeSlot !== "全天" ? ` (${swimTimeSlot})` : "";
        const noteTag = swimNotes.trim() ? ` [${swimNotes.trim()}]` : "";
        title = `${m}/${d} (游泳) - ${finalLocation}${timeTag}${noteTag}`;
      } else {
        title = `${m}/${d} (${finalMuscle}) - ${finalLocation} - 第 ${monthlyIndex} 次`;
      }

      const newSession: WorkoutSession = {
        id: sessionId,
        date: date,
        month_key: monthKey,
        display_title: title,
        target_muscle: finalMuscle,
        monthly_index: monthlyIndex,
        location: finalLocation,
        notes: swimNotes.trim() || undefined,
        status: finalMuscle === "游泳" ? "completed" : "in_progress",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: "pending",
      };

      await db.sessions.add(newSession);

      // 若為重訓，自動對當月所有重訓場次按日期正序校正場次序號（防止補登導致後續場次序號重複）
      if (finalMuscle !== "游泳") {
        const allWeightInMonth = await db.sessions
          .where("month_key")
          .equals(monthKey)
          .filter(
            (s) =>
              !s.deleted_at &&
              s.target_muscle !== "游泳" &&
              !s.target_muscle.includes("泳") &&
              !s.display_title.includes("泳")
          )
          .toArray();

        allWeightInMonth.sort((a, b) => {
          const cmp = a.date.localeCompare(b.date);
          if (cmp !== 0) return cmp;
          return (a.created_at || "").localeCompare(b.created_at || "");
        });

        const updates: WorkoutSession[] = [];
        allWeightInMonth.forEach((s, idx) => {
          const correctIdx = idx + 1;
          const oldTitle = s.display_title;
          const newTitle = oldTitle.includes("第")
            ? oldTitle.replace(/第\s*\d+\s*次/, `第 ${correctIdx} 次`)
            : `${oldTitle} - 第 ${correctIdx} 次`;

          if (s.monthly_index !== correctIdx || oldTitle !== newTitle) {
            updates.push({
              ...s,
              monthly_index: correctIdx,
              display_title: newTitle,
              updated_at: new Date().toISOString(),
              sync_status: "pending",
            });
          }
        });

        if (updates.length > 0) {
          await db.sessions.bulkPut(updates);
        }
      }

      // 若為游泳，自動建立動作與對應 set，並直接返回首頁完成記錄
      if (finalMuscle === "游泳") {
        let swimEx = await db.exercises.get("ex-swim");
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

        const rawText = swimTimeSlot !== "全天" ? `${swimTimeSlot}游泳` : `游泳 (${finalLocation})`;
        const swimSet: SetItem = {
          id: `set-${Date.now()}-1`,
          session_id: sessionId,
          exercise_id: "ex-swim",
          set_order: 1,
          set_type: "normal",
          weight_kg: 0,
          reps: 1,
          raw_text: swimNotes.trim() ? `${rawText} - ${swimNotes.trim()}` : rawText,
          notes: swimNotes.trim() || rawText,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: "pending",
        };

        await db.sets.add(swimSet);
        runFullSync().catch(() => {});
        router.push("/");
        return;
      }

      // 若使用者勾選「沿用上一次菜單結構」，自動帶入組數
      if (clonePrevMenu && prevTemplate && prevTemplate.sets.length > 0) {
        const newSets: SetItem[] = prevTemplate.sets.map((s, idx) => ({
          id: `set-${Date.now()}-${idx}`,
          session_id: sessionId,
          exercise_id: s.exercise_id,
          set_order: idx + 1,
          set_type: s.set_type,
          weight_kg: s.weight_kg,
          reps: s.reps,
          raw_text: s.raw_text,
          sub_fields: s.sub_fields,
          is_failure: false,
          is_completed: false,
          feedback: undefined,
          notes: undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: "pending",
        }));

        await db.sets.bulkAdd(newSets);
      }

      if (finalMuscle !== "游泳") {
        if (typeof window !== "undefined") {
          localStorage.setItem("active_workout_session_id", sessionId);
          localStorage.setItem("active_workout_session_title", title);
          window.dispatchEvent(new Event("workout_session_update"));
        }
      }

      runFullSync().catch(() => {});
      router.push(`/workout/${sessionId}`);
    } catch (err) {
      console.error("建立訓練失敗:", err);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 max-w-md mx-auto pt-1 pb-16">
      {/* 頂部標題 */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="p-2 bg-[#121520] hover:bg-[#181b26] border border-[#262b3d] rounded-xl text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-lg font-black text-white flex items-center gap-2">
            <span>開新訓練</span>
            <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
              NEW SESSION
            </span>
          </h1>
          <p className="text-xs text-gray-400">快速選擇部位與場地，即刻開始記錄</p>
        </div>
      </div>

      {/* ⚡ 進行中訓練防呆提醒橫幅 (醒目脈衝光暈) */}
      {existingActiveSession && (
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/15 via-[#121520] to-amber-500/10 border-2 border-amber-500/60 rounded-2xl p-4 shadow-[0_0_25px_rgba(245,158,11,0.25)] space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
              <span className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1">
                <span>⚡</span>
                <span>進行中訓練防呆提醒</span>
              </span>
            </div>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/50 px-2 py-0.5 rounded-full font-black animate-pulse">
              LIVE 進行中
            </span>
          </div>

          <div>
            <h3 className="text-sm sm:text-base font-black text-white leading-snug">
              ⚡ 您目前有一場進行中的訓練：【{existingActiveSession.target_muscle}】(
              {existingActiveSession.location || "未指定地點"})，是否直接返回？
            </h3>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
              <span>📅 日期：{existingActiveSession.date}</span>
              <span>•</span>
              <span className="truncate max-w-[200px]">
                {cleanSessionTitle(
                  existingActiveSession.display_title,
                  existingActiveSession.target_muscle
                )}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <Link
              href={`/workout/${existingActiveSession.id}`}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black text-xs font-black py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>一鍵返回繼續訓練</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </Link>
            <button
              type="button"
              onClick={handleEndExistingAndStartNew}
              className="w-full bg-[#181b26] hover:bg-rose-500/10 border border-[#262b3d] hover:border-rose-500/40 text-gray-300 hover:text-rose-300 text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>結束舊場次開新訓練</span>
            </button>
          </div>
        </div>
      )}

      {/* 主要設定卡片 */}
      <div className="bg-[#121520] border border-[#262b3d] rounded-2xl p-5 space-y-4 shadow-xl">
        {/* 日期選擇 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>訓練日期</span>
            </label>
            <div className="flex items-center gap-1">
              {[
                { label: "今天", offset: 0 },
                { label: "昨天", offset: 1 },
                { label: "前天", offset: 2 },
              ].map((pill) => {
                const targetD = new Date();
                targetD.setDate(targetD.getDate() - pill.offset);
                const str = `${targetD.getFullYear()}-${(targetD.getMonth() + 1).toString().padStart(2, "0")}-${targetD.getDate().toString().padStart(2, "0")}`;
                const isActive = date === str;
                return (
                  <button
                    key={pill.label}
                    type="button"
                    onClick={() => setDate(str)}
                    className={`text-[10px] px-2 py-0.5 rounded-lg border font-bold transition-all cursor-pointer ${
                      isActive
                        ? "bg-emerald-500 text-black border-emerald-400 font-black shadow-sm"
                        : "bg-[#181b26] text-gray-400 hover:text-white border-[#262b3d]"
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-[#0b0d14] border border-[#262b3d] text-white text-sm font-medium rounded-xl p-3 focus:border-emerald-500 outline-none transition-colors"
          />
        </div>

        {/* 訓練目標部位膠囊 (Target Muscle Chips: 胸藍、背綠、腿紫、肩橘、泳青) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <Dumbbell className="w-4 h-4 text-emerald-400" />
              <span>主攻部位</span>
            </label>
            <span className="text-[10px] text-gray-500">點選切換專屬主題色</span>
          </div>

          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {MUSCLE_PRESETS.map((m) => {
              const isSelected = targetMuscle === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleMuscleSelect(m.id)}
                  className={`py-3 px-1 sm:px-2 rounded-2xl border font-black text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                    isSelected
                      ? `${m.activeClass} scale-[1.03]`
                      : "bg-[#0b0d14] border-[#262b3d] text-gray-400 hover:text-gray-200 hover:border-gray-600"
                  }`}
                >
                  <span className="text-lg">{m.icon}</span>
                  <span className="text-xs sm:text-sm font-black">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 訓練地點選擇膠囊 (Location Chips: [📍 三健客] [🏫 交大健身房] [🏊 交大游泳池]) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span>訓練地點</span>
            </label>
            <span className="text-[10px] text-gray-500">一鍵切換場地</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {LOCATION_PRESETS.map((loc) => {
              const isSelected = location === loc.id;
              const isSwim = loc.id === "交大游泳池";
              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => handleLocationSelect(loc.id)}
                  className={`py-3 px-2 rounded-2xl border font-black transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer active:scale-95 text-xs sm:text-sm ${
                    isSelected
                      ? isSwim
                        ? "bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.35)] ring-1 ring-cyan-400/50 scale-[1.02]"
                        : "bg-emerald-500/15 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.35)] ring-1 ring-emerald-400/50 scale-[1.02]"
                      : "bg-[#0b0d14] border-[#262b3d] text-gray-400 hover:text-gray-200 hover:border-gray-600"
                  }`}
                >
                  <span className="text-base sm:text-lg">{loc.icon}</span>
                  <span className="font-black tracking-wide truncate max-w-full">
                    {loc.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 游泳專用：時段選擇與備註 */}
        {targetMuscle === "游泳" && (
          <div className="bg-[#0b0d14] border border-cyan-500/30 rounded-2xl p-3.5 space-y-3 animate-in fade-in">
            <div>
              <label className="text-xs font-bold text-cyan-400 block mb-1.5 flex items-center gap-1.5">
                <span>🏊</span>
                <span>游泳時段</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(["早上", "下午", "晚上", "全天"] as const).map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSwimTimeSlot(slot)}
                    className={`py-2 px-1 text-xs rounded-xl border font-bold text-center transition-all ${
                      swimTimeSlot === slot
                        ? "bg-cyan-500 text-black border-cyan-400 shadow-md font-black"
                        : "bg-[#121520] border-[#262b3d] text-gray-300 hover:border-gray-600"
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1">
                備註說明 (選填，如：清大朋友請客 / 潤榮同行)
              </label>
              <input
                type="text"
                placeholder="例如：潤榮 游泳 / 清大 alvaro 請..."
                value={swimNotes}
                onChange={(e) => setSwimNotes(e.target.value)}
                className="w-full bg-[#121520] border border-[#262b3d] text-white text-xs rounded-xl p-2.5 outline-none focus:border-cyan-400 placeholder-gray-600"
              />
            </div>
          </div>
        )}

        {/* 📋 複製上次菜單預覽卡片 (Clone Previous Template) */}
        {prevTemplate && targetMuscle !== "游泳" && (
          <div className="bg-[#0b0d14] border border-emerald-500/30 rounded-2xl p-4 space-y-3 shadow-lg">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setClonePrevMenu(!clonePrevMenu)}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 rounded-xl transition-colors ${
                    clonePrevMenu
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-[#121520] text-gray-400 border border-[#262b3d]"
                  }`}
                >
                  <Copy className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                    <span>沿用上次【{targetMuscle}】菜單結構</span>
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold">
                      推薦
                    </span>
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span className="text-cyan-400 font-bold">📍 {prevTemplate.session.location || location}</span>
                    <span>• {prevTemplate.session.date}</span>
                    <span>• 共 {prevTemplate.exerciseIds.length} 個動作、{prevTemplate.sets.length} 組</span>
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={clonePrevMenu}
                onChange={(e) => setClonePrevMenu(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                className="w-5 h-5 accent-emerald-500 rounded-lg cursor-pointer"
              />
            </div>

            {/* 展開之動作清單卡片（動作名稱、組數、預計負重） */}
            {clonePrevMenu && (
              <div className="space-y-2 pt-1 border-t border-[#262b3d]/60 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
                  <span className="font-bold text-gray-300 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>即將複製的動作與目標負重：</span>
                  </span>
                  <span className="text-emerald-400 font-bold">
                    {prevTemplate.exerciseIds.length} 動作 / {prevTemplate.sets.length} 組
                  </span>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {groupedTemplateExercises.map(({ exerciseId, exercise, sets }) => (
                    <div
                      key={exerciseId}
                      className="bg-[#121520] border border-[#262b3d] rounded-xl p-2.5 space-y-1.5 hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>{exercise?.name || "自訂動作"}</span>
                        </span>
                        <span className="text-[11px] text-emerald-400/90 font-mono bg-[#0b0d14] px-2 py-0.5 rounded-full border border-[#262b3d]">
                          {sets.length} 組
                        </span>
                      </div>

                      {/* 各組負重預覽膠囊 */}
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {sets.map((s, idx) => {
                          const weightDisplay = s.weight_kg > 0 ? `${s.weight_kg}kg` : "自重";
                          return (
                            <span
                              key={s.id || idx}
                              className="text-[10px] bg-[#0b0d14] text-gray-300 border border-[#262b3d] px-1.5 py-0.5 rounded font-mono"
                            >
                              第{idx + 1}組: {weightDisplay} × {s.reps}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 提交按鈕 */}
        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleCreate}
          className={`w-full font-black py-3.5 rounded-xl shadow-lg transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            targetMuscle === "游泳"
              ? "bg-cyan-500 hover:bg-cyan-400 text-black shadow-cyan-500/20"
              : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20"
          }`}
        >
          {isSubmitting ? (
            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
          ) : (
            <Check className="w-4 h-4 stroke-[3]" />
          )}
          <span>
            {isSubmitting
              ? "正在建立訓練..."
              : targetMuscle === "游泳"
              ? "🏊 完成記錄游泳（直接儲存）"
              : "進入訓練並開始記組"}
          </span>
        </button>
      </div>
    </div>
  );
}

export default function NewWorkoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-20 text-gray-500 text-xs gap-2">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>載入訓練設定中...</span>
        </div>
      }
    >
      <NewWorkoutForm />
    </Suspense>
  );
}

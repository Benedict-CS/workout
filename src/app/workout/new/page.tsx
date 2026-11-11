"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Calendar,
  Dumbbell,
  MapPin,
  Copy,
} from "lucide-react";
import { db } from "@/lib/db/schema";
import { getPreviousSessionTemplate } from "@/lib/db/crud";
import type { WorkoutSession, SetItem, Exercise } from "@/lib/types";

const LOCATION_PRESETS = [
  "三健客",
  "交大健身房",
  "交大游泳池",
];

const MUSCLE_PRESETS = [
  "胸",
  "背",
  "腿",
  "游泳",
];

function NewWorkoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const todayStr = new Date().toISOString().split("T")[0];

  const [date, setDate] = useState(todayStr);
  const [targetMuscle, setTargetMuscle] = useState("胸");
  const [location, setLocation] = useState("三健客");

  // 上次菜單複製功能
  const [prevTemplate, setPrevTemplate] = useState<{
    session: WorkoutSession;
    exerciseIds: string[];
    sets: SetItem[];
  } | null>(null);
  const [clonePrevMenu, setClonePrevMenu] = useState(false);
  const [exercisesMap, setExercisesMap] = useState<Record<string, Exercise>>({});

  // 讀取 URL 參數
  useEffect(() => {
    const urlMuscle = searchParams.get("muscle");
    if (urlMuscle) {
      // 標準化部位至 4 大項
      if (urlMuscle.includes("胸")) setTargetMuscle("胸");
      else if (urlMuscle.includes("背")) setTargetMuscle("背");
      else if (urlMuscle.includes("腿")) setTargetMuscle("腿");
      else if (urlMuscle.includes("泳")) {
        setTargetMuscle("游泳");
        setLocation("交大游泳池");
      }
    }
  }, [searchParams]);

  // 當選擇部位為游泳時，自動切換至交大游泳池；反之若原本是交大游泳池切到重訓，自動切回三健客
  useEffect(() => {
    if (targetMuscle === "游泳" && location !== "交大游泳池") {
      setLocation("交大游泳池");
    } else if (targetMuscle !== "游泳" && location === "交大游泳池") {
      setLocation("三健客");
    }
  }, [targetMuscle]);

  // 載入所有動作名稱快照
  useEffect(() => {
    db.exercises.toArray().then((list) => {
      const map: Record<string, Exercise> = {};
      for (const ex of list) map[ex.id] = ex;
      setExercisesMap(map);
    });
  }, []);

  // 當部位切換時，自動尋找上次同部位菜單
  useEffect(() => {
    async function checkPrev() {
      if (targetMuscle === "游泳") {
        setPrevTemplate(null);
        setClonePrevMenu(false);
        return;
      }
      const match = await getPreviousSessionTemplate(targetMuscle);
      setPrevTemplate(match);
      if (match && match.sets.length > 0) {
        setClonePrevMenu(true);
      } else {
        setClonePrevMenu(false);
      }
    }
    checkPrev();
  }, [targetMuscle]);

  async function handleCreate() {
    const parts = date.split("-");
    const monthKey = `${parts[0]}-${parts[1]}`;
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);

    // 計算當月第幾次
    const currentMonthCount = await db.sessions
      .where("month_key")
      .equals(monthKey)
      .filter((s) => !s.deleted_at)
      .count();

    const monthlyIndex = currentMonthCount + 1;
    const finalLocation = location.trim();
    const finalMuscle = targetMuscle;

    // 格式化標準命名：如 "11/11 (胸) - 三健客 - 第 5 次"
    const title = `${m}/${d} (${finalMuscle}) - ${finalLocation} - 第 ${monthlyIndex} 次`;
    const sessionId = `session-${date}-${Date.now()}`;

    const newSession: WorkoutSession = {
      id: sessionId,
      date: date,
      month_key: monthKey,
      display_title: title,
      target_muscle: finalMuscle,
      monthly_index: monthlyIndex,
      location: finalLocation,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.sessions.add(newSession);

    // 若為游泳，自動建立一筆空組或直接進去點「早上游/下午游/晚上游」
    if (finalMuscle === "游泳") {
      router.push(`/workout/${sessionId}`);
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
        feedback: undefined,
        notes: undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: "pending",
      }));

      await db.sets.bulkAdd(newSets);
    }

    router.push(`/workout/${sessionId}`);
  }

  return (
    <div className="space-y-5 max-w-md mx-auto pt-2 pb-16">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="p-2 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] rounded-xl text-gray-300"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-lg font-black text-white">開新訓練</h1>
          <p className="text-xs text-gray-400">快速選擇部位與場地，即刻開始記錄</p>
        </div>
      </div>

      <div className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-5 space-y-4 shadow-xl">
        {/* 日期選擇 */}
        <div>
          <label className="text-xs font-bold text-gray-400 block mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>訓練日期</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-[#181b26] border border-[#262b3d] text-white text-sm font-medium rounded-xl p-3 focus:border-emerald-500 outline-none"
          />
        </div>

        {/* 主攻部位 (僅 4 大項：胸、背、腿、游泳) */}
        <div>
          <label className="text-xs font-bold text-gray-400 block mb-1.5 flex items-center gap-1.5">
            <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />
            <span>主攻部位 (大項)</span>
          </label>
          <div className="grid grid-cols-4 gap-2">
            {MUSCLE_PRESETS.map((p) => {
              let icon = "🔥";
              if (p === "背") icon = "⚡";
              if (p === "腿") icon = "🦵";
              if (p === "游泳") icon = "🏊";

              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTargetMuscle(p)}
                  className={`py-3 px-2 text-xs rounded-xl border font-bold text-center transition-all flex flex-col items-center gap-1 ${
                    targetMuscle === p
                      ? "bg-emerald-500 text-black border-emerald-400 shadow-lg scale-[1.02] font-black"
                      : "bg-[#181b26] border-[#262b3d] text-gray-300 hover:border-gray-600"
                  }`}
                >
                  <span className="text-sm">{icon}</span>
                  <span>{p}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 訓練場地 (僅限：三健客 (預設)、交大健身房、交大游泳池) */}
        <div>
          <label className="text-xs font-bold text-gray-400 block mb-1.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>訓練場地</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {LOCATION_PRESETS.map((loc) => {
              const isSelected = location === loc;
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocation(loc)}
                  className={`py-2.5 px-2 text-xs rounded-xl border font-bold transition-all text-center ${
                    isSelected
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm font-black"
                      : "bg-[#181b26] border-[#262b3d] text-gray-400 hover:text-white"
                  }`}
                >
                  {loc}
                </button>
              );
            })}
          </div>
        </div>

        {/* 📋 沿用上一次菜單功能 */}
        {prevTemplate && targetMuscle !== "游泳" && (
          <div className="bg-[#181b26] border border-emerald-500/30 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Copy className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-gray-200">
                    沿用上一次【{targetMuscle}】菜單
                  </h4>
                  <p className="text-[11px] text-gray-400">
                    {prevTemplate.session.date}（{prevTemplate.sets.length} 組 /{" "}
                    {prevTemplate.exerciseIds.length} 個動作）
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                id="cloneMenuCheckbox"
                checked={clonePrevMenu}
                onChange={(e) => setClonePrevMenu(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded mt-0.5 cursor-pointer"
              />
            </div>

            {clonePrevMenu && (
              <div className="text-[11px] text-emerald-300/90 bg-[#090a0f]/80 p-2.5 rounded-lg border border-[#262b3d] space-y-1">
                <span className="font-bold block text-gray-300 mb-0.5">即將自動帶入動作結構：</span>
                <div className="flex flex-wrap gap-1.5">
                  {prevTemplate.exerciseIds.map((exId) => (
                    <span
                      key={exId}
                      className="bg-[#181b26] text-gray-300 px-2 py-0.5 rounded border border-[#262b3d]"
                    >
                      {exercisesMap[exId]?.name || "動作"}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleCreate}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-3.5 rounded-xl shadow-lg transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 mt-3"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>進入訓練並開始記組</span>
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

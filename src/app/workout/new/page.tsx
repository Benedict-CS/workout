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
import { runFullSync } from "@/lib/db/sync";
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
  "肩",
  "游泳",
];

function NewWorkoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const todayStr = new Date().toISOString().split("T")[0];

  const [date, setDate] = useState(todayStr);
  const [targetMuscle, setTargetMuscle] = useState("胸");
  const [location, setLocation] = useState("三健客");

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

  // 讀取 URL 參數
  useEffect(() => {
    const urlDate = searchParams.get("date");
    if (urlDate) {
      setDate(urlDate);
    }
    const urlMuscle = searchParams.get("muscle");
    if (urlMuscle) {
      // 標準化部位至 5 大項
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
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const parts = date.split("-");
      const monthKey = `${parts[0]}-${parts[1]}`;
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);

      const finalLocation = location.trim();
      const finalMuscle = targetMuscle;
      const sessionId = `session-${date}-${Date.now()}`;

      // 計算當月第幾次
      // 注意：重訓的「第 X 次」是指當月重訓場次（排除游泳）！
      // 游泳不帶「第 X 次」序號，且不計入重訓累計序號
      let monthlyIndex = 1;
      if (finalMuscle === "游泳") {
        const swimCount = await db.sessions
          .where("month_key")
          .equals(monthKey)
          .filter((s) => !s.deleted_at && s.target_muscle === "游泳")
          .count();
        monthlyIndex = swimCount + 1;
      } else {
        const weightSessionsInMonth = await db.sessions
          .where("month_key")
          .equals(monthKey)
          .filter((s) => !s.deleted_at && s.target_muscle !== "游泳")
          .toArray();
        const maxMonthlyIndex = weightSessionsInMonth.reduce(
          (max, s) => Math.max(max, s.monthly_index || 0),
          0
        );
        monthlyIndex = maxMonthlyIndex + 1;
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

      runFullSync().catch(() => {});
      router.push(`/workout/${sessionId}`);
    } catch (err) {
      console.error("建立訓練失敗:", err);
      setIsSubmitting(false);
    }
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
          <label className="text-xs font-bold text-gray-300 block mb-1.5 flex items-center gap-1.5">
            <Dumbbell className="w-4 h-4 text-emerald-400" />
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
                  className={`py-3 px-2 text-sm rounded-xl border font-bold text-center transition-all flex flex-col items-center gap-1 cursor-pointer active:scale-95 ${
                    targetMuscle === p
                      ? "bg-emerald-500 text-black border-emerald-400 shadow-lg scale-[1.02] font-black"
                      : "bg-[#181b26] border-[#262b3d] text-gray-300 hover:border-gray-600"
                  }`}
                >
                  <span className="text-base">{icon}</span>
                  <span>{p}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 訓練場地 */}
        <div>
          <label className="text-xs font-bold text-gray-300 block mb-1.5 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>訓練場地</span>
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {(targetMuscle === "游泳" ? ["交大游泳池", "清大游泳池"] : ["三健客", "交大健身房"]).map((loc) => {
              const isSelected = location === loc;
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocation(loc)}
                  className={`py-3 px-2 text-sm rounded-xl border font-bold transition-all text-center cursor-pointer active:scale-95 ${
                    isSelected
                      ? targetMuscle === "游泳"
                        ? "bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm font-black"
                        : "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm font-black"
                      : "bg-[#181b26] border-[#262b3d] text-gray-400 hover:text-white"
                  }`}
                >
                  {loc}
                </button>
              );
            })}
          </div>
        </div>

        {/* 游泳專用：時段選擇與備註 */}
        {targetMuscle === "游泳" && (
          <div className="bg-[#181b26] border border-cyan-500/30 rounded-xl p-3.5 space-y-3">
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
                        : "bg-[#090a0f] border-[#262b3d] text-gray-300 hover:border-gray-600"
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
                className="w-full bg-[#090a0f] border border-[#262b3d] text-white text-xs rounded-xl p-2.5 outline-none focus:border-cyan-400 placeholder-gray-600"
              />
            </div>
          </div>
        )}

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
          type="button"
          disabled={isSubmitting}
          onClick={handleCreate}
          className={`w-full font-black py-3.5 rounded-xl shadow-lg transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 mt-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            targetMuscle === "游泳"
              ? "bg-cyan-500 hover:bg-cyan-400 text-black shadow-cyan-500/20"
              : "bg-emerald-500 hover:bg-emerald-400 text-black"
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

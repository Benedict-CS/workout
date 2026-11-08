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
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { db } from "@/lib/db/schema";
import { getPreviousSessionTemplate } from "@/lib/db/crud";
import type { WorkoutSession, SetItem, Exercise } from "@/lib/types";

const LOCATION_PRESETS = [
  "交大健身房",
  "三劍客",
  "學校健身房",
  "健身工廠",
  "成吉思汗",
];

const MUSCLE_PRESETS = [
  "胸部",
  "背部",
  "腿部",
  "肩部",
  "手臂",
  "胸部 + 三頭",
  "背部 + 二頭",
  "游泳",
];

function NewWorkoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const todayStr = new Date().toISOString().split("T")[0];

  const [date, setDate] = useState(todayStr);
  const [targetMuscle, setTargetMuscle] = useState("胸部");
  const [customMuscle, setCustomMuscle] = useState("");
  const [location, setLocation] = useState("交大健身房");
  const [customLocation, setCustomLocation] = useState("");
  const [customTitle, setCustomTitle] = useState("");

  // 上次菜單複製功能
  const [prevTemplate, setPrevTemplate] = useState<{
    session: WorkoutSession;
    exerciseIds: string[];
    sets: SetItem[];
  } | null>(null);
  const [clonePrevMenu, setClonePrevMenu] = useState(false);
  const [exercisesMap, setExercisesMap] = useState<Record<string, Exercise>>({});

  // 讀取 URL 參數與預設偏好
  useEffect(() => {
    const urlMuscle = searchParams.get("muscle");
    if (urlMuscle) {
      setTargetMuscle(urlMuscle);
    }
    const urlLoc = searchParams.get("location");
    if (urlLoc) {
      setLocation(urlLoc);
    } else {
      const storedGym = localStorage.getItem("workout_default_gym");
      if (storedGym) setLocation(storedGym);
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

  // 當部位切換時，自動尋找上次同部位菜單
  useEffect(() => {
    async function checkPrev() {
      const match = await getPreviousSessionTemplate(targetMuscle);
      setPrevTemplate(match);
      if (match && match.sets.length > 0) {
        setClonePrevMenu(true); // 預設推薦帶入
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
    const finalLocation = (customLocation.trim() || location).trim();
    const finalMuscle = (customMuscle.trim() || targetMuscle).trim();

    // 格式化為使用者的標準 Markdown 命名：如 "10/11 (胸) - 交大健身房 - 第 6 次"
    const locationPart = finalLocation ? ` - ${finalLocation}` : "";
    const title =
      customTitle.trim() || `${m}/${d} (${finalMuscle})${locationPart} - 第 ${monthlyIndex} 次`;

    const sessionId = `session-${date}-${Date.now()}`;

    const newSession: WorkoutSession = {
      id: sessionId,
      date: date,
      month_key: monthKey,
      display_title: title,
      target_muscle: finalMuscle,
      monthly_index: monthlyIndex,
      location: finalLocation || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.sessions.add(newSession);

    // 若使用者勾選「複製上一次菜單結構」，自動帶入組數
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
          <p className="text-xs text-gray-400">建立記錄、選定場地或一鍵複製上回菜單</p>
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

        {/* 訓練場地 (交大 / 三劍客 / 學校 / 健身工廠) */}
        <div>
          <label className="text-xs font-bold text-gray-400 block mb-1.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>訓練場地 (健身房)</span>
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {LOCATION_PRESETS.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => {
                  setLocation(loc);
                  setCustomLocation("");
                }}
                className={`text-xs px-3 py-1.5 rounded-xl border font-bold transition-all ${
                  location === loc && !customLocation
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm"
                    : "bg-[#181b26] border-[#262b3d] text-gray-300 hover:border-gray-600"
                }`}
              >
                {loc}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="或輸入其他場地名稱 (如: 宿舍、戶外)..."
            value={customLocation}
            onChange={(e) => setCustomLocation(e.target.value)}
            className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl px-3 py-2 focus:border-emerald-500 outline-none placeholder-gray-500"
          />
        </div>

        {/* 部位預設選單 */}
        <div>
          <label className="text-xs font-bold text-gray-400 block mb-1.5 flex items-center gap-1.5">
            <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />
            <span>主攻部位 / 類型</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {MUSCLE_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setTargetMuscle(p);
                  setCustomMuscle("");
                }}
                className={`py-2 px-3 text-xs rounded-xl border font-bold text-left transition-all ${
                  targetMuscle === p && !customMuscle
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                    : "bg-[#181b26] border-[#262b3d] text-gray-300 hover:border-gray-600"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="或輸入自訂課表 (如: 胸+肩、推日、拉日)..."
            value={customMuscle}
            onChange={(e) => {
              setCustomMuscle(e.target.value);
              if (e.target.value.trim()) setTargetMuscle(e.target.value.trim());
            }}
            className="w-full mt-2 bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl px-3 py-2 focus:border-emerald-500 outline-none placeholder-gray-500"
          />
        </div>

        {/* 📋 一鍵複製上一次菜單功能 */}
        {prevTemplate && (
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
                <p className="text-[10px] text-gray-400 mt-1">
                  💡 進入後每組重量預設為上一次數據，點一下即可確認或微調！
                </p>
              </div>
            )}
          </div>
        )}

        {/* 自訂標題 (可選) */}
        <div>
          <label className="text-xs font-bold text-gray-400 block mb-1">
            自訂標題 (可留空自動格式化)
          </label>
          <input
            type="text"
            placeholder="留空將自動帶入日期、部位、場地與月次數"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-3 focus:border-emerald-500 outline-none placeholder-gray-600"
          />
        </div>

        <button
          onClick={handleCreate}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-3 rounded-xl shadow-lg transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 mt-2"
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

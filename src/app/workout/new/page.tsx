"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Calendar, Dumbbell } from "lucide-react";
import { db } from "@/lib/db/schema";
import type { WorkoutSession } from "@/lib/types";

export default function NewWorkoutPage() {
  const router = useRouter();
  const todayStr = new Date().toISOString().split("T")[0];

  const [date, setDate] = useState(todayStr);
  const [targetMuscle, setTargetMuscle] = useState("胸部");
  const [customTitle, setCustomTitle] = useState("");

  const presets = [
    "胸部",
    "背部",
    "腿部",
    "肩部",
    "手臂",
    "胸部 + 三頭",
    "背部 + 二頭",
    "游泳",
  ];

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
    const sessionId = `session-${date}-${Date.now()}`;
    const title = customTitle || `${m}/${d} (${targetMuscle}) - 第 ${monthlyIndex} 次`;

    const newSession: WorkoutSession = {
      id: sessionId,
      date: date,
      month_key: monthKey,
      display_title: title,
      target_muscle: targetMuscle,
      monthly_index: monthlyIndex,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.sessions.add(newSession);
    router.push(`/workout/${sessionId}`);
  }

  return (
    <div className="space-y-6 max-w-md mx-auto pt-2">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="p-2 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] rounded-xl text-gray-300"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-lg font-black text-white">開新訓練</h1>
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

        {/* 部位預設選單 */}
        <div>
          <label className="text-xs font-bold text-gray-400 block mb-1.5 flex items-center gap-1.5">
            <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />
            <span>主攻部位 / 類型</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setTargetMuscle(p)}
                className={`py-2 px-3 text-xs rounded-xl border font-bold text-left transition-all ${
                  targetMuscle === p
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                    : "bg-[#181b26] border-[#262b3d] text-gray-300 hover:border-gray-600"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* 自訂標題 (可選) */}
        <div>
          <label className="text-xs font-bold text-gray-400 block mb-1.5">
            自訂標題 (可留空自動命名)
          </label>
          <input
            type="text"
            placeholder="例如: 11/8 (胸部) - 第 5 次"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-3 focus:border-emerald-500 outline-none"
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

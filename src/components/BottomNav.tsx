"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarDays,
  Plus,
  TrendingUp,
  Settings,
  Play,
  Dumbbell,
} from "lucide-react";
import { db } from "@/lib/db/schema";

export function BottomNav() {
  const pathname = usePathname();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const isHome = pathname === "/";
  const isHistory = pathname === "/history";
  const isNew = pathname === "/workout/new";
  const isAnalytics = pathname === "/analytics";
  const isExercises = pathname.startsWith("/exercises");
  const isSettings = pathname === "/settings";
  const isCurrentWorkout = pathname.startsWith("/workout/") && pathname !== "/workout/new";

  useEffect(() => {
    function checkActive() {
      const stored = localStorage.getItem("active_workout_session_id");
      if (stored) {
        db.sessions
          .get(stored)
          .then((sess) => {
            if (sess && !sess.deleted_at && sess.status === "in_progress") {
              setActiveSessionId(stored);
            } else {
              localStorage.removeItem("active_workout_session_id");
              localStorage.removeItem("active_workout_session_title");
              setActiveSessionId(null);
            }
          })
          .catch(() => setActiveSessionId(stored));
      } else {
        db.sessions
          .filter((s) => !s.deleted_at && s.status === "in_progress")
          .toArray()
          .then((list) => {
            if (list.length > 0) {
              setActiveSessionId(list[list.length - 1].id);
            } else {
              setActiveSessionId(null);
            }
          })
          .catch(() => setActiveSessionId(null));
      }
    }

    checkActive();
    window.addEventListener("storage", checkActive);
    window.addEventListener("workout_session_update", checkActive);
    return () => {
      window.removeEventListener("storage", checkActive);
      window.removeEventListener("workout_session_update", checkActive);
    };
  }, [pathname]);

  const centerHref = isCurrentWorkout
    ? pathname
    : activeSessionId
    ? `/workout/${activeSessionId}`
    : "/workout/new";

  const hasOngoingWorkout = !isCurrentWorkout && !!activeSessionId;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0b0d14]/90 backdrop-blur-xl border-t border-[#262b3d]/80 px-2 sm:px-4 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] flex items-center justify-around text-xs font-semibold select-none shadow-[0_-8px_30px_rgba(0,0,0,0.6)]">
      {/* 1. 訓練日誌 */}
      <Link
        href="/"
        className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all duration-200 cursor-pointer active:scale-95 ${
          isHome
            ? "text-emerald-400 font-black bg-emerald-500/10 border border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.2)] scale-[1.03]"
            : "text-gray-400 hover:text-gray-200 border border-transparent"
        }`}
      >
        <Activity className={`w-[18px] h-[18px] ${isHome ? "stroke-[2.5]" : ""}`} />
        <span className="text-[11px] sm:text-xs">訓練日誌</span>
      </Link>

      {/* 2. 歷史月曆 */}
      <Link
        href="/history"
        className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all duration-200 cursor-pointer active:scale-95 ${
          isHistory
            ? "text-emerald-400 font-black bg-emerald-500/10 border border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.2)] scale-[1.03]"
            : "text-gray-400 hover:text-gray-200 border border-transparent"
        }`}
      >
        <CalendarDays className={`w-[18px] h-[18px] ${isHistory ? "stroke-[2.5]" : ""}`} />
        <span className="text-[11px] sm:text-xs">歷史月曆</span>
      </Link>

      {/* 3. 中軸核心訓練鈕：有訓練時呈現琥珀金/柔綠脈衝光暈與「正在訓練」標籤 */}
      <div className="flex flex-col items-center -mt-5">
        <Link
          href={centerHref}
          className={`relative flex items-center justify-center w-12 h-12 rounded-full shadow-2xl active:scale-90 transition-all cursor-pointer ${
            isCurrentWorkout
              ? "bg-emerald-400 text-black ring-4 ring-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.5)] scale-105"
              : hasOngoingWorkout
              ? "bg-gradient-to-tr from-amber-400 via-amber-300 to-amber-400 text-black ring-4 ring-amber-400/50 shadow-[0_0_25px_rgba(245,158,11,0.6)] animate-pulse scale-105"
              : isNew
              ? "bg-emerald-400 text-black ring-4 ring-emerald-400/50 shadow-[0_0_18px_rgba(16,185,129,0.4)] scale-105"
              : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:scale-105"
          }`}
          title={
            isCurrentWorkout
              ? "目前正在訓練中"
              : hasOngoingWorkout
              ? "點此立即返回進行中的訓練"
              : "開新訓練"
          }
        >
          {/* 呼吸光環效果 */}
          {hasOngoingWorkout && (
            <span className="absolute -inset-1 rounded-full bg-amber-400/25 animate-ping pointer-events-none" />
          )}

          {isCurrentWorkout ? (
            <Dumbbell className="w-5 h-5 stroke-[2.5]" />
          ) : hasOngoingWorkout ? (
            <Play className="w-5 h-5 fill-black stroke-none ml-0.5" />
          ) : (
            <Plus className="w-6 h-6 stroke-[3]" />
          )}
        </Link>

        {/* 狀態微標籤 */}
        <span
          className={`text-[10px] mt-1 font-black tracking-tight leading-none px-1.5 py-0.5 rounded-full transition-colors ${
            isCurrentWorkout
              ? "text-emerald-400 bg-emerald-500/10"
              : hasOngoingWorkout
              ? "text-amber-300 bg-amber-500/20 border border-amber-500/40 shadow-sm animate-pulse"
              : "text-gray-400"
          }`}
        >
          {isCurrentWorkout
            ? "訓練中"
            : hasOngoingWorkout
            ? "正在訓練"
            : "開新訓練"}
        </span>
      </div>

      {/* 4. 訓練分析 */}
      <Link
        href="/analytics"
        className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all duration-200 cursor-pointer active:scale-95 ${
          isAnalytics
            ? "text-emerald-400 font-black bg-emerald-500/10 border border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.2)] scale-[1.03]"
            : "text-gray-400 hover:text-gray-200 border border-transparent"
        }`}
      >
        <TrendingUp className={`w-[18px] h-[18px] ${isAnalytics ? "stroke-[2.5]" : ""}`} />
        <span className="text-[11px] sm:text-xs">訓練分析</span>
      </Link>

      {/* 5. 動作庫 (Exercises) 捷徑與設定入口 */}
      <div className="relative flex items-center">
        {/* 動作庫主按鈕 */}
        <Link
          href="/exercises"
          className={`flex flex-col items-center gap-1 py-1 pl-2.5 pr-6 rounded-xl transition-all duration-200 cursor-pointer active:scale-95 ${
            isExercises
              ? "text-cyan-400 font-black bg-cyan-500/10 border border-cyan-500/25 shadow-[0_0_12px_rgba(6,182,212,0.2)] scale-[1.03]"
              : "text-gray-400 hover:text-gray-200 border border-transparent"
          }`}
          title="動作庫管理"
        >
          <Dumbbell className={`w-[18px] h-[18px] ${isExercises ? "stroke-[2.5]" : ""}`} />
          <span className="text-[11px] sm:text-xs">動作庫</span>
        </Link>

        {/* 右上角精巧齒輪捷徑：直達設定與備份 */}
        <Link
          href="/settings"
          className={`absolute right-1 top-1 p-1 rounded-lg transition-colors cursor-pointer hover:scale-110 active:scale-95 ${
            isSettings
              ? "text-emerald-400 bg-emerald-500/20 border border-emerald-500/30"
              : "text-gray-500 hover:text-gray-300"
          }`}
          title="系統設定與備份"
        >
          <Settings className="w-3.5 h-3.5" />
        </Link>
      </div>
    </nav>
  );
}

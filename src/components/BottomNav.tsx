"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarDays,
  PlusCircle,
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
  const isSettings = pathname === "/settings" || pathname.startsWith("/exercises");
  const isCurrentWorkout = pathname.startsWith("/workout/") && pathname !== "/workout/new";

  useEffect(() => {
    function checkActive() {
      const stored = localStorage.getItem("active_workout_session_id");
      if (stored) {
        db.sessions.get(stored).then((sess) => {
          if (sess && !sess.deleted_at && sess.status === "in_progress") {
            setActiveSessionId(stored);
          } else {
            localStorage.removeItem("active_workout_session_id");
            localStorage.removeItem("active_workout_session_title");
            setActiveSessionId(null);
          }
        }).catch(() => setActiveSessionId(stored));
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
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#12141c]/95 backdrop-blur-lg border-t border-[#262b3d] px-2 sm:px-4 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] flex items-center justify-around text-xs font-semibold select-none">
      <Link
        href="/"
        className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
          isHome
            ? "text-emerald-400 font-black scale-105"
            : "text-gray-400 hover:text-gray-200"
        }`}
      >
        <Activity className={`w-[18px] h-[18px] ${isHome ? "stroke-[2.5]" : ""}`} />
        <span className="text-[11px] sm:text-xs">訓練日誌</span>
      </Link>

      <Link
        href="/history"
        className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
          isHistory
            ? "text-emerald-400 font-black scale-105"
            : "text-gray-400 hover:text-gray-200"
        }`}
      >
        <CalendarDays className={`w-[18px] h-[18px] ${isHistory ? "stroke-[2.5]" : ""}`} />
        <span className="text-[11px] sm:text-xs">歷史月曆</span>
      </Link>

      {/* 中央突出動作鈕：若有進行中訓練自動化為快速返回鈕，否則為開新訓練 */}
      <Link
        href={centerHref}
        className={`flex flex-col items-center -mt-4 text-black p-3 rounded-full shadow-2xl active:scale-90 transition-all font-black shrink-0 ${
          isCurrentWorkout
            ? "bg-emerald-400 ring-4 ring-emerald-400/50 scale-105"
            : hasOngoingWorkout
            ? "bg-amber-400 hover:bg-amber-300 ring-4 ring-amber-400/60 animate-pulse scale-105 shadow-amber-500/30"
            : isNew
            ? "bg-emerald-400 ring-4 ring-emerald-400/50 scale-105"
            : "bg-emerald-500 hover:bg-emerald-400"
        }`}
        title={
          isCurrentWorkout
            ? "目前正在訓練中"
            : hasOngoingWorkout
            ? "點此立即返回進行中的訓練"
            : "開新訓練"
        }
      >
        {isCurrentWorkout ? (
          <Dumbbell className="w-6 h-6 stroke-[2.5]" />
        ) : hasOngoingWorkout ? (
          <Play className="w-6 h-6 fill-black stroke-none ml-0.5" />
        ) : (
          <PlusCircle className="w-6 h-6 stroke-[2.5]" />
        )}
      </Link>

      <Link
        href="/analytics"
        className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
          isAnalytics
            ? "text-emerald-400 font-black scale-105"
            : "text-gray-400 hover:text-gray-200"
        }`}
      >
        <TrendingUp className={`w-[18px] h-[18px] ${isAnalytics ? "stroke-[2.5]" : ""}`} />
        <span className="text-[11px] sm:text-xs">訓練分析</span>
      </Link>

      <Link
        href="/settings"
        className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
          isSettings
            ? "text-emerald-400 font-black scale-105"
            : "text-gray-400 hover:text-gray-200"
        }`}
      >
        <Settings className={`w-[18px] h-[18px] ${isSettings ? "stroke-[2.5]" : ""}`} />
        <span className="text-[11px] sm:text-xs">設定</span>
      </Link>
    </nav>
  );
}

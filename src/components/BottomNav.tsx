"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarDays,
  PlusCircle,
  TrendingUp,
  Settings,
} from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();

  const isHome = pathname === "/";
  const isHistory = pathname === "/history";
  const isNew = pathname === "/workout/new";
  const isAnalytics = pathname === "/analytics";
  const isSettings = pathname === "/settings" || pathname.startsWith("/exercises");

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

      {/* 中央突出開新訓練鈕 */}
      <Link
        href="/workout/new"
        className={`flex flex-col items-center -mt-4 bg-emerald-500 hover:bg-emerald-400 text-black p-3 rounded-full shadow-2xl active:scale-90 transition-all font-black shrink-0 ${
          isNew ? "ring-4 ring-emerald-400/50 scale-105" : ""
        }`}
        title="開新訓練"
      >
        <PlusCircle className="w-6 h-6 stroke-[2.5]" />
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

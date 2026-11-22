"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Play, WifiOff, ChevronRight } from "lucide-react";
import { db } from "@/lib/db/schema";

export function HeaderNavStatus() {
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const isCurrentWorkout = pathname.startsWith("/workout/") && pathname !== "/workout/new";

  useEffect(() => {
    // 網路狀態監聽
    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
    }
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // 進行中訓練監聽
    function checkActive() {
      const stored = localStorage.getItem("active_workout_session_id");
      if (stored) {
        db.sessions
          .get(stored)
          .then((sess) => {
            if (sess && !sess.deleted_at && sess.status === "in_progress") {
              setActiveSessionId(stored);
            } else {
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
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("storage", checkActive);
      window.removeEventListener("workout_session_update", checkActive);
    };
  }, [pathname]);

  return (
    <div className="flex items-center gap-2">
      {/* 離線警告標籤 */}
      {!isOnline && (
        <span
          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold shadow-sm"
          title="離線模式：所有動作組與重量秒存本機 IndexedDB，連上網路時自動雙向同步"
        >
          <WifiOff className="w-3 h-3 text-amber-400 shrink-0" />
          <span className="hidden xs:inline">離線秒存</span>
        </span>
      )}

      {/* 進行中訓練快速返迴膠囊 (當不在該 workout 頁面時顯示) */}
      {!isCurrentWorkout && activeSessionId && (
        <Link
          href={`/workout/${activeSessionId}`}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 text-[11px] font-black shadow-[0_0_12px_rgba(16,185,129,0.3)] animate-pulse transition-all active:scale-95 cursor-pointer"
        >
          <Play className="w-2.5 h-2.5 fill-emerald-400 text-emerald-400 shrink-0" />
          <span>訓練進行中</span>
          <ChevronRight className="w-3 h-3 text-emerald-400 shrink-0" />
        </Link>
      )}

      {/* 線上且無未完訓練時的極簡狀態點 */}
      {isOnline && (!activeSessionId || isCurrentWorkout) && (
        <div
          className="flex items-center gap-1.5 text-[10px] text-gray-400 bg-[#121520] border border-[#262b3d] px-2 py-0.5 rounded-full"
          title="Supabase 雲端雙向同步啟用中"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-gray-300 font-medium hidden sm:inline">雲端同步</span>
        </div>
      )}
    </div>
  );
}

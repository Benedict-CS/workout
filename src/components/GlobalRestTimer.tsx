"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Clock, Plus, X, ArrowUpRight, CheckCircle2, Bell, BellRing } from "lucide-react";

interface TimerInfo {
  sessionId: string;
  title: string;
}

function playAlarmChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    osc2.frequency.setValueAtTime(1046, ctx.currentTime + 0.15);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.15);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.9);
  } catch {}

  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate([200, 100, 200, 100, 400]);
    } catch {}
  }
}

function triggerNotification(title: string) {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification("⏱️ 休息時間結束！", {
        body: `${title} 組間休息結束，該進行下一組了！`,
        icon: "/icons/icon-192.png",
        tag: "workout-rest-timer",
      });
    } catch {}
  }
}

export function GlobalRestTimer() {
  const pathname = usePathname();
  const router = useRouter();

  const [remaining, setRemaining] = useState<number | null>(null);
  const [timerInfo, setTimerInfo] = useState<TimerInfo | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const hasAlertedRef = useRef(false);

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setNotifPermission(Notification.permission);
    }

    function updateState() {
      const storedEndStr = localStorage.getItem("workout_timer_end");
      const storedInfoStr = localStorage.getItem("workout_timer_info");

      if (!storedEndStr) {
        setRemaining(null);
        hasAlertedRef.current = false;
        return;
      }

      const endMs = parseInt(storedEndStr, 10);
      const now = Date.now();
      const remain = Math.ceil((endMs - now) / 1000);

      if (remain <= 0) {
        setRemaining(0);
        setIsFinished(true);
        localStorage.removeItem("workout_timer_end");

        if (!hasAlertedRef.current) {
          hasAlertedRef.current = true;
          playAlarmChime();
          const title = storedInfoStr ? (JSON.parse(storedInfoStr)?.title || "訓練") : "訓練";
          triggerNotification(title);
        }

        setTimeout(() => {
          setIsFinished(false);
          setRemaining(null);
          hasAlertedRef.current = false;
        }, 4000);
      } else {
        setRemaining(remain);
        setIsFinished(false);
      }

      if (storedInfoStr) {
        try {
          setTimerInfo(JSON.parse(storedInfoStr));
        } catch {
          setTimerInfo(null);
        }
      }
    }

    updateState();
    const interval = setInterval(updateState, 500);
    window.addEventListener("storage", updateState);
    window.addEventListener("workout_timer_update", updateState);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", updateState);
      window.removeEventListener("workout_timer_update", updateState);
    };
  }, []);

  async function handleRequestNotification(e: React.MouseEvent) {
    e.stopPropagation();
    if (typeof Notification !== "undefined") {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
    }
  }

  // 如果目前使用者就在當前的 workout 詳情頁，則由該頁面的內建計時器展示，避免重疊
  const isCurrentlyInWorkoutPage =
    pathname.startsWith("/workout/") &&
    pathname !== "/workout/new" &&
    timerInfo?.sessionId &&
    pathname.includes(timerInfo.sessionId);

  if (isCurrentlyInWorkoutPage) {
    return null;
  }

  // 若沒有倒數且未剛結束，不顯示
  if (remaining === null && !isFinished) {
    return null;
  }

  const mins = Math.floor(Math.max(0, remaining ?? 0) / 60);
  const secs = Math.max(0, remaining ?? 0) % 60;
  const timeFormatted = `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;

  function handleAdd30s(e: React.MouseEvent) {
    e.stopPropagation();
    const storedEndStr = localStorage.getItem("workout_timer_end");
    const endMs = storedEndStr ? parseInt(storedEndStr, 10) : Date.now();
    const newEnd = Math.max(Date.now(), endMs) + 30 * 1000;
    localStorage.setItem("workout_timer_end", newEnd.toString());
    window.dispatchEvent(new Event("workout_timer_update"));
  }

  function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation();
    localStorage.removeItem("workout_timer_end");
    setRemaining(null);
    setIsFinished(false);
    window.dispatchEvent(new Event("workout_timer_update"));
  }

  function handleReturnToWorkout() {
    if (timerInfo?.sessionId) {
      router.push(`/workout/${timerInfo.sessionId}`);
    }
  }

  return (
    <aside
      aria-label="全域組間休息計時器"
      onClick={handleReturnToWorkout}
      className="fixed bottom-20 left-3 right-3 max-w-md mx-auto z-40 bg-[#12141c]/95 backdrop-blur-md border border-amber-500/40 hover:border-amber-400 rounded-2xl p-2.5 shadow-2xl transition-all cursor-pointer flex items-center justify-between gap-3 animate-slide-up"
    >
      <div className="flex items-center gap-2.5 overflow-hidden">
        <div className={`p-2 rounded-xl shrink-0 ${isFinished ? "bg-emerald-500/20 text-emerald-400 animate-bounce" : "bg-amber-500/20 text-amber-400"}`}>
          {isFinished ? (
            <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
          ) : (
            <Clock className="w-5 h-5 stroke-[2.5] animate-pulse" />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-black font-mono text-amber-300 tracking-wider">
              {isFinished ? "休息結束！" : timeFormatted}
            </span>
            <span className="text-[10px] text-gray-400 truncate">
              {isFinished ? "準備做下一組" : timerInfo?.title || "訓練組間休息"}
            </span>
          </div>
          <div className="text-[10px] text-gray-400 flex items-center gap-0.5 hover:text-white">
            <span>點擊返回訓練頁</span>
            <ArrowUpRight className="w-3 h-3 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {notifPermission !== "granted" && typeof Notification !== "undefined" && (
          <button
            type="button"
            onClick={handleRequestNotification}
            className="p-1.5 bg-[#181b26] hover:bg-amber-500/20 text-gray-400 hover:text-amber-400 border border-[#262b3d] rounded-lg active:scale-95 transition-all"
            title="開啟組間休息系統推播通知"
          >
            <Bell className="w-3.5 h-3.5" />
          </button>
        )}

        {!isFinished && (
          <button
            type="button"
            onClick={handleAdd30s}
            className="px-2 py-1 bg-[#181b26] hover:bg-[#202533] border border-amber-500/30 text-amber-300 rounded-lg text-xs font-bold active:scale-95 transition-all flex items-center gap-0.5"
            title="加 30 秒"
          >
            <Plus className="w-3 h-3 stroke-[3]" />
            <span>30s</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          className="p-1.5 text-gray-400 hover:text-white bg-[#181b26] border border-[#262b3d] rounded-lg active:scale-95 transition-all"
          title="關閉計時"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}

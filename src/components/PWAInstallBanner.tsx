"use client";

import { useEffect, useState } from "react";
import { Download, X, Share, PlusSquare } from "lucide-react";

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // 檢查是否已在獨立 App 模式下運行
    if (typeof window !== "undefined") {
      const isApp =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      setIsStandalone(isApp);

      const ua = window.navigator.userAgent;
      const isApple = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
      setIsIOS(isApple);

      const isDismissed = localStorage.getItem("workout_pwa_dismissed");
      if (isDismissed) setDismissed(true);

      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstall);
      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      };
    }
  }, []);

  if (isStandalone || dismissed) {
    return null;
  }

  // 如果不是 iOS 且沒有拿到 install prompt，先隱藏
  if (!deferredPrompt && !isIOS) {
    return null;
  }

  async function handleInstallClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setDismissed(true);
      }
      setDeferredPrompt(null);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem("workout_pwa_dismissed", "true");
  }

  return (
    <div className="bg-gradient-to-r from-emerald-950/90 to-[#12141c] border border-emerald-500/40 rounded-2xl p-3 shadow-xl mb-4 flex items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
          <Download className="w-4 h-4 stroke-[2.5]" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-white text-xs">安裝 Workout 到手機主畫面</div>
          <div className="text-[10px] text-gray-400 truncate">
            {isIOS
              ? "點擊 Safari 下方「分享」按鈕 ➔「加入主畫面」即可全螢幕秒開"
              : "離線紀錄、組間震動計時、零延遲極致體驗"}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {!isIOS && deferredPrompt && (
          <button
            onClick={handleInstallClick}
            className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-lg text-xs shadow transition-all active:scale-95"
          >
            立即安裝
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="p-1 text-gray-400 hover:text-white rounded-lg"
          title="暫時關閉"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

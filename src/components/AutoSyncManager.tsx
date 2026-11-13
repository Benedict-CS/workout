"use client";

import { useEffect, useRef } from "react";
import { runFullSync } from "@/lib/db/sync";
import { ensureDatabaseSeeded } from "@/lib/db/seed";

export function AutoSyncManager() {
  const isSyncingRef = useRef(false);

  const triggerSync = async () => {
    if (isSyncingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    try {
      isSyncingRef.current = true;
      await runFullSync();
    } catch (err) {
      console.warn("Background auto-sync skipped/failed:", err);
    } finally {
      isSyncingRef.current = false;
    }
  };

  useEffect(() => {
    // 1. 初次載入：確保基礎資料完整並自動同步雲端
    ensureDatabaseSeeded().catch(() => {});

    // 2. 當網路重新連線時 (online 事件) 自動觸發同步
    const handleOnline = () => {
      triggerSync();
    };

    // 3. 當使用者切換分頁回本 App 或解鎖螢幕時 (visibilitychange) 自動檢查雲端更新
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        triggerSync();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleVisibilityChange);
    window.addEventListener("workout:sync", handleVisibilityChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 4. 定期背景自動同步 (每 90 秒檢查一次)
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        triggerSync();
      }
    }, 90 * 1000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleVisibilityChange);
      window.removeEventListener("workout:sync", handleVisibilityChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, []);

  return null;
}

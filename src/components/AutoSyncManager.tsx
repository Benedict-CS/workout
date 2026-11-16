"use client";

import { useEffect, useRef } from "react";
import { runFullSync } from "@/lib/db/sync";
import { ensureDatabaseSeeded } from "@/lib/db/seed";

const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000;

export function AutoSyncManager() {
  const isSyncingRef = useRef(false);
  const lastSyncAttemptRef = useRef(0);

  const triggerSync = async (force = false) => {
    if (isSyncingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    const now = Date.now();
    if (!force && now - lastSyncAttemptRef.current < MIN_SYNC_INTERVAL_MS) {
      return;
    }

    try {
      isSyncingRef.current = true;
      lastSyncAttemptRef.current = now;
      await runFullSync(force);
    } catch (err) {
      console.warn("Background auto-sync skipped/failed:", err);
    } finally {
      isSyncingRef.current = false;
    }
  };

  useEffect(() => {
    ensureDatabaseSeeded().catch(() => {});

    const handleOnline = () => {
      triggerSync(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        triggerSync(false);
      }
    };

    const handleExplicitSync = () => {
      triggerSync(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("workout:sync", handleExplicitSync);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        triggerSync(false);
      }
    }, 10 * 60 * 1000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("workout:sync", handleExplicitSync);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, []);

  return null;
}

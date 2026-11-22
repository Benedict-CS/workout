"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Download,
  Upload,
  Database,
  FileText,
  Dumbbell,
  ChevronRight,
  Clock,
  RefreshCw,
  Check,
  Sparkles,
} from "lucide-react";
import { db } from "@/lib/db/schema";
import { exportAllSessionsToMarkdown } from "@/lib/markdown-generator";
import { parseWorkoutMarkdown } from "@/lib/parser/markdown-parser";
import { runFullSync } from "@/lib/db/sync";

export default function SettingsPage() {
  // 備份還原檔案輸入
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreStatusMsg, setRestoreStatusMsg] = useState<string | null>(null);

  // 預設組間休息時長設定 (秒)
  const [defaultRest, setDefaultRest] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("workout_default_rest");
      if (saved) {
        const v = parseInt(saved, 10);
        if (!isNaN(v) && v > 0) return v;
      }
    }
    return 90;
  });
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbStats, setDbStats] = useState<{
    sessionsCount: number;
    setsCount: number;
    exercisesCount: number;
    inbodyCount: number;
  }>({ sessionsCount: 0, setsCount: 0, exercisesCount: 0, inbodyCount: 0 });

  useEffect(() => {
    async function fetchCounts() {
      try {
        const [sCount, setCount, exCount, ibCount] = await Promise.all([
          db.sessions.filter((s) => !s.deleted_at).count(),
          db.sets.filter((s) => !s.deleted_at).count(),
          db.exercises.filter((e) => !e.deleted_at).count(),
          db.inbody_records.count(),
        ]);
        setDbStats({ sessionsCount: sCount, setsCount: setCount, exercisesCount: exCount, inbodyCount: ibCount });
      } catch (e) {
        console.warn("無法取得本機資料庫計數:", e);
      }
    }
    fetchCounts();
  }, []);

  function handleSaveDefaultRest(sec: number) {
    setDefaultRest(sec);
    localStorage.setItem("workout_default_rest", sec.toString());
    setToastMsg(`預設休息時長已儲存為 ${sec} 秒！`);
    setTimeout(() => setToastMsg(null), 2000);
  }

  async function handleManualSync() {
    setIsSyncing(true);
    try {
      await runFullSync();
      setToastMsg("✅ 雲端資料同步完成！");
    } catch (err: any) {
      setToastMsg(`❌ 同步發生錯誤: ${err?.message || err}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setToastMsg(null), 2500);
    }
  }

  // 匯出 Markdown 檔案 (.md)
  async function handleExportMarkdown() {
    const sessions = await db.sessions.toArray();
    const exercises = await db.exercises.toArray();
    const sets = await db.sets.toArray();
    const b3List = await db.big_three.toArray();
    const md = exportAllSessionsToMarkdown(sessions, sets, exercises, b3List[0] || null);

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workout_journal_${new Date().toISOString().split("T")[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 匯出 JSON 備份
  async function handleExportBackup() {
    const sessions = await db.sessions.toArray();
    const exercises = await db.exercises.toArray();
    const sets = await db.sets.toArray();
    const bigThree = await db.big_three.toArray();
    const bodyWeights = await db.body_weight.toArray();
    const inbodyRecords = await db.inbody_records.toArray();

    const data = {
      exportDate: new Date().toISOString(),
      bigThree,
      sessions,
      exercises,
      sets,
      bodyWeights,
      inbodyRecords,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workout-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 匯入備份檔案 (.json 或 .md)
  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const isJson = file.name.endsWith(".json") || text.trim().startsWith("{");

      if (isJson) {
        const parsed = JSON.parse(text);
        if (!parsed.sessions || !parsed.sets) {
          throw new Error("無效的 JSON 備份格式 (缺少 sessions 或 sets)");
        }

        const extraInfo = [
          parsed.bodyWeights?.length ? `體重紀錄: ${parsed.bodyWeights.length} 筆` : "",
          parsed.inbodyRecords?.length ? `InBody檢測: ${parsed.inbodyRecords.length} 筆` : "",
        ].filter(Boolean).join("\n");

        const confirmRestore = confirm(
          `偵測到 JSON 備份：\n訓練次數: ${parsed.sessions.length} 次\n動作組數: ${parsed.sets.length} 組${extraInfo ? `\n${extraInfo}` : ""}\n\n確定要將資料還原合併至資料庫嗎？`
        );
        if (!confirmRestore) return;

        await db.transaction("rw", [db.sessions, db.exercises, db.sets, db.big_three, db.body_weight, db.inbody_records], async () => {
          if (parsed.sessions?.length) await db.sessions.bulkPut(parsed.sessions);
          if (parsed.exercises?.length) await db.exercises.bulkPut(parsed.exercises);
          if (parsed.sets?.length) await db.sets.bulkPut(parsed.sets);
          if (parsed.bigThree?.length) await db.big_three.bulkPut(parsed.bigThree);
          if (parsed.bodyWeights?.length) await db.body_weight.bulkPut(parsed.bodyWeights);
          if (parsed.inbodyRecords?.length) await db.inbody_records.bulkPut(parsed.inbodyRecords);
        });

        runFullSync().catch(() => {});
        setRestoreStatusMsg(`✅ 成功還原 ${parsed.sessions.length} 次訓練、${parsed.sets.length} 組紀錄${parsed.bodyWeights?.length ? `、${parsed.bodyWeights.length} 筆體重` : ""}${parsed.inbodyRecords?.length ? `、${parsed.inbodyRecords.length} 筆InBody` : ""}！`);
      } else {
        // Markdown 檔案
        const parsed = parseWorkoutMarkdown(text);
        if (parsed.sessions.length === 0) {
          throw new Error("未在此 Markdown 中解析出任何訓練紀錄");
        }

        const confirmRestore = confirm(
          `偵測到 Markdown 日誌：\n解析出訓練次數: ${parsed.sessions.length} 次\n動作組數: ${parsed.sets.length} 組\n\n確定要匯入合併至資料庫嗎？`
        );
        if (!confirmRestore) return;

        await db.transaction("rw", [db.sessions, db.exercises, db.sets, db.big_three], async () => {
          if (parsed.sessions?.length) await db.sessions.bulkPut(parsed.sessions);
          if (parsed.exercises?.length) await db.exercises.bulkPut(parsed.exercises);
          if (parsed.sets?.length) await db.sets.bulkPut(parsed.sets);
          if (parsed.bigThree) await db.big_three.put(parsed.bigThree);
        });

        runFullSync().catch(() => {});
        setRestoreStatusMsg(`✅ 成功從 Markdown 匯入 ${parsed.sessions.length} 次訓練與 ${parsed.sets.length} 組紀錄！`);
      }
    } catch (err: any) {
      setRestoreStatusMsg(`❌ 匯入失敗: ${err?.message || err}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h1 className="text-xl font-black text-white">設定 & 個人客製化</h1>
        <p className="text-xs text-gray-400">管理常用動作庫、資料備份與檔案還原</p>
      </div>

      {/* Toast 提示訊息 */}
      {toastMsg && (
        <div className="bg-emerald-500 text-black px-4 py-2.5 rounded-xl text-xs font-black shadow-2xl flex items-center gap-2 animate-in fade-in duration-150">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 動作庫管理 (置頂，方便現場與平時管理器材動作) */}
      <section className="bg-[#12141c] border border-cyan-500/40 rounded-2xl p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between border-b border-[#262b3d]/60 pb-2">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-gray-100">動作庫管理</h2>
          </div>
          <span className="text-[10px] text-gray-400">自訂動作、重量模式、部位分組</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          收錄啞鈴側平舉、槓鈴深蹲、引體向上等核心精選動作。可隨時自訂新增任何器械動作、管理常用收藏或微調重量類型設定。
        </p>
        <Link
          href="/exercises"
          className="w-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
        >
          <span>進入動作庫管理清單</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </section>

      {/* 訓練組間休息時長偏好設定 */}
      <section className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-3 shadow-md">
        <div className="flex items-center justify-between border-b border-[#262b3d]/60 pb-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-gray-100">預設組間休息時長</h2>
          </div>
          <span className="text-xs font-mono font-black text-amber-300">
            目前預設: {defaultRest} 秒
          </span>
        </div>
        <p className="text-xs text-gray-400">
          完成一組並勾選完成時，自動啟動組間休息倒數計時。
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { s: 60, label: "60 秒", desc: "小肌群 / 泵感" },
            { s: 90, label: "90 秒", desc: "標準肌肥大" },
            { s: 120, label: "120 秒", desc: "複合動作 / 力量" },
            { s: 180, label: "180 秒", desc: "大重量 PR 突破" },
          ].map((item) => (
            <button
              key={item.s}
              type="button"
              onClick={() => handleSaveDefaultRest(item.s)}
              className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                defaultRest === item.s
                  ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm"
                  : "bg-[#181b26] border-[#262b3d] text-gray-300 hover:text-white hover:bg-[#202533]"
              }`}
            >
              <span className="block text-sm font-black font-mono">{item.label}</span>
              <span className="block text-[10px] opacity-75 mt-0.5">{item.desc}</span>
            </button>
          ))}
        </div>

        {/* 自訂秒數微調步進器 */}
        <div className="flex items-center justify-between bg-[#181b26] border border-[#262b3d] rounded-xl p-2.5">
          <span className="text-xs font-bold text-gray-300">微調時長</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSaveDefaultRest(Math.max(15, defaultRest - 15))}
              className="px-2.5 py-1 bg-[#12141c] hover:bg-[#202533] border border-[#262b3d] text-gray-200 text-xs font-bold rounded-lg cursor-pointer active:scale-95 transition-all"
            >
              -15秒
            </button>
            <span className="font-mono font-black text-amber-400 text-sm w-16 text-center">
              {defaultRest}s
            </span>
            <button
              type="button"
              onClick={() => handleSaveDefaultRest(defaultRest + 15)}
              className="px-2.5 py-1 bg-[#12141c] hover:bg-[#202533] border border-[#262b3d] text-gray-200 text-xs font-bold rounded-lg cursor-pointer active:scale-95 transition-all"
            >
              +15秒
            </button>
          </div>
        </div>
      </section>

      {/* 📊 本機資料健康度 (IndexedDB) */}
      <section className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-[#262b3d]/60 pb-2">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-gray-100">本機離線數據狀態</h2>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
            Dexie 本地秒存正常
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d]">
            <span className="text-[10px] text-gray-400 block mb-0.5">累計訓練</span>
            <span className="text-base font-black text-white font-mono">{dbStats.sessionsCount}</span>
            <span className="text-[10px] text-gray-500 block mt-0.5">場次</span>
          </div>
          <div className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d]">
            <span className="text-[10px] text-gray-400 block mb-0.5">累計做組</span>
            <span className="text-base font-black text-white font-mono">{dbStats.setsCount}</span>
            <span className="text-[10px] text-gray-500 block mt-0.5">組數</span>
          </div>
          <div className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d]">
            <span className="text-[10px] text-gray-400 block mb-0.5">動作庫</span>
            <span className="text-base font-black text-white font-mono">{dbStats.exercisesCount}</span>
            <span className="text-[10px] text-gray-500 block mt-0.5">個動作</span>
          </div>
          <div className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d]">
            <span className="text-[10px] text-gray-400 block mb-0.5">InBody 檢測</span>
            <span className="text-base font-black text-white font-mono">{dbStats.inbodyCount}</span>
            <span className="text-[10px] text-gray-500 block mt-0.5">筆實測</span>
          </div>
        </div>
      </section>

      {/* 雲端同步與即時健康狀態 */}
      <section className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-[#262b3d]/60 pb-2">
          <div className="flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 text-emerald-400 ${isSyncing ? "animate-spin" : ""}`} />
            <h2 className="text-sm font-bold text-gray-100">雲端資料庫同步</h2>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
            雙向離線優先 (Offline-First)
          </span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          系統採用 Dexie (IndexedDB) 本地秒存，背景自動與雲端 Supabase 雙向同步。若換手機或清除瀏覽器快取，可隨時手動點擊同步。
        </p>

        <button
          type="button"
          onClick={handleManualSync}
          disabled={isSyncing}
          className="w-full bg-[#181b26] hover:bg-[#202533] border border-emerald-500/40 text-emerald-400 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
          <span>{isSyncing ? "正在與雲端同步資料..." : "立即手動執行雲端完整同步"}</span>
        </button>
      </section>

      {/* Markdown 與備份匯入還原 */}
      <section className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-[#262b3d]/60 pb-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-gray-100">備份匯出與檔案還原</h2>
          </div>
          <span className="text-[10px] text-gray-400">支援 .json / .md</span>
        </div>

        {/* 檔案還原提示訊息 */}
        {restoreStatusMsg && (
          <div className="p-2.5 rounded-xl text-xs bg-[#181b26] border border-emerald-500/30 text-emerald-300">
            {restoreStatusMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={handleExportMarkdown}
            className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4 stroke-[3]" />
            <span>匯出 Markdown 日誌</span>
          </button>

          <button
            onClick={handleExportBackup}
            className="bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-200 text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            <Database className="w-4 h-4 text-emerald-400" />
            <span>匯出 JSON 備份</span>
          </button>
        </div>

        {/* 隱藏的檔案選擇器 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.md,text/markdown,application/json"
          onChange={handleFileSelected}
          className="hidden"
        />

        <div className="pt-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-[#181b26] hover:bg-[#202533] border border-cyan-500/40 text-cyan-300 text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all"
          >
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>從檔案還原備份 (.json / .md)</span>
          </button>
        </div>
      </section>
    </div>
  );
}

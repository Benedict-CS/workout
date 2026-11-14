"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Download,
  Upload,
  CheckCircle,
  Database,
  FileText,
  Dumbbell,
  Timer,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { db } from "@/lib/db/schema";
import { exportAllSessionsToMarkdown } from "@/lib/markdown-generator";
import { parseWorkoutMarkdown } from "@/lib/parser/markdown-parser";
import { runFullSync } from "@/lib/db/sync";

export default function SettingsPage() {
  // 備份還原檔案輸入
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreStatusMsg, setRestoreStatusMsg] = useState<string | null>(null);

  // 預設組間休息時間 (秒)
  const [defaultRest, setDefaultRest] = useState<number>(150);
  const [restSaved, setRestSaved] = useState(false);

  useEffect(() => {
    const savedRest = localStorage.getItem("workout_default_rest");
    if (savedRest) {
      const val = parseInt(savedRest, 10);
      if (!isNaN(val) && val > 0) setDefaultRest(val);
    }
  }, []);

  function handleSelectDefaultRest(secs: number) {
    setDefaultRest(secs);
    localStorage.setItem("workout_default_rest", secs.toString());
    setRestSaved(true);
    setTimeout(() => setRestSaved(false), 2000);
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

    const data = {
      exportDate: new Date().toISOString(),
      bigThree,
      sessions,
      exercises,
      sets,
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

        const confirmRestore = confirm(
          `偵測到 JSON 備份：\n訓練次數: ${parsed.sessions.length} 次\n動作組數: ${parsed.sets.length} 組\n\n確定要將資料還原合併至資料庫嗎？`
        );
        if (!confirmRestore) return;

        await db.transaction("rw", [db.sessions, db.exercises, db.sets, db.big_three], async () => {
          if (parsed.sessions?.length) await db.sessions.bulkPut(parsed.sessions);
          if (parsed.exercises?.length) await db.exercises.bulkPut(parsed.exercises);
          if (parsed.sets?.length) await db.sets.bulkPut(parsed.sets);
          if (parsed.bigThree?.length) await db.big_three.bulkPut(parsed.bigThree);
        });

        runFullSync().catch(() => {});
        setRestoreStatusMsg(`✅ 成功還原 ${parsed.sessions.length} 次訓練與 ${parsed.sets.length} 組紀錄！`);
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
        <p className="text-xs text-gray-400">管理常用動作庫、組間休息偏好、資料備份與還原</p>
      </div>

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

      {/* 預設組間休息設定 */}
      <section className="bg-[#12141c] border border-amber-500/30 rounded-2xl p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between border-b border-[#262b3d]/60 pb-2">
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold text-gray-100">預設組間休息時長</h2>
          </div>
          {restSaved && (
            <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 animate-in fade-in">
              <CheckCircle className="w-3 h-3" />
              <span>已自動儲存</span>
            </span>
          )}
        </div>

        <p className="text-xs text-gray-400 leading-relaxed">
          訓練時每組完成打勾後，底部浮動計時器將自動以此時長快速啟動倒數。
        </p>

        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "1.5 分", secs: 90 },
            { label: "2 分", secs: 120 },
            { label: "2.5 分", secs: 150 },
            { label: "3 分", secs: 180 },
          ].map((item) => (
            <button
              key={item.secs}
              type="button"
              onClick={() => handleSelectDefaultRest(item.secs)}
              className={`py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                defaultRest === item.secs
                  ? "bg-amber-500 text-black border-amber-400 font-black shadow-md scale-[1.02]"
                  : "bg-[#181b26] text-gray-300 hover:text-white border-[#262b3d]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
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

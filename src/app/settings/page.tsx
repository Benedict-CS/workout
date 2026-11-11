"use client";

import { useState, useEffect, useRef } from "react";
import {
  Download,
  Upload,
  RefreshCw,
  CheckCircle,
  Database,
  Trophy,
  MapPin,
  FileText,
  Trash2,
} from "lucide-react";
import { db } from "@/lib/db/schema";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { exportAllSessionsToMarkdown } from "@/lib/markdown-generator";
import { parseWorkoutMarkdown } from "@/lib/parser/markdown-parser";
import { runFullSync } from "@/lib/db/sync";
import type { BigThreeRecord, WorkoutSession, SetItem, Exercise } from "@/lib/types";

const LOCATION_OPTIONS = [
  "三健客",
  "交大健身房",
  "交大游泳池",
];

export default function SettingsPage() {
  const [reseeded, setReseeded] = useState(false);

  // 雲端同步狀態
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>("");

  // 備份還原檔案輸入
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreStatusMsg, setRestoreStatusMsg] = useState<string | null>(null);

  // 個人體重與三項設定
  const [bodyWeight, setBodyWeight] = useState<string>("60");
  const [benchKg, setBenchKg] = useState<string>("60");
  const [squatKg, setSquatKg] = useState<string>("85");
  const [deadliftKg, setDeadliftKg] = useState<string>("90");
  const [b3Saved, setB3Saved] = useState(false);

  // 偏好設定 (預設三健客、休息 150 秒)
  const [defaultGym, setDefaultGym] = useState<string>("三健客");
  const [defaultRestTime, setDefaultRestTime] = useState<number>(150);
  const [prefSaved, setPrefSaved] = useState(false);

  useEffect(() => {
    // 讀取三項
    db.big_three.toArray().then((list) => {
      if (list.length > 0) {
        const b = list[0];
        setBenchKg(b.bench_press_kg.toString());
        setSquatKg(b.squat_kg.toString());
        setDeadliftKg(b.deadlift_kg.toString());
        if (b.body_weight_kg) setBodyWeight(b.body_weight_kg.toString());
      }
    });

    // 讀取偏好
    const storedGym = localStorage.getItem("workout_default_gym");
    if (storedGym) setDefaultGym(storedGym);
    const storedRest = localStorage.getItem("workout_default_rest");
    if (storedRest) setDefaultRestTime(parseInt(storedRest, 10));

    const storedLastSync = localStorage.getItem("workout_last_sync_time");
    if (storedLastSync) {
      setLastSyncTime(new Date(storedLastSync).toLocaleString("zh-TW", { hour12: false }));
    }
  }, []);

  async function handleSaveBigThree() {
    const bw = parseFloat(bodyWeight) || 60;
    const b = parseFloat(benchKg) || 0;
    const s = parseFloat(squatKg) || 0;
    const d = parseFloat(deadliftKg) || 0;
    const total = b + s + d;

    const bRatio = Math.round((b / bw) * 100) / 100;
    const sRatio = Math.round((s / bw) * 100) / 100;
    const dRatio = Math.round((d / bw) * 100) / 100;

    const rec: BigThreeRecord = {
      id: "big-three-global",
      bench_press_kg: b,
      squat_kg: s,
      deadlift_kg: d,
      total_kg: total,
      body_weight_kg: bw,
      bench_ratio: bRatio,
      squat_ratio: sRatio,
      deadlift_ratio: dRatio,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.big_three.put(rec);
    setB3Saved(true);
    setTimeout(() => setB3Saved(false), 2000);
    runFullSync().catch((err) => console.log("Sync error:", err));
  }

  function handleSavePreferences() {
    localStorage.setItem("workout_default_gym", defaultGym);
    localStorage.setItem("workout_default_rest", defaultRestTime.toString());
    setPrefSaved(true);
    setTimeout(() => setPrefSaved(false), 2000);
  }

  // 立即雙向同步
  async function handleTriggerSync() {
    setIsSyncing(true);
    setSyncStatusMsg("正在同步本地與雲端資料...");
    const res = await runFullSync();
    setSyncStatusMsg(res.message);
    setIsSyncing(false);
    if (res.success) {
      setLastSyncTime(new Date().toLocaleString("zh-TW", { hour12: false }));
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

        setRestoreStatusMsg(`✅ 成功從 Markdown 匯入 ${parsed.sessions.length} 次訓練與 ${parsed.sets.length} 組紀錄！`);
      }
    } catch (err: any) {
      setRestoreStatusMsg(`❌ 匯入失敗: ${err?.message || err}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // 重新從內建種子資料重置
  async function handleReseed() {
    if (!confirm("確定要重設並重新載入完整的初始歷史記錄嗎？")) return;
    await db.sessions.clear();
    await db.exercises.clear();
    await db.sets.clear();
    await db.big_three.clear();
    await ensureDatabaseSeeded();
    setReseeded(true);
    setTimeout(() => setReseeded(false), 2500);
  }

  // 清空所有資料
  async function handleClearAll() {
    if (!confirm("⚠️ 警告：這將徹底清空本地的所有訓練日誌與動作紀錄！確定要執行嗎？")) return;
    if (!confirm("最後確認：資料清空後無法復原，除非有事先備份檔案。確定清空？")) return;
    await db.sessions.clear();
    await db.exercises.clear();
    await db.sets.clear();
    await db.big_three.clear();
    setRestoreStatusMsg("已清空所有本地資料！");
  }

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h1 className="text-xl font-black text-white">設定 & 個人客製化</h1>
        <p className="text-xs text-gray-400">管理場地偏好、三項基準數據、備份匯入還原與 Supabase 雲端同步</p>
      </div>

      {/* 個人三項基準與體重設定 */}
      <section className="bg-[#12141c] border border-amber-500/30 rounded-2xl p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between border-b border-[#262b3d]/60 pb-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-gray-100">個人三項基準 & 體重倍數</h2>
          </div>
          <span className="text-[10px] text-gray-400">自動更新首頁與分析看板</span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">體重 (Kg)</label>
            <input
              type="number"
              value={bodyWeight}
              onChange={(e) => setBodyWeight(e.target.value)}
              className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs font-bold rounded-xl p-2.5 text-center outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">臥推 PR (Kg)</label>
            <input
              type="number"
              value={benchKg}
              onChange={(e) => setBenchKg(e.target.value)}
              className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs font-bold rounded-xl p-2.5 text-center outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">深蹲 PR (Kg)</label>
            <input
              type="number"
              value={squatKg}
              onChange={(e) => setSquatKg(e.target.value)}
              className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs font-bold rounded-xl p-2.5 text-center outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">硬舉 PR (Kg)</label>
            <input
              type="number"
              value={deadliftKg}
              onChange={(e) => setDeadliftKg(e.target.value)}
              className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs font-bold rounded-xl p-2.5 text-center outline-none focus:border-amber-400"
            />
          </div>
        </div>

        <button
          onClick={handleSaveBigThree}
          className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow"
        >
          {b3Saved ? <CheckCircle className="w-4 h-4" /> : null}
          <span>{b3Saved ? "三項數據已成功儲存！" : "儲存三項數據與體重比"}</span>
        </button>
      </section>

      {/* 偏好預設值 (預設場館與組間休息秒數) */}
      <section className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 border-b border-[#262b3d]/60 pb-2">
          <MapPin className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-gray-100">預設場館與計時器</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-gray-400 block mb-1">常用預設場館</label>
            <select
              value={defaultGym}
              onChange={(e) => setDefaultGym(e.target.value)}
              className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500"
            >
              {LOCATION_OPTIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-gray-400 block mb-1">預設組間休息時間</label>
            <select
              value={defaultRestTime}
              onChange={(e) => setDefaultRestTime(parseInt(e.target.value, 10))}
              className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500"
            >
              <option value={120}>2 分鐘 (120 秒)</option>
              <option value={150}>2 分半 (150 秒 - 常用)</option>
              <option value={180}>3 分鐘 (180 秒)</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSavePreferences}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-2.5 rounded-xl text-xs transition-all shadow"
          >
            {prefSaved ? "偏好已儲存！" : "儲存偏好設定"}
          </button>
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

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExportMarkdown}
            className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow"
          >
            <Download className="w-4 h-4 stroke-[3]" />
            <span>匯出完整 Markdown 日誌</span>
          </button>

          <button
            onClick={handleExportBackup}
            className="bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-200 text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all"
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

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-[#181b26] hover:bg-[#202533] border border-cyan-500/40 text-cyan-300 text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all"
          >
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>從檔案還原 (.json / .md)</span>
          </button>

          <button
            onClick={handleReseed}
            className="bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-amber-400 text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{reseeded ? "已重新載入歷史數據" : "重新載入種子數據"}</span>
          </button>
        </div>

        <div className="pt-2 border-t border-[#262b3d]/40 space-y-2">
          <button
            onClick={handleTriggerSync}
            disabled={isSyncing}
            className="w-full bg-[#181b26] hover:bg-[#202533] border border-blue-500/40 text-blue-300 font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "正在雙向同步資料..." : "⚡ 立即雙向同步雲端 (Sync Now)"}</span>
          </button>

          {syncStatusMsg && (
            <div className="p-2.5 rounded-xl text-xs bg-[#181b26] border border-blue-500/30 text-blue-300 flex items-center justify-between">
              <span>{syncStatusMsg}</span>
              {lastSyncTime && <span className="text-[10px] text-gray-400">上次: {lastSyncTime}</span>}
            </div>
          )}

          <button
            onClick={handleClearAll}
            className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>清空所有本機資料 (危險操作)</span>
          </button>
        </div>
      </section>
    </div>
  );
}

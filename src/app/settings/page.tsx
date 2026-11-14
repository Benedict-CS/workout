"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Download,
  Upload,
  CheckCircle,
  Database,
  Trophy,
  FileText,
  Trash2,
  Dumbbell,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { db } from "@/lib/db/schema";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { exportAllSessionsToMarkdown } from "@/lib/markdown-generator";
import { parseWorkoutMarkdown } from "@/lib/parser/markdown-parser";
import { runFullSync } from "@/lib/db/sync";
import type { BigThreeRecord, WorkoutSession, SetItem, Exercise } from "@/lib/types";

export default function SettingsPage() {
  const [reseeded, setReseeded] = useState(false);

  // 備份還原檔案輸入
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreStatusMsg, setRestoreStatusMsg] = useState<string | null>(null);

  // 個人體重與三項設定
  const [bodyWeight, setBodyWeight] = useState<string>("62.6");
  const [benchKg, setBenchKg] = useState<string>("60");
  const [squatKg, setSquatKg] = useState<string>("85");
  const [deadliftKg, setDeadliftKg] = useState<string>("90");
  const [b3Saved, setB3Saved] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      // 1. 優先讀取秤盤最新量測體重 (空腹量測基準)
      const bwList = await db.body_weight.orderBy("date").toArray();
      const latestScaleWeight = bwList.length > 0 ? bwList[bwList.length - 1].weight_kg : 63.6;

      // 2. 自動從真實訓練歷史中動態計算全歷史三項最高重量 (含今日深蹲 90Kg)
      const allSets = await db.sets.filter((s) => !s.deleted_at && s.weight_kg > 0).toArray();
      const allExercises = await db.exercises.toArray();
      const benchExIds = allExercises.filter((e) => e.name.includes("臥推") && !e.name.includes("啞鈴")).map((e) => e.id);
      const squatExIds = allExercises.filter((e) => e.name.includes("深蹲")).map((e) => e.id);
      const deadliftExIds = allExercises.filter((e) => e.name.includes("硬舉")).map((e) => e.id);

      let allTimeBench = 0;
      let allTimeSquat = 0;
      let allTimeDead = 0;
      for (const st of allSets) {
        if (benchExIds.includes(st.exercise_id) && st.weight_kg > allTimeBench) allTimeBench = st.weight_kg;
        if (squatExIds.includes(st.exercise_id) && st.weight_kg > allTimeSquat) allTimeSquat = st.weight_kg;
        if (deadliftExIds.includes(st.exercise_id) && st.weight_kg > allTimeDead) allTimeDead = st.weight_kg;
      }

      const list = await db.big_three.toArray();
      const oldB3 = list.length > 0 ? list[0] : null;

      const effectiveBench = Math.max(allTimeBench, oldB3?.bench_press_kg || 60);
      const effectiveSquat = Math.max(allTimeSquat, oldB3?.squat_kg || 85);
      const effectiveDead = Math.max(allTimeDead, oldB3?.deadlift_kg || 90);
      const effectiveBw = latestScaleWeight || oldB3?.body_weight_kg || 63.6;

      setBenchKg(effectiveBench.toString());
      setSquatKg(effectiveSquat.toString());
      setDeadliftKg(effectiveDead.toString());
      setBodyWeight(effectiveBw.toString());

      // 自動同步寫入 db.big_three
      const rec: BigThreeRecord = {
        id: oldB3?.id || "big-three-global",
        bench_press_kg: effectiveBench,
        squat_kg: effectiveSquat,
        deadlift_kg: effectiveDead,
        total_kg: effectiveBench + effectiveSquat + effectiveDead,
        body_weight_kg: effectiveBw,
        bench_ratio: Math.round((effectiveBench / effectiveBw) * 100) / 100,
        squat_ratio: Math.round((effectiveSquat / effectiveBw) * 100) / 100,
        deadlift_ratio: Math.round((effectiveDead / effectiveBw) * 100) / 100,
        updated_at: new Date().toISOString(),
        sync_status: "pending",
      };
      await db.big_three.put(rec);
    }
    loadSettings();
  }, []);

  // 即時動態計算體重倍數
  const curBw = parseFloat(bodyWeight) || 0;
  const curBench = parseFloat(benchKg) || 0;
  const curSquat = parseFloat(squatKg) || 0;
  const curDead = parseFloat(deadliftKg) || 0;
  const curTotal = curBench + curSquat + curDead;

  const benchMultiplier = curBw > 0 ? (curBench / curBw).toFixed(2) : "-";
  const squatMultiplier = curBw > 0 ? (curSquat / curBw).toFixed(2) : "-";
  const deadMultiplier = curBw > 0 ? (curDead / curBw).toFixed(2) : "-";
  const totalMultiplier = curBw > 0 ? (curTotal / curBw).toFixed(2) : "-";

  async function handleSaveBigThree() {
    const bw = parseFloat(bodyWeight) || 62.6;
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
        <p className="text-xs text-gray-400">管理場地偏好、三項基準數據、備份匯出與檔案還原</p>
      </div>

      {/* 個人三項基準與體重設定 */}
      <section className="bg-[#12141c] border border-amber-500/30 rounded-2xl p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between border-b border-[#262b3d]/60 pb-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-gray-100">個人三項 PR 基準 & 體重倍數</h2>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>自適應訓練即時抓取</span>
          </span>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] p-2.5 rounded-xl font-bold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>系統已自動從真實歷史訓練（含今日深蹲 90Kg 新高）與最新量測體重 (63.6Kg) 即時同步更新！</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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

        {/* 即時計算體重倍數卡片展示 */}
        <div className="bg-[#181b26] p-3 rounded-xl border border-[#262b3d] grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className="p-1">
            <span className="text-[11px] text-gray-400 block mb-0.5">臥推倍數</span>
            <span className="text-base font-black text-red-400">{benchMultiplier}</span>
            <span className="text-[10px] text-gray-500 block">x 體重</span>
          </div>
          <div className="p-1">
            <span className="text-[11px] text-gray-400 block mb-0.5">深蹲倍數</span>
            <span className="text-base font-black text-emerald-400">{squatMultiplier}</span>
            <span className="text-[10px] text-gray-500 block">x 體重</span>
          </div>
          <div className="p-1">
            <span className="text-[11px] text-gray-400 block mb-0.5">硬舉倍數</span>
            <span className="text-base font-black text-blue-400">{deadMultiplier}</span>
            <span className="text-[10px] text-gray-500 block">x 體重</span>
          </div>
          <div className="p-1 bg-[#202533]/40 rounded-lg border border-amber-500/20">
            <span className="text-[11px] text-amber-400 font-bold block mb-0.5">三項總和</span>
            <span className="text-base font-black text-amber-300">{totalMultiplier}</span>
            <span className="text-[10px] text-amber-400/70 block">x 體重 ({curTotal}kg)</span>
          </div>
        </div>

        <button
          onClick={handleSaveBigThree}
          className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow active:scale-95 cursor-pointer"
        >
          {b3Saved ? <CheckCircle className="w-4 h-4" /> : null}
          <span>{b3Saved ? "三項數據已成功儲存！" : "手動儲存三項基準與體重倍數"}</span>
        </button>
      </section>

      {/* 動作庫管理 */}
      <section className="bg-[#12141c] border border-cyan-500/30 rounded-2xl p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between border-b border-[#262b3d]/60 pb-2">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-cyan-400" />
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

"use client";

import { useState, useEffect } from "react";
import {
  Cloud,
  Download,
  Upload,
  RefreshCw,
  CheckCircle,
  Database,
  Trophy,
  MapPin,
  Clock,
  User,
  FileText,
} from "lucide-react";
import { db } from "@/lib/db/schema";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { exportAllSessionsToMarkdown } from "@/lib/markdown-generator";
import type { BigThreeRecord, WorkoutSession, SetItem, Exercise } from "@/lib/types";

const LOCATION_OPTIONS = [
  "交大健身房",
  "三劍客",
  "學校健身房",
  "健身工廠",
  "成吉思汗",
];

export default function SettingsPage() {
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseKey, setSupabaseKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [reseeded, setReseeded] = useState(false);

  // 個人體重與三項設定
  const [bodyWeight, setBodyWeight] = useState<string>("60");
  const [benchKg, setBenchKg] = useState<string>("60");
  const [squatKg, setSquatKg] = useState<string>("85");
  const [deadliftKg, setDeadliftKg] = useState<string>("90");
  const [b3Saved, setB3Saved] = useState(false);

  // 偏好設定
  const [defaultGym, setDefaultGym] = useState<string>("交大健身房");
  const [defaultRestTime, setDefaultRestTime] = useState<number>(90);
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

    const storedUrl = localStorage.getItem("workout_supabase_url");
    if (storedUrl) setSupabaseUrl(storedUrl);
    const storedKey = localStorage.getItem("workout_supabase_key");
    if (storedKey) setSupabaseKey(storedKey);
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
  }

  function handleSavePreferences() {
    localStorage.setItem("workout_default_gym", defaultGym);
    localStorage.setItem("workout_default_rest", defaultRestTime.toString());
    setPrefSaved(true);
    setTimeout(() => setPrefSaved(false), 2000);
  }

  function handleSaveSupabase() {
    localStorage.setItem("workout_supabase_url", supabaseUrl);
    localStorage.setItem("workout_supabase_key", supabaseKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
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

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h1 className="text-xl font-black text-white">設定 & 個人客製化</h1>
        <p className="text-xs text-gray-400">管理場地偏好、三項基準數據與 Markdown / 雲端備份</p>
      </div>

      {/* 個人三項基準與體重設定 */}
      <section className="bg-[#12141c] border border-amber-500/30 rounded-2xl p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between border-b border-[#262b3d]/60 pb-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-gray-100">個人三項基準 & 體重倍數</h2>
          </div>
          <span className="text-[10px] text-gray-400">自動更新首頁看板</span>
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
          <span>{b3Saved ? "三項數據已成功儲存！" : "更新三項基準"}</span>
        </button>
      </section>

      {/* 偏好設定 (預設健身房與休息秒數) */}
      <section className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 border-b border-[#262b3d]/60 pb-2">
          <MapPin className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-gray-100">訓練場地 & 計時偏好</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-gray-400 block mb-1">常用主訓練場地</label>
            <select
              value={defaultGym}
              onChange={(e) => setDefaultGym(e.target.value)}
              className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs font-bold rounded-xl p-2.5 outline-none focus:border-emerald-500"
            >
              {LOCATION_OPTIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] text-gray-400 block mb-1">預設組間休息倒數</label>
            <select
              value={defaultRestTime}
              onChange={(e) => setDefaultRestTime(parseInt(e.target.value, 10))}
              className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs font-bold rounded-xl p-2.5 outline-none focus:border-emerald-500"
            >
              <option value={60}>60 秒 (輕重量/孤立動作)</option>
              <option value={90}>90 秒 (標準常規組)</option>
              <option value={120}>120 秒 (2 分鐘 - 中大重量)</option>
              <option value={180}>180 秒 (3 分鐘 - 大重量複合動作)</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleSavePreferences}
          className="w-full bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-emerald-400 font-bold py-2 rounded-xl text-xs transition-all"
        >
          {prefSaved ? "偏好設定已儲存！" : "儲存偏好設定"}
        </button>
      </section>

      {/* Markdown 與備份管理 */}
      <section className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 border-b border-[#262b3d]/60 pb-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-gray-100">Markdown 導出與全庫備份</h2>
        </div>

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

        <button
          onClick={handleReseed}
          className="w-full bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-amber-400 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{reseeded ? "已重置並載入 1,293 組種子數據" : "重新重置並載入原始種子資料"}</span>
        </button>
      </section>

      {/* Supabase 雲端設定 */}
      <section className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 border-b border-[#262b3d]/60 pb-2">
          <Cloud className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-bold text-gray-100">Supabase 雲端跨裝置連線</h2>
        </div>

        <div className="space-y-2">
          <div>
            <label className="text-[11px] text-gray-400 block mb-1">Project URL</label>
            <input
              type="text"
              placeholder="https://xxxxxxxx.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-2.5 outline-none focus:border-blue-500 font-mono"
            />
          </div>
          <div>
            <label className="text-[11px] text-gray-400 block mb-1">Anon Public Key</label>
            <input
              type="password"
              placeholder="eyJhbGciOi..."
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
              className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-2.5 outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        <button
          onClick={handleSaveSupabase}
          className="w-full bg-blue-500 hover:bg-blue-400 text-black font-black py-2 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow"
        >
          {saved ? <CheckCircle className="w-4 h-4" /> : null}
          <span>{saved ? "已儲存雲端設定" : "儲存雲端連線設定"}</span>
        </button>
      </section>
    </div>
  );
}

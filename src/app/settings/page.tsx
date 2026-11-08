"use client";

import { useState } from "react";
import { Cloud, Download, Upload, RefreshCw, CheckCircle, Database } from "lucide-react";
import { db } from "@/lib/db/schema";
import { ensureDatabaseSeeded } from "@/lib/db/seed";

export default function SettingsPage() {
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseKey, setSupabaseKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [reseeded, setReseeded] = useState(false);

  function handleSaveSupabase() {
    localStorage.setItem("workout_supabase_url", supabaseUrl);
    localStorage.setItem("workout_supabase_key", supabaseKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
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
    <div className="space-y-5 pb-8">
      <div>
        <h1 className="text-xl font-black text-white">設定 & 雲端同步</h1>
        <p className="text-xs text-gray-400">管理 Supabase 遠端同步與本機資料備份</p>
      </div>

      {/* Supabase 設定卡片 */}
      <section className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 border-b border-[#262b3d]/60 pb-2">
          <Cloud className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-gray-100">Supabase 雲端連線設定</h2>
        </div>

        <div className="space-y-2">
          <div>
            <label className="text-[11px] text-gray-400 block mb-1">Project URL</label>
            <input
              type="text"
              placeholder="https://xxxxxxxx.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500 font-mono"
            />
          </div>
          <div>
            <label className="text-[11px] text-gray-400 block mb-1">Anon Public Key</label>
            <input
              type="password"
              placeholder="eyJhbGciOi..."
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
              className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500 font-mono"
            />
          </div>
        </div>

        <button
          onClick={handleSaveSupabase}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
        >
          {saved ? <CheckCircle className="w-4 h-4" /> : null}
          <span>{saved ? "已儲存連線設定" : "儲存設定"}</span>
        </button>
      </section>

      {/* 資料備份與還原 */}
      <section className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 border-b border-[#262b3d]/60 pb-2">
          <Database className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-gray-100">本機備份管理</h2>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExportBackup}
            className="bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-200 text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>匯出 JSON 備份</span>
          </button>
          <button
            onClick={handleReseed}
            className="bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-200 text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all"
          >
            <RefreshCw className="w-4 h-4 text-amber-400" />
            <span>{reseeded ? "已重新載入" : "重新匯入種子"}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

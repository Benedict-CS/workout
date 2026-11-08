"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Trophy,
  Flame,
  ChevronRight,
  Plus,
  Calendar,
  Sparkles,
  Zap,
  MapPin,
  Copy,
  Check,
} from "lucide-react";
import { db } from "@/lib/db/schema";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { formatSessionToMarkdown } from "@/lib/markdown-generator";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import type { BigThreeRecord, WorkoutSession, SetItem, Exercise } from "@/lib/types";

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [bigThree, setBigThree] = useState<BigThreeRecord | null>(null);
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [monthStats, setMonthStats] = useState<Record<string, number>>({});
  const [sessionSetsMap, setSessionSetsMap] = useState<Record<string, SetItem[]>>({});
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        await ensureDatabaseSeeded();

        // 讀取三項
        const b3 = await db.big_three.toArray();
        if (b3.length > 0) setBigThree(b3[0]);

        const allEx = await db.exercises.toArray();
        setExercises(allEx);

        // 讀取最近訓練
        const sessions = await db.sessions
          .filter((s) => !s.deleted_at)
          .reverse()
          .sortBy("date")
          .then((l) => l.slice(0, 15));
        setRecentSessions(sessions);

        // 讀取最近 sessions 的組數預覽
        const sessionIds = sessions.map((s) => s.id);
        const sets = await db.sets
          .where("session_id")
          .anyOf(sessionIds)
          .filter((s) => !s.deleted_at)
          .toArray();

        const map: Record<string, SetItem[]> = {};
        for (const s of sets) {
          if (!map[s.session_id]) map[s.session_id] = [];
          map[s.session_id].push(s);
        }
        setSessionSetsMap(map);

        // 計算當前最新月份統計
        if (sessions.length > 0) {
          const latestMonthKey = sessions[0].month_key;
          const monthSessions = await db.sessions
            .where("month_key")
            .equals(latestMonthKey)
            .filter((s) => !s.deleted_at)
            .toArray();

          const stats: Record<string, number> = { 胸: 0, 背: 0, 腿: 0, 游泳: 0 };
          for (const s of monthSessions) {
            if (s.target_muscle.includes("胸")) stats["胸"] = (stats["胸"] || 0) + 1;
            if (s.target_muscle.includes("背")) stats["背"] = (stats["背"] || 0) + 1;
            if (s.target_muscle.includes("腿")) stats["腿"] = (stats["腿"] || 0) + 1;
            if (s.target_muscle.includes("游泳")) stats["游泳"] = (stats["游泳"] || 0) + 1;
          }
          setMonthStats(stats);
        }
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  function handleCopyMarkdown(e: React.MouseEvent, session: WorkoutSession) {
    e.preventDefault();
    e.stopPropagation();
    const sets = sessionSetsMap[session.id] || [];
    const md = formatSessionToMarkdown(session, sets, exercises);
    navigator.clipboard.writeText(md);
    setCopyToast(`已複製【${session.display_title}】Markdown！`);
    setTimeout(() => setCopyToast(null), 2500);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400 gap-3">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm">載入訓練記錄中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      {/* 複製提示 Toast */}
      {copyToast && (
        <div className="bg-emerald-500 text-black px-4 py-2 rounded-xl text-xs font-black shadow-2xl flex items-center gap-2 animate-in fade-in duration-150">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{copyToast}</span>
        </div>
      )}

      {/* PWA 加入主畫面提示 Banner */}
      <PWAInstallBanner />

      {/* 頂部三項數據卡片 */}
      <section className="bg-gradient-to-br from-[#181b26] to-[#12141c] border border-[#262b3d] rounded-2xl p-4 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none"></div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wider">
              基本三項總和紀錄
            </h2>
          </div>
          <Link
            href="/analytics"
            className="text-xs bg-amber-500/20 text-amber-300 font-semibold px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-0.5 hover:bg-amber-500/30 transition-colors"
          >
            <span>PR 走勢</span>
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-[#090a0f]/60 p-2.5 rounded-xl border border-[#262b3d]/50">
            <span className="text-[11px] text-gray-400 block mb-0.5">臥推</span>
            <span className="text-lg font-black text-white">{bigThree?.bench_press_kg ?? 60}</span>
            <span className="text-[10px] text-emerald-400 block mt-0.5 font-medium">
              {bigThree?.bench_ratio ? `${bigThree.bench_ratio}x` : "1.0x"}
            </span>
          </div>
          <div className="bg-[#090a0f]/60 p-2.5 rounded-xl border border-[#262b3d]/50">
            <span className="text-[11px] text-gray-400 block mb-0.5">深蹲</span>
            <span className="text-lg font-black text-white">{bigThree?.squat_kg ?? 85}</span>
            <span className="text-[10px] text-emerald-400 block mt-0.5 font-medium">
              {bigThree?.squat_ratio ? `${bigThree.squat_ratio}x` : "1.41x"}
            </span>
          </div>
          <div className="bg-[#090a0f]/60 p-2.5 rounded-xl border border-[#262b3d]/50">
            <span className="text-[11px] text-gray-400 block mb-0.5">硬舉</span>
            <span className="text-lg font-black text-white">{bigThree?.deadlift_kg ?? 90}</span>
            <span className="text-[10px] text-emerald-400 block mt-0.5 font-medium">
              {bigThree?.deadlift_ratio ? `${bigThree.deadlift_ratio}x` : "1.5x"}
            </span>
          </div>
          <div className="bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/30">
            <span className="text-[11px] text-emerald-300 block mb-0.5">總和</span>
            <span className="text-lg font-black text-emerald-400">{bigThree?.total_kg ?? 235}</span>
            <span className="text-[10px] text-emerald-200/80 block mt-0.5 font-medium">Kg</span>
          </div>
        </div>
      </section>

      {/* 當月訓練分佈 */}
      <section className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-red-400" />
            <h2 className="text-sm font-bold text-gray-200">最新月份部位頻率</h2>
          </div>
          <span className="text-xs text-gray-400">
            總計 {Object.values(monthStats).reduce((a, b) => a + b, 0)} 次
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {Object.entries(monthStats).map(([part, count]) => (
            <div
              key={part}
              className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d]/60 text-center"
            >
              <div className="text-xs text-gray-400 mb-1">{part}</div>
              <div className="text-base font-bold text-gray-100">
                {count} <span className="text-[10px] font-normal text-gray-400">次</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 快速開始記錄按鈕與一鍵部位捷徑 */}
      <div className="space-y-2">
        <Link
          href="/workout/new"
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-3.5 px-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <Zap className="w-5 h-5 fill-black" />
          <span>開新訓練 (選場地 / 複製菜單)</span>
        </Link>

        <div className="grid grid-cols-4 gap-2">
          <Link
            href="/workout/new?muscle=胸部"
            className="p-2 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] hover:border-red-500/40 rounded-xl text-center text-xs font-bold text-gray-200 transition-all active:scale-95 flex flex-col items-center gap-0.5"
          >
            <span className="text-red-400 text-sm">🔥</span>
            <span>練胸日</span>
          </Link>
          <Link
            href="/workout/new?muscle=背部"
            className="p-2 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] hover:border-blue-500/40 rounded-xl text-center text-xs font-bold text-gray-200 transition-all active:scale-95 flex flex-col items-center gap-0.5"
          >
            <span className="text-blue-400 text-sm">⚡</span>
            <span>練背日</span>
          </Link>
          <Link
            href="/workout/new?muscle=腿部"
            className="p-2 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] hover:border-emerald-500/40 rounded-xl text-center text-xs font-bold text-gray-200 transition-all active:scale-95 flex flex-col items-center gap-0.5"
          >
            <span className="text-emerald-400 text-sm">🦵</span>
            <span>練腿日</span>
          </Link>
          <Link
            href="/workout/new?muscle=游泳"
            className="p-2 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] hover:border-cyan-500/40 rounded-xl text-center text-xs font-bold text-gray-200 transition-all active:scale-95 flex flex-col items-center gap-0.5"
          >
            <span className="text-cyan-400 text-sm">🏊</span>
            <span>游泳/有氧</span>
          </Link>
        </div>
      </div>

      {/* 最近訓練日誌流 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-gray-200">最近訓練紀錄</h2>
          </div>
          <Link
            href="/history"
            className="text-xs text-emerald-400 flex items-center gap-0.5 hover:underline"
          >
            查看全部
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="space-y-3">
          {recentSessions.map((session) => {
            const sets = sessionSetsMap[session.id] || [];
            const exerciseCount = new Set(sets.map((s) => s.exercise_id)).size;

            return (
              <div
                key={session.id}
                className="bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] hover:border-emerald-500/40 rounded-2xl p-4 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <Link
                    href={`/workout/${session.id}`}
                    className="font-bold text-gray-100 text-sm hover:text-emerald-400 transition-colors flex items-center gap-2"
                  >
                    <span>{session.display_title}</span>
                  </Link>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => handleCopyMarkdown(e, session)}
                      className="p-1.5 bg-[#181b26] hover:bg-emerald-950/40 text-gray-400 hover:text-emerald-400 rounded-lg border border-[#262b3d] transition-all text-xs"
                      title="一鍵複製 Markdown"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] bg-[#181b26] text-gray-400 px-2 py-0.5 rounded-md border border-[#262b3d]">
                      {session.date}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400 mb-2 flex-wrap">
                  <span className="text-emerald-400 font-medium">{session.target_muscle}</span>
                  <span>•</span>
                  <span>{exerciseCount} 個動作</span>
                  <span>•</span>
                  <span>{sets.length} 組</span>
                  {session.location && (
                    <>
                      <span>•</span>
                      <span className="text-blue-400 flex items-center gap-0.5">
                        <MapPin className="w-3 h-3" />
                        {session.location}
                      </span>
                    </>
                  )}
                </div>

                {/* 預覽第一至三組重點 */}
                <Link href={`/workout/${session.id}`} className="block space-y-1">
                  {sets.slice(0, 3).map((s, idx) => (
                    <div
                      key={s.id || idx}
                      className="text-xs text-gray-300 bg-[#090a0f]/60 px-2.5 py-1 rounded-lg flex items-center justify-between hover:bg-[#090a0f]"
                    >
                      <span className="truncate pr-2">
                        {s.raw_text || `${s.weight_kg}Kg x ${s.reps}`}
                      </span>
                      {s.is_failure && (
                        <span className="text-[10px] text-red-400 flex-shrink-0">力竭</span>
                      )}
                    </div>
                  ))}
                  {sets.length > 3 && (
                    <div className="text-[10px] text-gray-500 pl-1">
                      還有 +{sets.length - 3} 組...
                    </div>
                  )}
                </Link>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

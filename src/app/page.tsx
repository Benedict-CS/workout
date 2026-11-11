"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Dumbbell,
  ChevronRight,
  Plus,
  Calendar,
  MapPin,
  Copy,
  Check,
  Trophy,
} from "lucide-react";
import { db } from "@/lib/db/schema";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { formatSessionToMarkdown } from "@/lib/markdown-generator";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import type { WorkoutSession, SetItem, Exercise } from "@/lib/types";

interface MonthGroupData {
  monthKey: string;
  monthTitle: string;
  sessions: WorkoutSession[];
  stats: {
    胸: number;
    背: number;
    腿: number;
    游泳: number;
    total: number;
  };
  bigThreeMax: {
    bench: number;
    squat: number;
    deadlift: number;
    total: number;
  };
}

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [monthGroups, setMonthGroups] = useState<MonthGroupData[]>([]);
  const [allTimeStats, setAllTimeStats] = useState({
    胸: 0,
    背: 0,
    腿: 0,
    游泳: 0,
    total: 0,
  });
  const [sessionSetsMap, setSessionSetsMap] = useState<Record<string, SetItem[]>>({});
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // 目前週期課表計畫 (單數月 vs 雙數月)
  const now = new Date();
  const currentMonthNum = now.getMonth() + 1;
  const isCurrentOdd = currentMonthNum % 2 !== 0;
  const [planMonthView, setPlanMonthView] = useState<"odd" | "even">(isCurrentOdd ? "odd" : "even");
  const dayOfWeek = now.getDay(); // 0 是週日, 1-6 是週一至週六

  useEffect(() => {
    async function loadData() {
      try {
        await ensureDatabaseSeeded();

        const allEx = await db.exercises.toArray();
        setExercises(allEx);

        const allSessions = await db.sessions
          .filter((s) => !s.deleted_at)
          .reverse()
          .sortBy("date");

        const allSets = await db.sets
          .filter((s) => !s.deleted_at)
          .toArray();

        // 整理組數 Map
        const setsMap: Record<string, SetItem[]> = {};
        for (const s of allSets) {
          if (!setsMap[s.session_id]) setsMap[s.session_id] = [];
          setsMap[s.session_id].push(s);
        }
        setSessionSetsMap(setsMap);

        // 1. 計算全歷史累計次數 (胸、背、腿、游泳)
        const totalCounts = { 胸: 0, 背: 0, 腿: 0, 游泳: 0, total: allSessions.length };
        for (const sess of allSessions) {
          if (sess.target_muscle.includes("胸")) totalCounts["胸"]++;
          else if (sess.target_muscle.includes("背")) totalCounts["背"]++;
          else if (sess.target_muscle.includes("腿")) totalCounts["腿"]++;
          else if (sess.target_muscle.includes("泳")) totalCounts["游泳"]++;
        }
        setAllTimeStats(totalCounts);

        // 2. 依月份分組 (11月, 10月, 9月, 8月...)
        const monthMap = new Map<string, WorkoutSession[]>();
        for (const sess of allSessions) {
          if (!monthMap.has(sess.month_key)) {
            monthMap.set(sess.month_key, []);
          }
          monthMap.get(sess.month_key)!.push(sess);
        }

        const sortedMonthKeys = Array.from(monthMap.keys()).sort().reverse();
        const groups: MonthGroupData[] = [];

        // 辨認傳統三大項動作 ID (純槓鈴臥推、深蹲、硬舉)
        const benchExIds = allEx
          .filter((e) => e.id === "ex-bench-press" || (e.name.includes("臥推") && !e.name.includes("啞鈴") && !e.name.includes("機器") && !e.name.includes("上斜") && !e.name.includes("下斜") && !e.name.includes("史密斯")))
          .map((e) => e.id);
        const squatExIds = allEx
          .filter((e) => e.id === "ex-squat" || (e.name.includes("深蹲") && !e.name.includes("分腿") && !e.name.includes("哈克")))
          .map((e) => e.id);
        const deadliftExIds = allEx
          .filter((e) => e.id === "ex-deadlift" || (e.name.includes("硬舉") && !e.name.includes("六角")))
          .map((e) => e.id);

        for (const mk of sortedMonthKeys) {
          const sessList = monthMap.get(mk) || [];
          const mStats = { 胸: 0, 背: 0, 腿: 0, 游泳: 0, total: sessList.length };

          // 計算該月部位頻率
          for (const s of sessList) {
            if (s.target_muscle.includes("胸")) mStats["胸"]++;
            else if (s.target_muscle.includes("背")) mStats["背"]++;
            else if (s.target_muscle.includes("腿")) mStats["腿"]++;
            else if (s.target_muscle.includes("泳")) mStats["游泳"]++;
          }

          // 計算該月三項實測最高重量
          let maxBench = 0;
          let maxSquat = 0;
          let maxDeadlift = 0;

          const sessIds = new Set(sessList.map((s) => s.id));
          const monthSets = allSets.filter((st) => sessIds.has(st.session_id) && st.weight_kg > 0);

          for (const st of monthSets) {
            if (benchExIds.includes(st.exercise_id) && st.weight_kg > maxBench) {
              maxBench = st.weight_kg;
            }
            if (squatExIds.includes(st.exercise_id) && st.weight_kg > maxSquat) {
              maxSquat = st.weight_kg;
            }
            if (deadliftExIds.includes(st.exercise_id) && st.weight_kg > maxDeadlift) {
              maxDeadlift = st.weight_kg;
            }
          }

          const parts = mk.split("-");
          const monthTitle = `${parts[0]} 年 ${parseInt(parts[1], 10)} 月`;

          groups.push({
            monthKey: mk,
            monthTitle,
            sessions: sessList,
            stats: mStats,
            bigThreeMax: {
              bench: maxBench,
              squat: maxSquat,
              deadlift: maxDeadlift,
              total: maxBench + maxSquat + maxDeadlift,
            },
          });
        }

        setMonthGroups(groups);
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
    setTimeout(() => setCopyToast(null), 2000);
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
    <div className="space-y-5 pb-24">
      {/* 複製提示 Toast */}
      {copyToast && (
        <div className="bg-emerald-500 text-black px-4 py-2 rounded-xl text-xs font-black shadow-2xl flex items-center gap-2 animate-in fade-in duration-150">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{copyToast}</span>
        </div>
      )}

      {/* PWA 加入主畫面提示 Banner */}
      <PWAInstallBanner />

      {/* 頂部：歷史累計總次數 (從有紀錄到現在總量) */}
      <section className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-black text-white">累計訓練總次數</h2>
          </div>
          <span className="text-xs text-emerald-400 font-bold">
            總共 {allTimeStats.total} 場訓練
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d]/70">
            <span className="text-[11px] text-gray-400 block mb-0.5">練胸</span>
            <span className="text-lg font-black text-white">{allTimeStats["胸"]}</span>
            <span className="text-[10px] text-gray-500 block">次</span>
          </div>
          <div className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d]/70">
            <span className="text-[11px] text-gray-400 block mb-0.5">練背</span>
            <span className="text-lg font-black text-white">{allTimeStats["背"]}</span>
            <span className="text-[10px] text-gray-500 block">次</span>
          </div>
          <div className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d]/70">
            <span className="text-[11px] text-gray-400 block mb-0.5">練腿</span>
            <span className="text-lg font-black text-white">{allTimeStats["腿"]}</span>
            <span className="text-[10px] text-gray-500 block">次</span>
          </div>
          <div className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d]/70">
            <span className="text-[11px] text-gray-400 block mb-0.5">游泳</span>
            <span className="text-lg font-black text-white">{allTimeStats["游泳"]}</span>
            <span className="text-[10px] text-gray-500 block">次</span>
          </div>
        </div>
      </section>

      {/* 快捷開新訓練按鈕：點進去鎖定該項目 (胸、背、腿、游泳) */}
      <div className="grid grid-cols-4 gap-2">
        <Link
          href="/workout/new?muscle=胸"
          className="p-3 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] hover:border-red-500/50 rounded-2xl text-center transition-all active:scale-95 flex flex-col items-center gap-1 shadow-sm"
        >
          <span className="text-lg">🔥</span>
          <span className="text-xs font-black text-white">練胸</span>
        </Link>
        <Link
          href="/workout/new?muscle=背"
          className="p-3 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] hover:border-blue-500/50 rounded-2xl text-center transition-all active:scale-95 flex flex-col items-center gap-1 shadow-sm"
        >
          <span className="text-lg">⚡</span>
          <span className="text-xs font-black text-white">練背</span>
        </Link>
        <Link
          href="/workout/new?muscle=腿"
          className="p-3 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] hover:border-emerald-500/50 rounded-2xl text-center transition-all active:scale-95 flex flex-col items-center gap-1 shadow-sm"
        >
          <span className="text-lg">🦵</span>
          <span className="text-xs font-black text-white">練腿</span>
        </Link>
        <Link
          href="/workout/new?muscle=游泳"
          className="p-3 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] hover:border-cyan-500/50 rounded-2xl text-center transition-all active:scale-95 flex flex-col items-center gap-1 shadow-sm"
        >
          <span className="text-lg">🏊</span>
          <span className="text-xs font-black text-white">游泳</span>
        </Link>
      </div>

      {/* 目前週期課表計畫 (單數月 vs 雙數月，自動高亮今日) */}
      <section className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-3.5 shadow-md space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">📅</span>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-black text-white">目前週期課表</h3>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/40 font-bold">
                {planMonthView === "odd" ? "單數月課表" : "雙數月課表"}
              </span>
            </div>
          </div>
          <button
            onClick={() => setPlanMonthView(planMonthView === "odd" ? "even" : "odd")}
            className="text-[10px] text-gray-400 hover:text-emerald-400 border border-[#262b3d] px-2 py-0.5 rounded-lg transition-colors"
          >
            切換至{planMonthView === "odd" ? "雙數月" : "單數月"}
          </button>
        </div>

        {/* 7 天網格 */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {[
            { dayName: "一", dIdx: 1, target: planMonthView === "odd" ? "胸" : "背", muscle: planMonthView === "odd" ? "胸" : "背" },
            { dayName: "二", dIdx: 2, target: planMonthView === "odd" ? "背" : "胸", muscle: planMonthView === "odd" ? "背" : "胸" },
            { dayName: "三", dIdx: 3, target: "肩+臂", muscle: planMonthView === "odd" ? "胸" : "背" },
            { dayName: "四", dIdx: 4, target: planMonthView === "odd" ? "胸(彈)" : "背(彈)", muscle: planMonthView === "odd" ? "胸" : "背" },
            { dayName: "五", dIdx: 5, target: "休", isRest: true },
            { dayName: "六", dIdx: 6, target: "腿", muscle: "腿" },
            { dayName: "日", dIdx: 0, target: "游泳", muscle: "游泳" },
          ].map((item) => {
            const isToday = dayOfWeek === item.dIdx;

            if (item.isRest) {
              return (
                <div
                  key={item.dayName}
                  className={`py-1.5 px-0.5 rounded-xl border text-[10px] flex flex-col justify-between h-14 ${
                    isToday
                      ? "bg-amber-500/10 border-amber-500/50 text-amber-300 ring-1 ring-amber-500/50"
                      : "bg-[#090a0f]/60 border-[#262b3d]/60 text-gray-500"
                  }`}
                >
                  <span className={`font-bold ${isToday ? "text-amber-400" : "text-gray-500"}`}>
                    週{item.dayName}
                  </span>
                  <span className="font-medium text-[11px]">休</span>
                </div>
              );
            }

            return (
              <Link
                key={item.dayName}
                href={`/workout/new?muscle=${item.muscle}`}
                className={`py-1.5 px-0.5 rounded-xl border text-[10px] flex flex-col justify-between h-14 transition-all active:scale-95 ${
                  isToday
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/40"
                    : "bg-[#181b26] border-[#262b3d] text-gray-300 hover:border-emerald-500/40"
                }`}
              >
                <span className={`font-bold ${isToday ? "text-emerald-400" : "text-gray-400"}`}>
                  週{item.dayName}
                </span>
                <span className="font-black text-[11px] truncate">
                  {item.target}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 每月分組清單 (10月、9月、8月... 如同記帳本，一開始不展開，點進去才看詳情) */}
      <div className="space-y-6 pt-2">
        {monthGroups.map((group) => (
          <section
            key={group.monthKey}
            className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-3.5 shadow-md"
          >
            {/* 月份標題 */}
            <div className="flex items-center justify-between border-b border-[#262b3d]/60 pb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <h3 className="text-base font-black text-white">{group.monthTitle}</h3>
              </div>
              <span className="text-xs text-emerald-400 font-bold">
                共 {group.stats.total} 場
              </span>
            </div>

            {/* 該月統計：部位頻率 + 該月 3 項最高重量 (直觀看每個月力量有沒有進步！) */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* 部位頻率 */}
              <div className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d]/70 space-y-1">
                <span className="text-[10px] text-gray-400 font-bold block mb-1">
                  該月訓練部位頻率
                </span>
                <div className="grid grid-cols-4 gap-1 text-center">
                  <div>
                    <span className="text-[10px] text-gray-400 block">胸</span>
                    <span className="font-black text-white">{group.stats["胸"]}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">背</span>
                    <span className="font-black text-white">{group.stats["背"]}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">腿</span>
                    <span className="font-black text-white">{group.stats["腿"]}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">游</span>
                    <span className="font-black text-white">{group.stats["游泳"]}</span>
                  </div>
                </div>
              </div>

              {/* 該月 3 項最高重量 */}
              <div className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d]/70 space-y-1">
                <span className="text-[10px] text-emerald-400 font-bold block mb-1">
                  該月 3 項最高實測
                </span>
                <div className="grid grid-cols-3 gap-1 text-center">
                  <div>
                    <span className="text-[10px] text-gray-400 block">臥推</span>
                    <span className="font-black text-white">
                      {group.bigThreeMax.bench > 0 ? `${group.bigThreeMax.bench}k` : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">深蹲</span>
                    <span className="font-black text-white">
                      {group.bigThreeMax.squat > 0 ? `${group.bigThreeMax.squat}k` : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">硬舉</span>
                    <span className="font-black text-white">
                      {group.bigThreeMax.deadlift > 0 ? `${group.bigThreeMax.deadlift}k` : "-"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 該月份日誌清單 (一開始不要展開，純單行條目，點進去才看詳情) */}
            <div className="space-y-1.5 pt-1">
              {group.sessions.map((sess) => {
                const sessSets = sessionSetsMap[sess.id] || [];

                let badgeColor = "bg-red-500/20 text-red-300 border-red-500/40";
                if (sess.target_muscle.includes("背")) {
                  badgeColor = "bg-blue-500/20 text-blue-300 border-blue-500/40";
                } else if (sess.target_muscle.includes("腿")) {
                  badgeColor = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
                } else if (sess.target_muscle.includes("泳")) {
                  badgeColor = "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
                }

                return (
                  <Link
                    key={sess.id}
                    href={`/workout/${sess.id}`}
                    className="bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] hover:border-emerald-500/40 rounded-xl px-3 py-2.5 flex items-center justify-between text-xs transition-all active:scale-[0.99] group block"
                  >
                    <div className="flex items-center gap-2.5 truncate pr-2">
                      <span className={`px-2 py-0.5 rounded font-black text-[11px] border shrink-0 ${badgeColor}`}>
                        {sess.target_muscle}
                      </span>

                      <div className="truncate">
                        <span className="font-bold text-gray-100 group-hover:text-emerald-400 transition-colors">
                          {sess.display_title}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {sess.location && (
                        <span className="text-[10px] text-gray-400 hidden sm:inline-block">
                          {sess.location}
                        </span>
                      )}

                      <span className="text-[11px] bg-[#090a0f] text-gray-400 px-2 py-0.5 rounded border border-[#262b3d]">
                        {sessSets.length} 組
                      </span>

                      <button
                        type="button"
                        onClick={(e) => handleCopyMarkdown(e, sess)}
                        className="p-1 text-gray-500 hover:text-emerald-400 rounded transition-colors"
                        title="複製 Markdown"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-emerald-400 transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Calendar,
  Copy,
  Check,
  Pencil,
  FileText,
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
  const [sessionSetsMap, setSessionSetsMap] = useState<Record<string, SetItem[]>>({});
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // 展開的訓練場次 ID 集合 (點擊 title 展開/收合，不跳轉新頁面)
  const [expandedSessionIds, setExpandedSessionIds] = useState<Set<string>>(new Set());

  // 單月分頁檢視 (左右切換如月曆，可手勢滑動或點擊月份標籤)
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const currentGroup = monthGroups[selectedMonthIndex] || monthGroups[0];

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX);
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchEndX - touchStartX;
    // 右滑：看上個月 (較舊月)
    if (diff > 50 && selectedMonthIndex < monthGroups.length - 1) {
      setSelectedMonthIndex((prev) => prev + 1);
    }
    // 左滑：看下個月 (較新月)
    else if (diff < -50 && selectedMonthIndex > 0) {
      setSelectedMonthIndex((prev) => prev - 1);
    }
    setTouchStartX(null);
  }

  // 單場點擊切換展開/收合
  function toggleExpand(sessionId: string) {
    setExpandedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }

  // 當前月全部展開 / 全部收合
  function toggleExpandAll(sessions: WorkoutSession[]) {
    const allExpanded = sessions.every((s) => expandedSessionIds.has(s.id));
    if (allExpanded) {
      setExpandedSessionIds(new Set());
    } else {
      setExpandedSessionIds(new Set(sessions.map((s) => s.id)));
    }
  }

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

        // 依月份分組 (11月, 10月, 9月, 8月...)
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

  const allCurrentExpanded = currentGroup
    ? currentGroup.sessions.every((s) => expandedSessionIds.has(s.id))
    : false;

  return (
    <div className="space-y-4 pb-24">
      {/* 複製提示 Toast */}
      {copyToast && (
        <div className="bg-emerald-500 text-black px-4 py-2 rounded-xl text-xs font-black shadow-2xl flex items-center gap-2 animate-in fade-in duration-150">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{copyToast}</span>
        </div>
      )}

      {/* PWA 加入主畫面提示 Banner */}
      <PWAInstallBanner />

      {/* 月份分頁導航列 (一個月一頁，左右切換如同日曆，亦可直接點選月份 Tab 或手勢左右滑動) */}
      <div className="space-y-2.5">
        {/* 月曆切換頂 Bar */}
        <div className="flex items-center justify-between bg-[#12141c] border border-[#262b3d] rounded-2xl p-2.5 shadow-md">
          <button
            type="button"
            disabled={selectedMonthIndex >= monthGroups.length - 1}
            onClick={() => setSelectedMonthIndex((prev) => Math.min(monthGroups.length - 1, prev + 1))}
            className="p-2 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-300 disabled:opacity-30 disabled:pointer-events-none rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
            title="查看上個月 (更早歷史)"
          >
            <ChevronLeft className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">上個月</span>
          </button>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-black text-white">
                {currentGroup?.monthTitle || "訓練月份"}
              </span>
            </div>
            <span className="text-[11px] text-gray-400">
              當月共 {currentGroup?.stats.total || 0} 場訓練 • 可左右滑動切換
            </span>
          </div>

          <button
            type="button"
            disabled={selectedMonthIndex <= 0}
            onClick={() => setSelectedMonthIndex((prev) => Math.max(0, prev - 1))}
            className="p-2 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-300 disabled:opacity-30 disabled:pointer-events-none rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
            title="查看下個月 (較新記錄)"
          >
            <span className="hidden sm:inline">下個月</span>
            <ChevronRight className="w-4 h-4 text-emerald-400" />
          </button>
        </div>

        {/* 橫向快速月份膠囊選擇列 (11月, 10月, 9月, 8月, 7月, 6月) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {monthGroups.map((g, idx) => {
            const isSelected = selectedMonthIndex === idx;
            const parts = g.monthKey.split("-");
            const mNum = parseInt(parts[1], 10);
            return (
              <button
                key={g.monthKey}
                onClick={() => setSelectedMonthIndex(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all border flex items-center gap-1 ${
                  isSelected
                    ? "bg-emerald-500 text-black border-emerald-400 shadow-md font-black"
                    : "bg-[#12141c] text-gray-400 border-[#262b3d] hover:text-white"
                }`}
              >
                <span>{mNum} 月</span>
                <span className={`text-[10px] ${isSelected ? "text-black/80 font-bold" : "opacity-75"}`}>
                  ({g.stats.total})
                </span>
              </button>
            );
          })}
        </div>

        {/* 當前月份的獨立卡片 (支援手機觸控向左/向右滑動換月) */}
        {currentGroup && (
          <section
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-3.5 shadow-md transition-all"
          >
            {/* 該月統計：部位頻率 + 該月 3 項最高重量 (直觀看每個月力量進步) */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* 部位頻率 */}
              <div className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d]/70 space-y-1">
                <span className="text-[10px] text-gray-400 font-bold block mb-1">
                  該月訓練部位頻率
                </span>
                <div className="grid grid-cols-4 gap-1 text-center">
                  <div>
                    <span className="text-[10px] text-gray-400 block">胸</span>
                    <span className="font-black text-white">{currentGroup.stats["胸"]}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">背</span>
                    <span className="font-black text-white">{currentGroup.stats["背"]}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">腿</span>
                    <span className="font-black text-white">{currentGroup.stats["腿"]}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">游</span>
                    <span className="font-black text-white">{currentGroup.stats["游泳"]}</span>
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
                      {currentGroup.bigThreeMax.bench > 0 ? `${currentGroup.bigThreeMax.bench}k` : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">深蹲</span>
                    <span className="font-black text-white">
                      {currentGroup.bigThreeMax.squat > 0 ? `${currentGroup.bigThreeMax.squat}k` : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">硬舉</span>
                    <span className="font-black text-white">
                      {currentGroup.bigThreeMax.deadlift > 0 ? `${currentGroup.bigThreeMax.deadlift}k` : "-"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 該月份日誌清單 (點擊 title 直接展開詳情，不跳轉新頁面) */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-gray-400">
                  訓練日誌清單 ({currentGroup.sessions.length} 場)
                </span>
                <button
                  type="button"
                  onClick={() => toggleExpandAll(currentGroup.sessions)}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  {allCurrentExpanded ? "全部收合" : "全部展開"}
                </button>
              </div>

              {currentGroup.sessions.map((sess) => {
                const sessSets = sessionSetsMap[sess.id] || [];
                const isExpanded = expandedSessionIds.has(sess.id);

                let badgeColor = "bg-red-500/20 text-red-300 border-red-500/40";
                if (sess.target_muscle.includes("背")) {
                  badgeColor = "bg-blue-500/20 text-blue-300 border-blue-500/40";
                } else if (sess.target_muscle.includes("腿")) {
                  badgeColor = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
                } else if (sess.target_muscle.includes("泳")) {
                  badgeColor = "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
                }

                // 依動作群組分類組數
                const exMap = new Map<string, SetItem[]>();
                const exOrder: string[] = [];
                for (const st of sessSets) {
                  if (!exMap.has(st.exercise_id)) {
                    exMap.set(st.exercise_id, []);
                    exOrder.push(st.exercise_id);
                  }
                  exMap.get(st.exercise_id)!.push(st);
                }

                return (
                  <div
                    key={sess.id}
                    className="bg-[#181b26] border border-[#262b3d] hover:border-[#384059] rounded-xl overflow-hidden transition-all shadow-sm"
                  >
                    {/* 標題欄：點一下就展開/收合，完全不跳轉其他頁面 */}
                    <div
                      onClick={() => toggleExpand(sess.id)}
                      className="px-3 py-2.5 flex items-center justify-between text-xs cursor-pointer select-none active:bg-[#202533]"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className={`px-2 py-0.5 rounded font-black text-[11px] border shrink-0 ${badgeColor}`}>
                          {sess.target_muscle}
                        </span>

                        <span className="font-bold text-gray-100 hover:text-emerald-400 transition-colors truncate">
                          {sess.display_title}
                        </span>
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

                        <ChevronDown
                          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                            isExpanded ? "rotate-180 text-emerald-400" : ""
                          }`}
                        />
                      </div>
                    </div>

                    {/* 展開詳情區：直接在原地顯示各動作與組數 */}
                    {isExpanded && (
                      <div className="px-4 py-3 bg-[#0f1118] border-t border-[#262b3d]/60 space-y-3 animate-in fade-in duration-150">
                        {exOrder.length === 0 ? (
                          <div className="text-gray-500 text-xs py-2">
                            尚無詳細組數紀錄
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {exOrder.map((exId) => {
                              const ex = exercises.find((e) => e.id === exId);
                              const exSets = exMap.get(exId) || [];
                              const exName = ex ? ex.name : "訓練項目";

                              return (
                                <div key={exId} className="space-y-1">
                                  <div className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                                    <span>•</span>
                                    <span>{exName}：</span>
                                  </div>
                                  <div className="pl-4 space-y-0.5">
                                    {exSets.map((st, sIdx) => {
                                      const text =
                                        st.raw_text ||
                                        (st.weight_kg > 0
                                          ? `set ${st.set_order}: ${st.weight_kg}Kg x${st.reps}`
                                          : `set ${st.set_order}: x${st.reps}`);

                                      return (
                                        <div
                                          key={st.id || sIdx}
                                          className="text-[11px] text-gray-300 font-mono tracking-tight"
                                        >
                                          - {text}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* 底部操作工具列 */}
                        <div className="flex items-center justify-between pt-2 border-t border-[#262b3d]/40 text-xs mt-2">
                          <button
                            type="button"
                            onClick={(e) => handleCopyMarkdown(e, sess)}
                            className="flex items-center gap-1.5 text-gray-400 hover:text-emerald-400 py-1 px-2.5 rounded-lg bg-[#181b26] border border-[#262b3d] transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>複製 Markdown</span>
                          </button>

                          <Link
                            href={`/workout/${sess.id}`}
                            className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 py-1 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 font-bold transition-all active:scale-95"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>進入記錄 / 修改組數</span>
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Calendar,
  Copy,
  Check,
  Pencil,
  Trash2,
  Play,
  Plus,
  MessageSquare,
} from "lucide-react";
import { db } from "@/lib/db/schema";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { formatSessionToMarkdown, formatSessionToPlainText } from "@/lib/markdown-generator";
import { deleteRemoteSession, runFullSync } from "@/lib/db/sync";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { getPrimaryMuscle, getMuscleBadgeColor, cleanSessionTitle, computeMonthlyIndices } from "@/lib/workout-utils";
import type { WorkoutSession, SetItem, Exercise } from "@/lib/types";

interface MonthGroupData {
  monthKey: string;
  monthTitle: string;
  sessions: WorkoutSession[];
  stats: {
    胸: number;
    背: number;
    腿: number;
    肩?: number;
    手臂?: number;
    核心?: number;
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

  // 當前正在進行中的訓練 (若有，置頂醒目顯示防止鎖屏跳出後找不到)
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);

  // 展開的訓練場次 ID 集合 (點擊 title 展開/收合，不跳轉新頁面)
  const [expandedSessionIds, setExpandedSessionIds] = useState<Set<string>>(new Set());

  // 單月分頁檢視 (順序排列：6月 -> 11月，鎖定僅透過按鈕左右切換或點選切換，絕不允許手勢滑動誤觸)
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(-1);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [selectedMuscleFilter, setSelectedMuscleFilter] = useState<string>("all");
  const hasInitializedMonthRef = useRef(false);
  const selectedMonthKeyRef = useRef<string | null>(null);
  const currentGroup = (selectedMonthIndex >= 0 && selectedMonthIndex < monthGroups.length)
    ? monthGroups[selectedMonthIndex]
    : monthGroups[monthGroups.length - 1];

  // 動態依日期精確計算當前月份所有重訓場次的「第 X 次」序號，防止補登、跳天記錄導致重複或錯誤
  const monthlyIndicesMap = computeMonthlyIndices(currentGroup?.sessions || []);

  // 鍵盤 ← / → 鍵左右切換月份 (防在輸入框中誤觸)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedMonthIndex((prev) => {
          const next = Math.max(0, prev - 1);
          selectedMonthKeyRef.current = monthGroups[next]?.monthKey || null;
          return next;
        });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedMonthIndex((prev) => {
          const next = Math.min(monthGroups.length > 0 ? monthGroups.length - 1 : 0, prev + 1);
          selectedMonthKeyRef.current = monthGroups[next]?.monthKey || null;
          return next;
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [monthGroups]);

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

  const loadData = useCallback(async () => {
    try {
      await ensureDatabaseSeeded();

      const allEx = await db.exercises.toArray();
      setExercises(allEx);

      const allSessions = await db.sessions
        .filter((s) => !s.deleted_at)
        .sortBy("date");

      // 檢查是否有進行中的訓練場次
      const inProgress = allSessions.slice().reverse().find((s) => s.status === "in_progress");
      setActiveSession(inProgress || null);

      const allSets = await db.sets
        .filter((s) => !s.deleted_at)
        .toArray();

      // 整理組數 Map，並依 set_order 嚴格排序
      const setsMap: Record<string, SetItem[]> = {};
      for (const s of allSets) {
        if (!setsMap[s.session_id]) setsMap[s.session_id] = [];
        setsMap[s.session_id].push(s);
      }
      for (const sid in setsMap) {
        setsMap[sid].sort((a, b) => a.set_order - b.set_order);
      }
      setSessionSetsMap(setsMap);

      // 依月份分組
      const monthMap = new Map<string, WorkoutSession[]>();
      for (const sess of allSessions) {
        if (!monthMap.has(sess.month_key)) {
          monthMap.set(sess.month_key, []);
        }
        monthMap.get(sess.month_key)!.push(sess);
      }

      // 確保當前月份必然存在於選單與分頁中
      const currentMonthKey = new Date().toISOString().slice(0, 7);
      if (!monthMap.has(currentMonthKey)) {
        monthMap.set(currentMonthKey, []);
      }

      // 順序排列：6月 -> 7月 -> 8月 -> 9月 -> 10月 -> 11月
      const sortedMonthKeys = Array.from(monthMap.keys()).sort();
      const groups: MonthGroupData[] = [];

      // 辨認傳統三大項動作 ID (純槓鈴臥推、深蹲、硬舉)
      const benchExIds = allEx
        .filter((e) => e.id === "ex-bench" || e.id === "ex-bench-press" || (e.name && e.name.includes("臥推") && !e.name.includes("啞鈴") && !e.name.includes("機器") && !e.name.includes("上斜") && !e.name.includes("下斜") && !e.name.includes("史密斯")))
        .map((e) => e.id);
      const squatExIds = allEx
        .filter((e) => e.id === "ex-squat" || (e.name && e.name.includes("深蹲") && !e.name.includes("分腿") && !e.name.includes("哈克")))
        .map((e) => e.id);
      const deadliftExIds = allEx
        .filter((e) => e.id === "ex-deadlift" || (e.name && e.name.includes("硬舉") && !e.name.includes("六角")))
        .map((e) => e.id);

      for (const mk of sortedMonthKeys) {
        const rawSessList = monthMap.get(mk) || [];
        // 該月內訓練按日期由先至後順序排列
        const sessList = [...rawSessList].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
        const mStats = { 胸: 0, 背: 0, 腿: 0, 肩: 0, 手臂: 0, 核心: 0, 游泳: 0, total: sessList.length };

        // 計算該月部位頻率
        for (const s of sessList) {
          const muscle = s?.target_muscle || "";
          if (muscle.includes("胸")) mStats["胸"]++;
          else if (muscle.includes("背")) mStats["背"]++;
          else if (muscle.includes("腿")) mStats["腿"]++;
          else if (muscle.includes("肩")) mStats["肩"]++;
          else if (muscle.includes("臂") || muscle.includes("二頭") || muscle.includes("三頭")) mStats["手臂"]++;
          else if (muscle.includes("核") || muscle.includes("腹")) mStats["核心"]++;
          else if (muscle.includes("泳")) mStats["游泳"]++;
        }

        // 計算該月三項實測最高重量
        let maxBench = 0;
        let maxSquat = 0;
        let maxDeadlift = 0;

        const sessIds = new Set(sessList.map((s) => s.id));
        const monthSets = allSets.filter(
          (st) => sessIds.has(st.session_id) && st.weight_kg > 0 && st.is_completed !== false
        );

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

      let targetIdx = groups.length - 1;
      if (!hasInitializedMonthRef.current && groups.length > 0) {
        hasInitializedMonthRef.current = true;
        targetIdx = groups.length - 1;
        selectedMonthKeyRef.current = groups[targetIdx]?.monthKey || null;
      } else if (selectedMonthKeyRef.current && groups.length > 0) {
        const foundIdx = groups.findIndex((g) => g.monthKey === selectedMonthKeyRef.current);
        targetIdx = foundIdx !== -1 ? foundIdx : Math.max(0, groups.length - 1);
      }
      setSelectedMonthIndex(targetIdx);
      setMonthGroups(groups);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const handleDataChanged = () => {
      loadData();
    };
    window.addEventListener("workout:data_changed", handleDataChanged);
    return () => {
      window.removeEventListener("workout:data_changed", handleDataChanged);
    };
  }, [loadData]);

  // 首頁直接刪除訓練場次
  async function handleDeleteSession(e: React.MouseEvent, sess: WorkoutSession) {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`確定要刪除這場訓練【${sess.display_title}】嗎？\n此操作將同時刪除該場次的所有組數記錄。`)) {
      return;
    }

    try {
      await db.transaction("rw", [db.sessions, db.sets], async () => {
        await db.sets.where("session_id").equals(sess.id).delete();
        await db.sessions.delete(sess.id);
      });

      deleteRemoteSession(sess.id).catch(() => {});
      runFullSync().catch(() => {});

      setCopyToast(`已刪除【${sess.display_title}】！`);
      setTimeout(() => setCopyToast(null), 2500);

      await loadData();
    } catch (err) {
      console.error("Failed to delete session:", err);
      alert("刪除失敗，請再試一次。");
    }
  }

  function handleCopyMarkdown(e: React.MouseEvent, session: WorkoutSession) {
    e.preventDefault();
    e.stopPropagation();
    const sets = sessionSetsMap[session.id] || [];
    const computedIdx = monthlyIndicesMap.get(session.id) || session.monthly_index;
    const sessionWithComputedTitle: WorkoutSession = {
      ...session,
      display_title: cleanSessionTitle(session.display_title, session.target_muscle, computedIdx),
      monthly_index: computedIdx,
    };
    const md = formatSessionToMarkdown(sessionWithComputedTitle, sets, exercises);
    navigator.clipboard.writeText(md);
    setCopyToast(`已複製【${cleanSessionTitle(session.display_title, session.target_muscle, computedIdx)}】完整 Markdown！`);
    setTimeout(() => setCopyToast(null), 2000);
  }

  function handleCopyPlainText(e: React.MouseEvent, session: WorkoutSession) {
    e.preventDefault();
    e.stopPropagation();
    const sets = sessionSetsMap[session.id] || [];
    const computedIdx = monthlyIndicesMap.get(session.id) || session.monthly_index;
    const sessionWithComputedTitle: WorkoutSession = {
      ...session,
      display_title: cleanSessionTitle(session.display_title, session.target_muscle, computedIdx),
      monthly_index: computedIdx,
    };
    const text = formatSessionToPlainText(sessionWithComputedTitle, sets, exercises);
    navigator.clipboard.writeText(text);
    setCopyToast(`已複製【${cleanSessionTitle(session.display_title, session.target_muscle, computedIdx)}】簡潔純文字！`);
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

      {/* ⚡ 正在進行中的訓練置頂橫幅 (防止手機鎖屏或切換頁面後迷路找不到訓練) */}
      {activeSession && (
        <div className="bg-gradient-to-r from-emerald-950/80 via-[#13221b] to-emerald-950/80 border-2 border-emerald-500 rounded-2xl p-4 shadow-2xl shadow-emerald-500/20 animate-in slide-in-from-top-2 duration-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                正在進行中的訓練
              </span>
            </div>
            <span className="text-[10px] bg-emerald-500 text-black px-2 py-0.5 rounded-md font-black tracking-wider">
              LIVE 進行中
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="font-black text-white text-base truncate">
                {cleanSessionTitle(activeSession.display_title, activeSession.target_muscle)}
              </h3>
              {(() => {
                const sessSets = sessionSetsMap[activeSession.id] || [];
                const isWarmup = (st: SetItem) => {
                  if (st.set_type === "warmup") return true;
                  const r = st.raw_text || "";
                  const n = st.notes || "";
                  return r.includes("熱身") || r.includes("激發") || r.includes("試重") || n.includes("熱身");
                };
                const formalSets = sessSets.filter((st) => !isWarmup(st));
                const completedFormal = formalSets.filter((s) => s.is_completed !== false).length;
                const warmupCount = sessSets.length - formalSets.length;
                return (
                  <p className="text-xs text-gray-400 mt-0.5">
                    已做 {completedFormal} / {formalSets.length} 組正式組
                    {warmupCount > 0 && <span className="text-gray-500 ml-1">(+{warmupCount} 組熱身)</span>} • 點擊立即恢復現場記錄
                  </p>
                );
              })()}
            </div>

            <Link
              href={`/workout/${activeSession.id}`}
              className="bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-black stroke-none" />
              <span>繼續訓練 ➔</span>
            </Link>
          </div>
        </div>
      )}

      {/* 月份分頁導航列 (順序排列，支援鍵盤左右鍵 ← → 與點選切換) */}
      <div className="space-y-2.5">
        {/* 月曆切換頂 Bar */}
        <div className="flex items-center justify-between bg-[#12141c] border border-[#262b3d] rounded-2xl p-2.5 shadow-md">
          <button
            type="button"
            disabled={selectedMonthIndex <= 0}
            onClick={() => {
              const next = Math.max(0, selectedMonthIndex - 1);
              setSelectedMonthIndex(next);
              selectedMonthKeyRef.current = monthGroups[next]?.monthKey || null;
            }}
            className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-200 hover:text-white disabled:opacity-30 disabled:pointer-events-none rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer shrink-0 shadow-sm"
            title="查看上個月 (可按鍵盤 ← 鍵)"
          >
            <ChevronLeft className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="shrink-0">上個月</span>
          </button>

          <div className="relative flex flex-col items-center">
            <button
              type="button"
              onClick={() => setShowMonthDropdown(!showMonthDropdown)}
              className="flex items-center gap-1.5 py-1 px-2.5 rounded-xl hover:bg-[#181b26] transition-colors cursor-pointer"
              title="點擊切換月份"
            >
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span className="text-base font-black text-white">
                {currentGroup?.monthTitle || "訓練月份"}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {/* 快速切換月份下拉選單 (點選即跳轉，鎖定操作) */}
            {showMonthDropdown && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-40 bg-[#181b26] border border-[#262b3d] rounded-2xl p-2 shadow-2xl min-w-[170px] space-y-1">
                {monthGroups.map((mg, idx) => {
                  const isCur = idx === selectedMonthIndex;
                  return (
                    <button
                      key={mg.monthKey}
                      type="button"
                      onClick={() => {
                        setSelectedMonthIndex(idx);
                        selectedMonthKeyRef.current = mg.monthKey;
                        setShowMonthDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                        isCur
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "text-gray-300 hover:bg-[#202533]"
                      }`}
                    >
                      <span>{mg.monthTitle}</span>
                      <span className="text-[10px] text-gray-400 font-normal">
                        {mg.stats.total} 場
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <span className="text-xs text-gray-400 mt-0.5">
              當月共 {currentGroup?.stats.total || 0} 場訓練 <span className="hidden sm:inline">• 可按左右鍵切換</span>
            </span>
          </div>

          <button
            type="button"
            disabled={selectedMonthIndex >= monthGroups.length - 1}
            onClick={() => {
              const next = Math.min(monthGroups.length - 1, selectedMonthIndex + 1);
              setSelectedMonthIndex(next);
              selectedMonthKeyRef.current = monthGroups[next]?.monthKey || null;
            }}
            className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-200 hover:text-white disabled:opacity-30 disabled:pointer-events-none rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer shrink-0 shadow-sm"
            title="查看下個月 (可按鍵盤 → 鍵)"
          >
            <span className="shrink-0">下個月</span>
            <ChevronRight className="w-4 h-4 text-emerald-400 shrink-0" />
          </button>
        </div>

        {/* 當前月份的獨立卡片 (完全鎖定，僅能透過按鈕與下拉選單切換，徹底杜絕手機滑動誤跳) */}
        {currentGroup && (
          <section
            className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-3.5 sm:p-4 space-y-3.5 shadow-md transition-all"
          >
            {/* 該月統計：部位頻率 + 該月 3 項最高重量 (直觀看每個月力量進步) */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              {/* 部位頻率 */}
              <div className="bg-[#181b26] p-2.5 sm:p-3 rounded-xl border border-[#262b3d]/70 space-y-1.5">
                <span className="text-[11px] sm:text-xs text-gray-300 font-bold block">
                  部位頻率
                </span>
                <div className="grid grid-cols-5 gap-1 text-center">
                  <div>
                    <span className="text-[11px] text-gray-400 block">胸</span>
                    <span className="text-sm font-black text-white">{currentGroup.stats["胸"] || 0}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-400 block">背</span>
                    <span className="text-sm font-black text-white">{currentGroup.stats["背"] || 0}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-400 block">腿</span>
                    <span className="text-sm font-black text-white">{currentGroup.stats["腿"] || 0}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-400 block">肩</span>
                    <span className="text-sm font-black text-white">{currentGroup.stats["肩"] || 0}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-400 block">游</span>
                    <span className="text-sm font-black text-white">{currentGroup.stats["游泳"] || 0}</span>
                  </div>
                </div>
              </div>

              {/* 該月 3 項最高重量 */}
              <div className="bg-[#181b26] p-2.5 sm:p-3 rounded-xl border border-[#262b3d]/70 space-y-1.5">
                <span className="text-[11px] sm:text-xs text-emerald-400 font-bold block">
                  當月三項最高
                </span>
                <div className="grid grid-cols-3 gap-1 text-center">
                  <div>
                    <span className="text-[11px] text-gray-400 block">臥推</span>
                    <span className="text-sm font-black text-white">
                      {currentGroup.bigThreeMax.bench > 0 ? `${currentGroup.bigThreeMax.bench}kg` : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-400 block">深蹲</span>
                    <span className="text-sm font-black text-white">
                      {currentGroup.bigThreeMax.squat > 0 ? `${currentGroup.bigThreeMax.squat}kg` : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-400 block">硬舉</span>
                    <span className="text-sm font-black text-white">
                      {currentGroup.bigThreeMax.deadlift > 0 ? `${currentGroup.bigThreeMax.deadlift}kg` : "-"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 該月份日誌清單 (點擊 title 直接展開詳情，不跳轉新頁面) */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-[13px] sm:text-sm font-bold text-gray-300">
                  訓練日誌清單 ({currentGroup.sessions.length} 場)
                </span>
                <button
                  type="button"
                  onClick={() => toggleExpandAll(currentGroup.sessions)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                >
                  {allCurrentExpanded ? "全部收合" : "全部展開"}
                </button>
              </div>

              {/* 部位快速篩選 Pills (全部 / 胸 / 背 / 腿 / 肩 / 手臂 / 核心 / 游泳) */}
              {currentGroup.sessions.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {(["all", "胸", "背", "腿", "肩", "手臂", "核心", "游泳"] as const).map((m) => {
                    const label = m === "all" ? "全部" : m;
                    const count = m === "all"
                      ? currentGroup.sessions.length
                      : (currentGroup.stats[m as keyof typeof currentGroup.stats] || 0);
                    if (m !== "all" && count === 0) return null;
                    const isActive = selectedMuscleFilter === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSelectedMuscleFilter(m)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 shrink-0 ${
                          isActive
                            ? "bg-emerald-500 text-black shadow-sm font-black"
                            : "bg-[#181b26] text-gray-400 hover:text-white border border-[#262b3d]"
                        }`}
                      >
                        {label} {count > 0 && <span className={`text-[10px] ml-0.5 ${isActive ? "text-black/80 font-black" : "text-gray-500"}`}>{count}</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {currentGroup.sessions.length === 0 ? (
                <div className="text-center py-10 space-y-2.5 bg-[#181b26]/50 border border-[#262b3d]/60 rounded-xl">
                  <p className="text-xs text-gray-400">這個月還沒有訓練紀錄</p>
                  <Link
                    href={`/workout/new?date=${currentGroup.monthKey}-01`}
                    className="inline-flex items-center gap-1.5 bg-[#181b26] hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>開始此月的訓練</span>
                  </Link>
                </div>
              ) : (
                (() => {
                  const filteredSessions = currentGroup.sessions.filter((s) => {
                    if (selectedMuscleFilter === "all") return true;
                    return s.target_muscle.includes(selectedMuscleFilter);
                  });

                  if (filteredSessions.length === 0) {
                    return (
                      <div className="text-center py-8 space-y-2 bg-[#181b26]/50 border border-[#262b3d]/60 rounded-xl">
                        <p className="text-xs text-gray-400">本月無【{selectedMuscleFilter}】相關訓練紀錄</p>
                        <button
                          type="button"
                          onClick={() => setSelectedMuscleFilter("all")}
                          className="text-xs text-emerald-400 font-bold hover:underline cursor-pointer"
                        >
                          清除篩選顯示全部
                        </button>
                      </div>
                    );
                  }

                  return filteredSessions.map((sess) => {
                const sessSets = sessionSetsMap[sess.id] || [];
                const isExpanded = expandedSessionIds.has(sess.id);

                // 熱身組不計入組數，只統計正式組
                const isWarmup = (st: SetItem) => {
                  if (st.set_type === "warmup") return true;
                  const r = st.raw_text || "";
                  const n = st.notes || "";
                  return r.includes("熱身") || r.includes("激發") || r.includes("試重") || n.includes("熱身");
                };
                const formalSets = sessSets.filter((st) => !isWarmup(st));

                // 依動作群組分類組數（嚴格依 set_order 順序，確保與現場訓練先後次序 100% 一致）
                const sortedSessSets = [...sessSets].sort((a, b) => a.set_order - b.set_order);
                const exMap = new Map<string, SetItem[]>();
                const exOrder: string[] = [];
                for (const st of sortedSessSets) {
                  if (!exMap.has(st.exercise_id)) {
                    exMap.set(st.exercise_id, []);
                    exOrder.push(st.exercise_id);
                  }
                  exMap.get(st.exercise_id)!.push(st);
                }

                const computedIdx = monthlyIndicesMap.get(sess.id) || sess.monthly_index;
                const cleanedTitle = cleanSessionTitle(sess.display_title, sess.target_muscle, computedIdx);
                const primaryMuscle = getPrimaryMuscle(sess.target_muscle);

                return (
                  <div
                    key={sess.id}
                    className="bg-[#181b26] border border-[#262b3d] hover:border-[#384059] rounded-xl overflow-hidden transition-all shadow-sm"
                  >
                    {/* 標題欄：點一下就展開/收合，完全不跳轉其他頁面 */}
                    <div
                      onClick={(e) => {
                        // 若使用者正在用滑鼠選取反白標題文字，不觸發展開/收合
                        const sel = typeof window !== "undefined" ? window.getSelection()?.toString() : "";
                        if (sel && sel.trim().length > 0) return;
                        toggleExpand(sess.id);
                      }}
                      className="px-3 py-2.5 text-xs cursor-pointer active:bg-[#202533]"
                    >
                      {/* 主行：部位 badge + 標題與副資訊 + 展開操作 */}
                      <div className="flex items-start gap-2.5">
                        <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
                          <span className={`px-2 py-0.5 rounded font-black text-xs border ${getMuscleBadgeColor(sess.target_muscle)}`}>
                            {primaryMuscle}
                          </span>
                        </div>

                        {/* 中間文字區：標題與副標題自然對齊，免去人工 margin-left 跑版 */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="font-bold text-gray-100 hover:text-emerald-400 transition-colors break-words select-text cursor-text text-[13px] sm:text-sm leading-snug"
                              title="可直接選取複製文字"
                            >
                              {cleanedTitle}
                            </span>
                            {sess.status === "in_progress" && (
                              <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                                進行中
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {sess.location && (
                              <span className="text-[11px] sm:text-xs text-gray-400 font-medium">
                                📍 {sess.location}
                              </span>
                            )}
                            {sess.target_muscle !== "游泳" && (
                              sess.status === "in_progress" ? (
                                <span className="text-[11px] sm:text-xs bg-amber-950/40 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40 font-bold">
                                  已做 {formalSets.filter((s) => s.is_completed !== false).length}/{formalSets.length} 組
                                  {sessSets.length > formalSets.length && (
                                    <span className="text-gray-500 ml-1 text-[10px]">
                                      (+{sessSets.length - formalSets.length}熱身)
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-[11px] sm:text-xs bg-[#090a0f] text-gray-300 px-2 py-0.5 rounded border border-[#262b3d] font-semibold">
                                  {formalSets.length} 組
                                  {sessSets.length > formalSets.length && (
                                    <span className="text-gray-500 ml-1 text-[10px]">
                                      (+{sessSets.length - formalSets.length}熱身)
                                    </span>
                                  )}
                                </span>
                              )
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 mt-0.5">
                          {/* 一鍵複製整場訓練純文字 (適合 LINE / 微信) */}
                          <button
                            type="button"
                            onClick={(e) => handleCopyPlainText(e, sess)}
                            className="p-1.5 text-gray-400 hover:text-cyan-400 hover:bg-[#262b3d] rounded transition-all cursor-pointer"
                            title="一鍵複製此場簡潔純文字 (適合 LINE / 微信)"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>

                          {/* 一鍵複製整場訓練 Markdown 按鈕 (包含所有動作與組數) */}
                          <button
                            type="button"
                            onClick={(e) => handleCopyMarkdown(e, sess)}
                            className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-[#262b3d] rounded transition-all cursor-pointer"
                            title="一鍵複製此場完整訓練紀錄 (含所有動作與組數)"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* 刪除按鈕 */}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSession(e, sess)}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-950/40 rounded transition-all cursor-pointer"
                            title="刪除此場訓練"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <ChevronDown
                            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                              isExpanded ? "rotate-180 text-emerald-400" : ""
                            }`}
                          />
                        </div>
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
                          <div className="space-y-3">
                            {exOrder.map((exId) => {
                              const ex = exercises.find((e) => e.id === exId);
                              const exSets = exMap.get(exId) || [];
                              const exName = ex ? ex.name : "訓練項目";

                              return (
                                <div key={exId} className="space-y-1">
                                  <div className="font-bold text-emerald-400 text-[13px] sm:text-sm flex items-center gap-1.5">
                                    <span>•</span>
                                    <span>{exName}：</span>
                                  </div>
                                  <div className="pl-4 space-y-1">
                                    {exSets.map((st, sIdx) => {
                                      // 乾淨移除 raw_text 內可能殘留的舊 set 編號，依動作內順序重新格式化
                                      const cleanBody = st.raw_text
                                        ? st.raw_text.replace(/^set\s*\d+:\s*/i, "").trim()
                                        : (st.weight_kg > 0 ? `${st.weight_kg}Kg x${st.reps}` : `x${st.reps}`);

                                      let displayText = "";
                                      const isWarmupOrTest =
                                        st.set_type === "warmup" ||
                                        cleanBody.includes("熱身") ||
                                        cleanBody.includes("激發") ||
                                        cleanBody.includes("試重");

                                      if (sess.target_muscle === "游泳") {
                                        displayText = cleanBody;
                                      } else if (isWarmupOrTest) {
                                        displayText = cleanBody.includes("熱身") || cleanBody.includes("激發") || cleanBody.includes("試重")
                                          ? cleanBody
                                          : `${cleanBody} 熱身`;
                                      } else {
                                        // 正式組：依據在該動作中的位置重新順序編號 (set 1, set 2, set 3...)
                                        const formalIndex = exSets
                                          .slice(0, sIdx + 1)
                                          .filter(
                                            (s) =>
                                              s.set_type !== "warmup" &&
                                              !s.raw_text?.includes("熱身") &&
                                              !s.raw_text?.includes("激發") &&
                                              !s.raw_text?.includes("試重")
                                          ).length;
                                        displayText = `set ${formalIndex}: ${cleanBody}`;
                                      }

                                      const isPending = sess.status === "in_progress" && st.is_completed === false;

                                      return (
                                        <div
                                          key={st.id || sIdx}
                                          className={`text-xs font-mono tracking-tight font-medium flex items-center justify-between ${
                                            isPending ? "text-gray-500 italic" : "text-gray-200"
                                          }`}
                                        >
                                          <span>- {displayText}</span>
                                          {isPending && (
                                            <span className="text-[10px] text-amber-400/90 font-sans font-bold not-italic">
                                              (未完成)
                                            </span>
                                          )}
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
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2.5 border-t border-[#262b3d]/40 text-xs mt-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => handleCopyPlainText(e, sess)}
                              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-gray-400 hover:text-cyan-400 py-1.5 px-2.5 rounded-lg bg-[#181b26] border border-[#262b3d] hover:border-cyan-500/40 transition-colors cursor-pointer active:scale-95"
                              title="複製簡潔純文字"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>純文字</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleCopyMarkdown(e, sess)}
                              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-gray-400 hover:text-emerald-400 py-1.5 px-2.5 rounded-lg bg-[#181b26] border border-[#262b3d] hover:border-emerald-500/40 transition-colors cursor-pointer active:scale-95"
                              title="複製完整 Markdown"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>Markdown</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleDeleteSession(e, sess)}
                              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-gray-400 hover:text-red-400 py-1.5 px-2.5 rounded-lg bg-[#181b26] border border-[#262b3d] hover:border-red-500/40 transition-colors cursor-pointer active:scale-95"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>刪除</span>
                            </button>
                          </div>

                          <Link
                            href={`/workout/${sess.id}`}
                            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-bold transition-all active:scale-95 text-center ${
                              sess.status === "in_progress"
                                ? "text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 shadow-sm"
                                : "text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30"
                            }`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>{sess.status === "in_progress" ? "▶ 繼續本次訓練" : "進入記錄 / 修改組數"}</span>
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                );
              });
            })()
          )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
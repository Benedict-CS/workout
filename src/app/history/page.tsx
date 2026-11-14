"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Trash2,
  Download,
  Copy,
  Check,
  MapPin,
  UploadCloud,
  Share2,
  X,
  Sparkles,
  List,
  Plus,
  Dumbbell,
  Clock,
} from "lucide-react";
import { db } from "@/lib/db/schema";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import {
  formatSessionToMarkdown,
  exportAllSessionsToMarkdown,
} from "@/lib/markdown-generator";
import { parseWorkoutMarkdown } from "@/lib/parser/markdown-parser";
import { runFullSync, deleteRemoteSession } from "@/lib/db/sync";
import { getPrimaryMuscle, getMuscleBadgeColor, cleanSessionTitle } from "@/lib/workout-utils";
import type { WorkoutSession, SetItem, Exercise, BigThreeRecord } from "@/lib/types";

const WEEK_DAYS = ["一", "二", "三", "四", "五", "六", "日"];

function getDayOfWeekLabel(dateStr: string) {
  try {
    const d = new Date(dateStr + "T00:00:00");
    const days = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
    return days[d.getDay()];
  } catch {
    return "";
  }
}

export default function HistoryPage() {
  const todayStr = new Date().toISOString().split("T")[0];
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [sets, setSets] = useState<SetItem[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [bigThree, setBigThree] = useState<BigThreeRecord | null>(null);

  const [monthKeys, setMonthKeys] = useState<string[]>([]);
  const [calendarMonth, setCalendarMonth] = useState<string>(todayStr.slice(0, 7));
  const [selectedCalDate, setSelectedCalDate] = useState<string>(todayStr);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);

  // 檢視模式：預設直接就是日曆檢視 (匹配記帳 app 使用體驗)
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");

  // 清單模式下的篩選
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Markdown 匯入 Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  async function loadData() {
    try {
      await ensureDatabaseSeeded();
    } catch {}

    const allSessions = await db.sessions
      .filter((s) => !s.deleted_at)
      .reverse()
      .sortBy("date");
    setSessions(allSessions);

    const allSets = await db.sets.filter((s) => !s.deleted_at).toArray();
    setSets(allSets);

    const allEx = await db.exercises.toArray();
    setExercises(allEx);

    const b3 = await db.big_three.toArray();
    if (b3.length > 0) setBigThree(b3[0]);

    const distinctMonths = Array.from(new Set(allSessions.map((s) => s.month_key)))
      .sort()
      .reverse();
    setMonthKeys(distinctMonths);

    // 若有當前最新月份，設定預設月曆月份
    if (distinctMonths.length > 0) {
      if (distinctMonths.includes(todayStr.slice(0, 7))) {
        setCalendarMonth(todayStr.slice(0, 7));
      } else {
        setCalendarMonth(distinctMonths[0]);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleDeleteSession(e: React.MouseEvent, sessionId: string, title: string) {
    e.preventDefault();
    e.stopPropagation();
    if (
      !confirm(
        `確定要刪除這場訓練【${title}】嗎？\n包含其中的所有組數記錄都將被清除。`
      )
    )
      return;

    await db.transaction("rw", [db.sessions, db.sets], async () => {
      await db.sets.where("session_id").equals(sessionId).delete();
      await db.sessions.delete(sessionId);
    });

    deleteRemoteSession(sessionId).catch(() => {});
    runFullSync().catch(() => {});

    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setSets((prev) => prev.filter((s) => s.session_id !== sessionId));
  }

  function handleCopySessionMarkdown(e: React.MouseEvent, session: WorkoutSession) {
    e.preventDefault();
    e.stopPropagation();
    const sessionSets = sets.filter((s) => s.session_id === session.id);
    const md = formatSessionToMarkdown(session, sessionSets, exercises);
    navigator.clipboard.writeText(md);
    setCopyToast(`已複製【${session.display_title}】Markdown！`);
    setTimeout(() => setCopyToast(null), 2500);
  }

  async function handleShareSession(e: React.MouseEvent, session: WorkoutSession) {
    e.preventDefault();
    e.stopPropagation();
    const sessionSets = sets.filter((s) => s.session_id === session.id);
    const md = formatSessionToMarkdown(session, sessionSets, exercises);

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: session.display_title,
          text: md,
        });
        return;
      } catch {}
    }

    navigator.clipboard.writeText(md);
    setCopyToast("已複製訓練文字至剪貼簿！");
    setTimeout(() => setCopyToast(null), 2500);
  }

  function handleExportAllMarkdown() {
    const fullMd = exportAllSessionsToMarkdown(sessions, sets, exercises, bigThree);
    const blob = new Blob([fullMd], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `workout_journal_${new Date().toISOString().split("T")[0]}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handlePrevMonth() {
    const [y, m] = calendarMonth.split("-").map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevY = prevDate.getFullYear();
    const prevM = String(prevDate.getMonth() + 1).padStart(2, "0");
    const newMonth = `${prevY}-${prevM}`;
    setCalendarMonth(newMonth);
    setSelectedCalDate(`${newMonth}-01`);
  }

  function handleNextMonth() {
    const [y, m] = calendarMonth.split("-").map(Number);
    const nextDate = new Date(y, m, 1);
    const nextY = nextDate.getFullYear();
    const nextM = String(nextDate.getMonth() + 1).padStart(2, "0");
    const newMonth = `${nextY}-${nextM}`;
    setCalendarMonth(newMonth);
    setSelectedCalDate(`${newMonth}-01`);
  }

  async function handleImportMarkdown() {
    if (!importText.trim()) return;
    setImporting(true);
    try {
      const parsed = parseWorkoutMarkdown(importText.trim());
      if (parsed.sessions.length === 0) {
        alert("未識別到標準訓練日誌格式（請確認包含 <details><summary>... 或動作與組數）");
        setImporting(false);
        return;
      }

      await db.transaction("rw", [db.sessions, db.exercises, db.sets, db.big_three], async () => {
        for (const ex of parsed.exercises) {
          const exists = await db.exercises.get(ex.id);
          if (!exists) await db.exercises.put(ex);
        }
        for (const sess of parsed.sessions) {
          await db.sessions.put(sess);
        }
        for (const s of parsed.sets) {
          await db.sets.put(s);
        }
        if (parsed.bigThree) {
          await db.big_three.put(parsed.bigThree);
        }
      });

      runFullSync().catch(() => {});

      setImportSuccessMsg(`成功匯入 ${parsed.sessions.length} 場訓練、${parsed.sets.length} 組紀錄！`);
      await loadData();
      setTimeout(() => {
        setImportSuccessMsg(null);
        setShowImportModal(false);
        setImportText("");
      }, 1800);
    } catch {
      alert("匯入發生錯誤，請檢查 Markdown 格式是否正確");
    } finally {
      setImporting(false);
    }
  }

  // 日曆計算 (週一為每週第一天，完全匹配記帳 app)
  const calParts = (calendarMonth || "2026-11").split("-");
  const calYear = parseInt(calParts[0], 10);
  const calMonth = parseInt(calParts[1], 10);
  const rawFirstDay = new Date(calYear, calMonth - 1, 1).getDay();
  // 0 = 週日 -> offset 6; 1 = 週一 -> offset 0
  const mondayOffset = rawFirstDay === 0 ? 6 : rawFirstDay - 1;
  const daysInCalMonth = new Date(calYear, calMonth, 0).getDate();

  // 將所有訓練按日期分組
  const sessionsByDateMap = new Map<string, WorkoutSession[]>();
  for (const s of sessions) {
    if (!sessionsByDateMap.has(s.date)) {
      sessionsByDateMap.set(s.date, []);
    }
    sessionsByDateMap.get(s.date)!.push(s);
  }

  // 本月份訓練概況統計
  const curMonthSessions = sessions.filter((s) => s.month_key === calendarMonth);
  const curMonthMuscleCounts: Record<string, number> = { 胸: 0, 背: 0, 腿: 0, 肩: 0, 游泳: 0 };
  for (const s of curMonthSessions) {
    if (s.target_muscle.includes("胸")) curMonthMuscleCounts["胸"]++;
    else if (s.target_muscle.includes("背")) curMonthMuscleCounts["背"]++;
    else if (s.target_muscle.includes("腿")) curMonthMuscleCounts["腿"]++;
    else if (s.target_muscle.includes("肩")) curMonthMuscleCounts["肩"]++;
    else if (s.target_muscle.includes("泳")) curMonthMuscleCounts["游泳"]++;
  }

  // 動作對應字典
  const exMap = new Map<string, Exercise>();
  exercises.forEach((e) => exMap.set(e.id, e));

  // 當前選取日期的訓練清單
  const selectedDaySessions = sessionsByDateMap.get(selectedCalDate) || [];

  // 清單篩選
  const filteredList = sessions.filter((s) => {
    if (selectedMonth !== "all" && s.month_key !== selectedMonth) return false;
    if (selectedLocation !== "all" && (!s.location || !s.location.includes(selectedLocation))) return false;
    if (
      searchQuery &&
      !s.display_title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !s.target_muscle.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !(s.location && s.location.toLowerCase().includes(searchQuery.toLowerCase()))
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-4 pb-24">
      {/* 頂部導航與工具按鈕 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">歷史月曆</h1>
          <p className="text-xs text-gray-400">
            完整日曆檢視 • 掌握每月訓練頻率與進度
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {/* 模式切換按鈕 */}
          <button
            onClick={() => setViewMode(viewMode === "calendar" ? "list" : "calendar")}
            className="p-2 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] text-gray-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
            title={viewMode === "calendar" ? "切換至清單搜尋" : "切換至月曆檢視"}
          >
            {viewMode === "calendar" ? (
              <>
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">清單模式</span>
              </>
            ) : (
              <>
                <CalendarIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline text-emerald-400">月曆模式</span>
              </>
            )}
          </button>

          {/* 貼上 Markdown 匯入 */}
          <button
            onClick={() => setShowImportModal(true)}
            className="p-2 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
            title="貼上 Markdown 語法匯入"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">匯入 MD</span>
          </button>

          {/* 下載完整 .md 檔案 */}
          <button
            onClick={handleExportAllMarkdown}
            className="p-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-black flex items-center gap-1 active:scale-95 transition-all shadow cursor-pointer"
            title="下載完整 Markdown 日誌 (.md)"
          >
            <Download className="w-3.5 h-3.5 stroke-[3]" />
            <span className="hidden sm:inline">匯出 .md</span>
          </button>
        </div>
      </div>

      {/* 複製成功提示 Toast */}
      {copyToast && (
        <div className="bg-emerald-500 text-black px-4 py-2 rounded-xl text-xs font-black shadow-2xl flex items-center gap-2 animate-in fade-in duration-150">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{copyToast}</span>
        </div>
      )}

      {/* 貼上 Markdown 匯入彈窗 */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12141c] border border-emerald-500/40 rounded-2xl max-w-lg w-full p-5 space-y-3.5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#262b3d] pb-2.5">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>貼上 Markdown 訓練紀錄匯入</span>
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={8}
              placeholder="在此貼上 Markdown 內容...
例如:
<details>
<summary><b>11/8 (胸) - 交大健身房 - 第 5 次</b></summary>
- 槓鈴臥推：
  - set 1: 50Kg x8
  - set 2: 50Kg x8
</details>"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full bg-[#090a0f] border border-[#262b3d] text-emerald-300 text-xs font-mono p-3 rounded-xl outline-none focus:border-emerald-500"
            />

            {importSuccessMsg && (
              <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold p-2.5 rounded-xl flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{importSuccessMsg}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="flex-1 bg-[#181b26] text-gray-300 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleImportMarkdown}
                disabled={!importText.trim() || importing}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black py-2.5 rounded-xl text-xs font-black shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                <span>{importing ? "正在解析並儲存..." : "開始匯入至資料庫"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 核心主體：月曆檢視 (匹配記帳 app 風格與體驗) */}
      {viewMode === "calendar" ? (
        <div className="space-y-3.5">
          {/* 日曆主卡片 */}
          <div className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-3 sm:p-4 shadow-lg space-y-3">
            {/* 月份切換列 (< 2026 年 11 月 ▾ >) */}
            <div className="flex items-center justify-between px-1">
              <button
                onClick={handlePrevMonth}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-300 hover:text-white transition-colors cursor-pointer active:scale-95"
                title="上一個月份"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMonthDropdown(!showMonthDropdown)}
                  className="flex items-center gap-1.5 font-black text-base text-white hover:text-emerald-400 transition-colors cursor-pointer py-1 px-2.5 rounded-xl hover:bg-[#181b26]"
                >
                  <span>
                    {calYear} 年 {calMonth} 月
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </button>

                {/* 快速切換月份下拉 */}
                {showMonthDropdown && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-40 bg-[#181b26] border border-[#262b3d] rounded-2xl p-2 shadow-2xl min-w-[160px] max-h-56 overflow-y-auto space-y-1">
                    {monthKeys.map((mk) => {
                      const [y, m] = mk.split("-");
                      const count = sessions.filter((s) => s.month_key === mk).length;
                      const isCur = mk === calendarMonth;
                      return (
                        <button
                          key={mk}
                          onClick={() => {
                            setCalendarMonth(mk);
                            setSelectedCalDate(`${mk}-01`);
                            setShowMonthDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                            isCur
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "text-gray-300 hover:bg-[#202533]"
                          }`}
                        >
                          <span>
                            {y} 年 {parseInt(m, 10)} 月
                          </span>
                          <span className="text-[10px] text-gray-400 font-normal">
                            {count} 場
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                onClick={handleNextMonth}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-300 hover:text-white transition-colors cursor-pointer active:scale-95"
                title="下一個月份"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* 本月統計條 */}
            <div className="flex items-center justify-between bg-[#181b26] px-3 py-2 rounded-xl text-xs border border-[#262b3d]/60 text-gray-400">
              <span className="font-bold text-white">
                本月累計{" "}
                <span className="text-emerald-400 font-black">
                  {curMonthSessions.length}
                </span>{" "}
                場訓練
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                {curMonthMuscleCounts["胸"] > 0 && (
                  <span className="text-rose-400">胸 {curMonthMuscleCounts["胸"]}</span>
                )}
                {curMonthMuscleCounts["背"] > 0 && (
                  <span className="text-cyan-400">背 {curMonthMuscleCounts["背"]}</span>
                )}
                {curMonthMuscleCounts["腿"] > 0 && (
                  <span className="text-emerald-400">腿 {curMonthMuscleCounts["腿"]}</span>
                )}
                {curMonthMuscleCounts["游泳"] > 0 && (
                  <span className="text-blue-400">泳 {curMonthMuscleCounts["游泳"]}</span>
                )}
              </div>
            </div>

            {/* 星期欄頭 (一 二 三 四 五 六 日) */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-400 py-1">
              {WEEK_DAYS.map((wd, i) => (
                <div
                  key={wd}
                  className={i >= 5 ? "text-amber-400/90" : "text-gray-400"}
                >
                  {wd}
                </div>
              ))}
            </div>

            {/* 7 列月曆方格網 (匹配記帳 app 佈局與外觀) */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {/* 月首空白格 */}
              {Array.from({ length: mondayOffset }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="h-16 sm:h-20 rounded-xl bg-transparent opacity-0 pointer-events-none"
                />
              ))}

              {/* 每月份日期方格 */}
              {Array.from({ length: daysInCalMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dStr = dayNum.toString().padStart(2, "0");
                const mStr = calMonth.toString().padStart(2, "0");
                const fullDate = `${calYear}-${mStr}-${dStr}`;
                const daySessions = sessionsByDateMap.get(fullDate) || [];
                const isSelected = selectedCalDate === fullDate;
                const isToday = fullDate === todayStr;

                return (
                  <button
                    key={fullDate}
                    onClick={() => setSelectedCalDate(fullDate)}
                    className={`h-16 sm:h-20 rounded-xl sm:rounded-2xl p-1 sm:p-1.5 border text-center flex flex-col justify-between items-center transition-all cursor-pointer relative ${
                      isSelected
                        ? "bg-emerald-950/40 border-2 border-emerald-500 shadow-lg ring-1 ring-emerald-400/40"
                        : daySessions.length > 0
                        ? "bg-[#181b26] border-[#262b3d] hover:border-emerald-500/50 hover:bg-[#202533]"
                        : "bg-[#161822]/60 border-[#262b3d]/40 text-gray-500 hover:bg-[#1a1d2b]/80"
                    }`}
                  >
                    {/* 日期數字 (置中對齊，完美契合記帳 app 佈局) */}
                    <div className="w-full flex items-center justify-center pt-0.5">
                      <span
                        className={`text-xs font-black inline-flex items-center justify-center w-5 h-5 rounded-full ${
                          isSelected
                            ? "bg-emerald-500 text-black shadow"
                            : isToday
                            ? "bg-white text-black"
                            : daySessions.length > 0
                            ? "text-gray-100"
                            : "text-gray-500"
                        }`}
                      >
                        {dayNum}
                      </span>
                    </div>

                    {/* 訓練部位標籤 (紅/藍/綠/黃清晰部位色) */}
                    <div className="space-y-0.5 overflow-hidden w-full">
                      {daySessions.map((ds) => {
                        let badgeStyle = "bg-rose-500/20 text-rose-300 border-rose-500/30";
                        if (ds.target_muscle.includes("背"))
                          badgeStyle = "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
                        if (ds.target_muscle.includes("腿"))
                          badgeStyle = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
                        if (ds.target_muscle.includes("肩"))
                          badgeStyle = "bg-amber-500/20 text-amber-300 border-amber-500/30";
                        if (ds.target_muscle.includes("泳"))
                          badgeStyle = "bg-blue-500/20 text-blue-300 border-blue-500/30";

                        const shortLabel = ds.target_muscle.includes("泳")
                          ? "游泳"
                          : ds.target_muscle.replace("部", "").slice(0, 2);

                        return (
                          <div
                            key={ds.id}
                            className={`text-[10px] font-black px-1 py-0.5 rounded border text-center truncate ${badgeStyle}`}
                          >
                            {shortLabel}
                          </div>
                        );
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 下半部：選取日期明細 (XX/XX 週X 明細，與記帳 app 底部完全一致) */}
          <section className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 shadow-lg space-y-3 animate-in fade-in duration-150">
            {/* 明細標題列 */}
            <div className="flex items-center justify-between border-b border-[#262b3d]/80 pb-2.5">
              <h3 className="font-black text-white text-base">
                {selectedCalDate.slice(5).replace("-", "/")} {getDayOfWeekLabel(selectedCalDate)} 明細
              </h3>

              {/* 記一筆按鈕 (傳入選定的日期，直接開立這天的訓練) */}
              <Link
                href={`/workout/new?date=${selectedCalDate}`}
                className="bg-emerald-500 hover:bg-emerald-400 text-black px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 active:scale-95 transition-all shadow"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>記一筆</span>
              </Link>
            </div>

            {/* 若當天有訓練紀錄 */}
            {selectedDaySessions.length > 0 ? (
              <div className="space-y-2.5">
                {selectedDaySessions.map((s) => {
                  const sessSets = sets.filter((st) => st.session_id === s.id && !st.deleted_at);

                  // 熱身不計入組數，只統計正式組
                  const isWarmup = (st: SetItem) => {
                    if (st.set_type === "warmup") return true;
                    const r = st.raw_text || "";
                    const n = st.notes || "";
                    return r.includes("熱身") || r.includes("激發") || r.includes("試重") || n.includes("熱身");
                  };
                  const formalSets = sessSets.filter((st) => !isWarmup(st));

                  // 提取這場訓練所做的所有動作與最高重量 (僅統計正式組)
                  const seenEx = new Map<string, { maxWeight: number; setCount: number }>();
                  for (const st of sessSets) {
                    const ex = exMap.get(st.exercise_id);
                    const name = ex ? ex.name : "動作";
                    const cur = seenEx.get(name) || { maxWeight: 0, setCount: 0 };
                    if (!isWarmup(st)) {
                      cur.setCount++;
                    }
                    if (st.weight_kg > cur.maxWeight) cur.maxWeight = st.weight_kg;
                    seenEx.set(name, cur);
                  }

                  return (
                    <div
                      key={s.id}
                      className="bg-[#181b26] hover:bg-[#1e2230] border border-[#262b3d] hover:border-emerald-500/40 rounded-xl p-3.5 space-y-2.5 transition-all group shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/workout/${s.id}`} className="flex-1">
                          <h4 className="font-bold text-white text-sm group-hover:text-emerald-400 transition-colors">
                            {cleanSessionTitle(s.display_title, s.target_muscle)}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-gray-400 mt-1 flex-wrap">
                            <span className={`font-black px-2 py-0.5 rounded border text-[11px] ${getMuscleBadgeColor(s.target_muscle)}`}>
                              {getPrimaryMuscle(s.target_muscle)}
                            </span>
                            {s.status === "in_progress" && (
                              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black px-1.5 py-0.5 rounded animate-pulse">
                                進行中草稿
                              </span>
                            )}
                            {s.location && (
                              <span className="text-blue-400 flex items-center gap-0.5 text-[11px]">
                                <MapPin className="w-3 h-3" />
                                {s.location}
                              </span>
                            )}
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-300 font-medium text-[11px]">
                              共 {formalSets.length} 組
                            </span>
                          </div>
                        </Link>

                        {/* 操作按鈕群 */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleShareSession(e, s)}
                            className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-[#12141c] rounded-lg transition-colors cursor-pointer"
                            title="分享"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleCopySessionMarkdown(e, s)}
                            className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-[#12141c] rounded-lg transition-colors cursor-pointer"
                            title="複製 Markdown"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSession(e, s.id, s.display_title)}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-[#12141c] rounded-lg transition-colors cursor-pointer"
                            title="刪除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 動作精華列表 */}
                      {seenEx.size > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[#262b3d]/60">
                          {Array.from(seenEx.entries()).map(([name, data]) => (
                            <span
                              key={name}
                              className="text-[11px] bg-[#12141c] border border-[#262b3d] px-2 py-0.5 rounded-lg text-gray-300"
                            >
                              <strong className="text-white">{name}</strong>
                              {data.maxWeight > 0 ? ` ${data.maxWeight}Kg` : ""}
                              <span className="text-gray-500 ml-1">({data.setCount}組)</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 進入訓練詳情按鈕 */}
                      <Link
                        href={`/workout/${s.id}`}
                        className="w-full bg-[#12141c] hover:bg-emerald-500/10 border border-[#262b3d] hover:border-emerald-500/40 text-emerald-400 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all"
                      >
                        <span>進入訓練檢視 / 調整組數</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* 當天無訓練紀錄 */
              <div className="text-center py-7 space-y-2 bg-[#181b26]/50 border border-[#262b3d]/60 rounded-xl">
                <p className="text-xs text-gray-400">這天還沒有訓練紀錄（休息日）</p>
                <Link
                  href={`/workout/new?date=${selectedCalDate}`}
                  className="inline-flex items-center gap-1.5 bg-[#181b26] hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>開啟這天的訓練</span>
                </Link>
              </div>
            )}
          </section>
        </div>
      ) : (
        /* 清單搜尋檢視模式 */
        <div className="space-y-3">
          {/* 搜尋與月份篩選列 */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="搜尋部位、動作、場地(交大/三健客)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#12141c] border border-[#262b3d] text-white text-xs rounded-xl pl-9 pr-3 py-2.5 focus:border-emerald-500 outline-none placeholder-gray-500"
              />
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-[#12141c] border border-[#262b3d] text-xs text-emerald-400 font-bold rounded-xl px-3 outline-none"
            >
              <option value="all">全部月份 ({sessions.length})</option>
              {monthKeys.map((mk) => {
                const count = sessions.filter((s) => s.month_key === mk).length;
                return (
                  <option key={mk} value={mk}>
                    {mk} ({count}次)
                  </option>
                );
              })}
            </select>
          </div>

          {/* 場地過濾 */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar">
            <button
              onClick={() => setSelectedLocation("all")}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all border cursor-pointer ${
                selectedLocation === "all"
                  ? "bg-emerald-500 text-black border-emerald-400 shadow-sm"
                  : "bg-[#12141c] text-gray-400 border-[#262b3d] hover:text-white"
              }`}
            >
              全部場館 ({sessions.length})
            </button>
            {["三健客", "交大健身房", "交大游泳池"].map((loc) => {
              const count = sessions.filter((s) => s.location && s.location.includes(loc)).length;
              if (count === 0 && selectedLocation !== loc) return null;
              return (
                <button
                  key={loc}
                  onClick={() => setSelectedLocation(selectedLocation === loc ? "all" : loc)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all border flex items-center gap-1 cursor-pointer ${
                    selectedLocation === loc
                      ? "bg-blue-600 text-white border-blue-400 shadow-sm"
                      : "bg-[#12141c] text-gray-400 border-[#262b3d] hover:text-white"
                  }`}
                >
                  <MapPin className="w-3 h-3 text-blue-400" />
                  <span>{loc}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>

          {/* 清單項目 */}
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-xs">載入日誌中...</div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-14 text-gray-500 text-xs bg-[#12141c] border border-[#262b3d] rounded-2xl p-6">
              沒有找到相符的訓練紀錄
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredList.map((s) => {
                const sessSets = sets.filter((setItem) => setItem.session_id === s.id);
                const distinctEx = new Set(sessSets.map((setItem) => setItem.exercise_id)).size;

                return (
                  <div
                    key={s.id}
                    className="bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] hover:border-emerald-500/40 rounded-2xl p-3.5 flex items-center justify-between transition-all group shadow-sm"
                  >
                    <Link href={`/workout/${s.id}`} className="space-y-1 flex-1 pr-2">
                      <h4 className="font-bold text-gray-100 text-sm group-hover:text-emerald-400 transition-colors">
                        {cleanSessionTitle(s.display_title, s.target_muscle)}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400 flex-wrap">
                        <span>{s.date}</span>
                        <span>•</span>
                        <span className={`font-black px-1.5 py-0.5 rounded border text-[10px] ${getMuscleBadgeColor(s.target_muscle)}`}>
                          {getPrimaryMuscle(s.target_muscle)}
                        </span>
                        <span>•</span>
                        <span>{distinctEx} 個動作</span>
                        <span>•</span>
                        <span>
                          {sessSets.filter((st) => {
                            if (st.set_type === "warmup") return false;
                            const r = st.raw_text || "";
                            const n = st.notes || "";
                            return !(r.includes("熱身") || r.includes("激發") || r.includes("試重") || n.includes("熱身"));
                          }).length} 組
                        </span>
                        {s.location && (
                          <>
                            <span>•</span>
                            <span className="text-blue-400 flex items-center gap-0.5">
                              <MapPin className="w-2.5 h-2.5" />
                              {s.location}
                            </span>
                          </>
                        )}
                      </div>
                    </Link>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleShareSession(e, s)}
                        className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-950/30 rounded-lg transition-all cursor-pointer"
                        title="分享此場紀錄"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleCopySessionMarkdown(e, s)}
                        className="p-2 text-gray-400 hover:text-emerald-400 hover:bg-emerald-950/30 rounded-lg transition-all cursor-pointer"
                        title="一鍵複製 Markdown"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteSession(e, s.id, s.display_title)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-all cursor-pointer"
                        title="刪除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <Link href={`/workout/${s.id}`} className="p-1">
                        <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Download,
  Copy,
  Check,
  MapPin,
  FileText,
  Filter,
  UploadCloud,
  Share2,
  X,
  Sparkles,
  List,
  LayoutGrid,
} from "lucide-react";
import { db } from "@/lib/db/schema";
import {
  formatSessionToMarkdown,
  exportAllSessionsToMarkdown,
} from "@/lib/markdown-generator";
import { parseWorkoutMarkdown } from "@/lib/parser/markdown-parser";
import type { WorkoutSession, SetItem, Exercise, BigThreeRecord } from "@/lib/types";

const WEEK_DAYS = ["日", "一", "二", "三", "四", "五", "六"];

export default function HistoryPage() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [sets, setSets] = useState<SetItem[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [bigThree, setBigThree] = useState<BigThreeRecord | null>(null);

  const [monthKeys, setMonthKeys] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // 檢視模式切換：清單 vs 月曆
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calendarMonth, setCalendarMonth] = useState<string>("");
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null);

  // Markdown 貼上匯入 Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  async function loadData() {
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
    if (distinctMonths.length > 0) {
      setCalendarMonth(distinctMonths[0]);
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

    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setSets((prev) => prev.filter((s) => s.session_id !== sessionId));
  }

  // 單場日誌複製為 Markdown
  function handleCopySessionMarkdown(e: React.MouseEvent, session: WorkoutSession) {
    e.preventDefault();
    e.stopPropagation();
    const sessionSets = sets.filter((s) => s.session_id === session.id);
    const md = formatSessionToMarkdown(session, sessionSets, exercises);
    navigator.clipboard.writeText(md);
    setCopyToast(`已複製【${session.display_title}】Markdown！`);
    setTimeout(() => setCopyToast(null), 2500);
  }

  // 行動裝置原生系統分享
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

  // 匯出全庫完整 Markdown 檔案 (.md)
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

  // 複製目前選定月份的所有訓練
  function handleCopySelectedMonthMarkdown() {
    const targetSessions =
      selectedMonth === "all"
        ? sessions
        : sessions.filter((s) => s.month_key === selectedMonth);

    const monthMd = exportAllSessionsToMarkdown(targetSessions, sets, exercises, bigThree);
    navigator.clipboard.writeText(monthMd);
    setCopyToast(
      selectedMonth === "all"
        ? "已複製全部歷史 Markdown 日誌！"
        : `已複製 ${selectedMonth} 月份全部 Markdown 日誌！`
    );
    setTimeout(() => setCopyToast(null), 2500);
  }

  // 貼上 Markdown 匯入
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

      setImportSuccessMsg(`成功匯入 ${parsed.sessions.length} 場訓練、${parsed.sets.length} 組紀錄！`);
      await loadData();
      setTimeout(() => {
        setImportSuccessMsg(null);
        setShowImportModal(false);
        setImportText("");
      }, 1800);
    } catch (err) {
      alert("匯入發生錯誤，請檢查 Markdown 格式是否正確");
    } finally {
      setImporting(false);
    }
  }

  const filtered = sessions.filter((s) => {
    if (selectedMonth !== "all" && s.month_key !== selectedMonth) return false;
    if (selectedLocation !== "all") {
      if (!s.location || !s.location.includes(selectedLocation)) return false;
    }
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

  // 日曆數據計算
  const calParts = (calendarMonth || "2026-11").split("-");
  const calYear = parseInt(calParts[0], 10);
  const calMonth = parseInt(calParts[1], 10);
  const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
  const daysInCalMonth = new Date(calYear, calMonth, 0).getDate();

  const sessionsByDateMap = new Map<string, WorkoutSession[]>();
  for (const s of filtered) {
    if (!sessionsByDateMap.has(s.date)) {
      sessionsByDateMap.set(s.date, []);
    }
    sessionsByDateMap.get(s.date)!.push(s);
  }

  const calMonthIdx = monthKeys.indexOf(calendarMonth);

  return (
    <div className="space-y-4 pb-20">
      {/* 標題與匯出操作按鈕 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">歷史訓練日誌</h1>
          <p className="text-xs text-gray-400">
            共 {sessions.length} 場訓練紀錄 • 與 Markdown 筆記 100% 相符
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {/* 貼上 Markdown 匯入 */}
          <button
            onClick={() => setShowImportModal(true)}
            className="p-2 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
            title="貼上 Markdown 語法匯入"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">匯入 MD</span>
          </button>

          {/* 複製 Markdown */}
          <button
            onClick={handleCopySelectedMonthMarkdown}
            className="p-2 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
            title="複製目前選取範圍的 Markdown"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">複製 Markdown</span>
          </button>

          {/* 下載完整 .md 檔案 */}
          <button
            onClick={handleExportAllMarkdown}
            className="p-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-black flex items-center gap-1 active:scale-95 transition-all shadow"
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

      {/* 檢視模式切換：清單 vs 月曆 */}
      <div className="flex items-center justify-between bg-[#12141c] border border-[#262b3d] rounded-xl p-1 text-xs">
        <button
          onClick={() => setViewMode("list")}
          className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
            viewMode === "list"
              ? "bg-[#181b26] text-emerald-400 shadow-sm"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <List className="w-3.5 h-3.5" />
          <span>清單檢視 ({sessions.length})</span>
        </button>

        <button
          onClick={() => setViewMode("calendar")}
          className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
            viewMode === "calendar"
              ? "bg-[#181b26] text-emerald-400 shadow-sm"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>月曆檢視</span>
        </button>
      </div>

      {/* 依訓練場地快速過濾 */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar">
        <button
          onClick={() => setSelectedLocation("all")}
          className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all border ${
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
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all border flex items-center gap-1 ${
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
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-gray-400">
              支援貼入單次 `<details><summary>...</summary></details>` 或多月份完整筆記，系統將自動解析出訓練日期、場地、動作與組數！
            </p>

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
                className="flex-1 bg-[#181b26] text-gray-300 py-2.5 rounded-xl text-xs font-bold"
              >
                取消
              </button>
              <button
                onClick={handleImportMarkdown}
                disabled={!importText.trim() || importing}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black py-2.5 rounded-xl text-xs font-black shadow transition-all flex items-center justify-center gap-1.5"
              >
                <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                <span>{importing ? "正在解析並儲存..." : "開始匯入至資料庫"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 視圖 1: 月曆檢視模式 */}
      {viewMode === "calendar" ? (
        <div className="space-y-3">
          {/* 月份切換列 */}
          <div className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-3 flex items-center justify-between">
            <button
              onClick={() => {
                if (calMonthIdx < monthKeys.length - 1) {
                  setCalendarMonth(monthKeys[calMonthIdx + 1]);
                  setSelectedCalDate(null);
                }
              }}
              disabled={calMonthIdx >= monthKeys.length - 1}
              className="p-1.5 bg-[#181b26] border border-[#262b3d] rounded-xl text-gray-300 disabled:opacity-30 active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="font-black text-sm text-white">
              {calYear} 年 {calMonth} 月份
            </span>

            <button
              onClick={() => {
                if (calMonthIdx > 0) {
                  setCalendarMonth(monthKeys[calMonthIdx - 1]);
                  setSelectedCalDate(null);
                }
              }}
              disabled={calMonthIdx <= 0}
              className="p-1.5 bg-[#181b26] border border-[#262b3d] rounded-xl text-gray-300 disabled:opacity-30 active:scale-95"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 月曆網格 */}
          <div className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-3 shadow-md">
            {/* 星期列 */}
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-gray-400 mb-2">
              {WEEK_DAYS.map((wd, i) => (
                <div key={wd} className={i === 0 || i === 6 ? "text-amber-400/80" : ""}>
                  {wd}
                </div>
              ))}
            </div>

            {/* 日期格子 */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="h-14 rounded-xl opacity-0 pointer-events-none" />
              ))}

              {Array.from({ length: daysInCalMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dStr = dayNum.toString().padStart(2, "0");
                const mStr = calMonth.toString().padStart(2, "0");
                const fullDate = `${calYear}-${mStr}-${dStr}`;
                const daySessions = sessionsByDateMap.get(fullDate) || [];
                const isSelected = selectedCalDate === fullDate;

                return (
                  <button
                    key={fullDate}
                    onClick={() => {
                      if (daySessions.length > 0) {
                        setSelectedCalDate(fullDate);
                      }
                    }}
                    className={`h-14 rounded-xl p-1 border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? "bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/50"
                        : daySessions.length > 0
                        ? "bg-[#181b26] border-[#262b3d] hover:border-emerald-500/50"
                        : "bg-[#090a0f]/40 border-transparent text-gray-600"
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold ${
                        daySessions.length > 0 ? "text-gray-200" : "text-gray-600"
                      }`}
                    >
                      {dayNum}
                    </span>

                    {/* 部位標籤膠囊 */}
                    <div className="space-y-0.5">
                      {daySessions.map((ds) => {
                        let badgeBg = "bg-red-500/20 text-red-300 border-red-500/40";
                        if (ds.target_muscle.includes("背"))
                          badgeBg = "bg-blue-500/20 text-blue-300 border-blue-500/40";
                        if (ds.target_muscle.includes("腿"))
                          badgeBg = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
                        if (ds.target_muscle.includes("游泳"))
                          badgeBg = "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";

                        const label = ds.target_muscle.slice(0, 1);
                        return (
                          <div
                            key={ds.id}
                            className={`text-[9px] font-black px-1 rounded border text-center truncate ${badgeBg}`}
                          >
                            {label}
                          </div>
                        );
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 選取日期的訓練詳情卡片 */}
          {selectedCalDate && (
            <div className="space-y-2 pt-1 animate-in fade-in duration-150">
              <span className="text-xs font-bold text-gray-300 block">
                {selectedCalDate} 的訓練：
              </span>
              {(sessionsByDateMap.get(selectedCalDate) || []).map((s) => (
                <Link
                  key={s.id}
                  href={`/workout/${s.id}`}
                  className="bg-[#181b26] hover:bg-[#202533] border border-emerald-500/40 rounded-xl p-3 flex items-center justify-between text-xs transition-all shadow-md block"
                >
                  <div>
                    <h4 className="font-bold text-white text-sm">{s.display_title}</h4>
                    <span className="text-emerald-400 text-[11px] mt-0.5 block">
                      {s.target_muscle} {s.location ? `• ${s.location}` : ""}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-emerald-400" />
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* 視圖 2: 清單條列檢視模式 */
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

          {/* 日誌清單 */}
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-xs">載入日誌中...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14 text-gray-500 text-xs bg-[#12141c] border border-[#262b3d] rounded-2xl p-6">
              沒有找到相符的訓練紀錄
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((s) => {
                const sessSets = sets.filter((setItem) => setItem.session_id === s.id);
                const distinctEx = new Set(sessSets.map((setItem) => setItem.exercise_id)).size;

                return (
                  <div
                    key={s.id}
                    className="bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] hover:border-emerald-500/40 rounded-2xl p-3.5 flex items-center justify-between transition-all group shadow-sm"
                  >
                    <Link href={`/workout/${s.id}`} className="space-y-1 flex-1 pr-2">
                      <h4 className="font-bold text-gray-100 text-sm group-hover:text-emerald-400 transition-colors">
                        {s.display_title}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400 flex-wrap">
                        <span>{s.date}</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-medium">{s.target_muscle}</span>
                        <span>•</span>
                        <span>{distinctEx} 個動作</span>
                        <span>•</span>
                        <span>{sessSets.length} 組</span>
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
                      {/* 分享按鈕 */}
                      <button
                        type="button"
                        onClick={(e) => handleShareSession(e, s)}
                        className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-950/30 rounded-lg transition-all"
                        title="分享此場紀錄"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>

                      {/* 一鍵複製該場 Markdown */}
                      <button
                        type="button"
                        onClick={(e) => handleCopySessionMarkdown(e, s)}
                        className="p-2 text-gray-400 hover:text-emerald-400 hover:bg-emerald-950/30 rounded-lg transition-all"
                        title="一鍵複製這場訓練為 Markdown 語法"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      {/* 刪除這場紀錄 */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSession(e, s.id, s.display_title)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-all"
                        title="刪除此場紀錄"
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

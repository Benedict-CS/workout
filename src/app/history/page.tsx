"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  Calendar,
  ChevronRight,
  Trash2,
  Download,
  Copy,
  Check,
  MapPin,
  FileText,
  Filter,
} from "lucide-react";
import { db } from "@/lib/db/schema";
import {
  formatSessionToMarkdown,
  exportAllSessionsToMarkdown,
} from "@/lib/markdown-generator";
import type { WorkoutSession, SetItem, Exercise, BigThreeRecord } from "@/lib/types";

export default function HistoryPage() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [sets, setSets] = useState<SetItem[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [bigThree, setBigThree] = useState<BigThreeRecord | null>(null);

  const [monthKeys, setMonthKeys] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [copyToast, setCopyToast] = useState<string | null>(null);

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

  const filtered = sessions.filter((s) => {
    if (selectedMonth !== "all" && s.month_key !== selectedMonth) return false;
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
          <button
            onClick={handleCopySelectedMonthMarkdown}
            className="p-2 bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
            title="複製目前選取範圍的 Markdown"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">複製 Markdown</span>
          </button>

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

      {/* 搜尋與月份篩選列 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="搜尋部位、動作、場地(交大/三劍客)..."
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
              <Link
                key={s.id}
                href={`/workout/${s.id}`}
                className="bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] hover:border-emerald-500/40 rounded-2xl p-3.5 flex items-center justify-between transition-all group shadow-sm"
              >
                <div className="space-y-1">
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
                </div>

                <div className="flex items-center gap-1.5">
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

                  <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Calendar, ChevronRight, Filter, Trash2 } from "lucide-react";
import { db } from "@/lib/db/schema";
import type { WorkoutSession, SetItem } from "@/lib/types";

export default function HistoryPage() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [monthKeys, setMonthKeys] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    const all = await db.sessions
      .filter((s) => !s.deleted_at)
      .reverse()
      .sortBy("date");
    setSessions(all);

    const distinctMonths = Array.from(new Set(all.map((s) => s.month_key))).sort().reverse();
    setMonthKeys(distinctMonths);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleDeleteSession(e: React.MouseEvent, sessionId: string, title: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`確定要刪除這場訓練【${title}】嗎？\n包含其中的所有組數記錄都將被清除。`)) return;

    await db.transaction("rw", [db.sessions, db.sets], async () => {
      await db.sets.where("session_id").equals(sessionId).delete();
      await db.sessions.delete(sessionId);
    });

    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  }

  const filtered = sessions.filter((s) => {
    if (selectedMonth !== "all" && s.month_key !== selectedMonth) return false;
    if (searchQuery && !s.display_title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-black text-white">歷史訓練日誌</h1>
        <p className="text-xs text-gray-400">回顧過去所有的力量記錄與突破</p>
      </div>

      {/* 搜尋與月份篩選 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="搜尋部位、動作或備註..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#12141c] border border-[#262b3d] text-white text-xs rounded-xl pl-9 pr-3 py-2.5 focus:border-emerald-500 outline-none"
          />
        </div>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="bg-[#12141c] border border-[#262b3d] text-xs text-emerald-400 font-bold rounded-xl px-3 outline-none"
        >
          <option value="all">全部月份</option>
          {monthKeys.map((mk) => (
            <option key={mk} value={mk}>
              {mk}
            </option>
          ))}
        </select>
      </div>

      {/* 日誌清單 */}
      {loading ? (
        <div className="text-center py-10 text-gray-400 text-xs">載入日誌中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-xs">沒有找到相符的訓練紀錄</div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((s) => (
            <Link
              key={s.id}
              href={`/workout/${s.id}`}
              className="bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] hover:border-emerald-500/40 rounded-xl p-3.5 flex items-center justify-between transition-all group"
            >
              <div>
                <h4 className="font-bold text-gray-100 text-sm group-hover:text-emerald-400 transition-colors">
                  {s.display_title}
                </h4>
                <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-1">
                  <span>{s.date}</span>
                  <span>•</span>
                  <span className="text-emerald-400">{s.target_muscle}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => handleDeleteSession(e, s.id, s.display_title)}
                  className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-all"
                  title="刪除此場紀錄"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

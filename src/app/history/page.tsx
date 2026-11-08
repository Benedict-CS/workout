"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Calendar, ChevronRight, Filter } from "lucide-react";
import { db } from "@/lib/db/schema";
import type { WorkoutSession, SetItem } from "@/lib/types";

export default function HistoryPage() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [monthKeys, setMonthKeys] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const all = await db.sessions
        .filter((s) => !s.deleted_at)
        .reverse()
        .sortBy("date");
      setSessions(all);

      const distinctMonths = Array.from(new Set(all.map((s) => s.month_key))).sort().reverse();
      setMonthKeys(distinctMonths);
      setLoading(false);
    }
    load();
  }, []);

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
              className="bg-[#12141c] hover:bg-[#181b26] border border-[#262b3d] hover:border-emerald-500/40 rounded-xl p-3.5 flex items-center justify-between transition-all"
            >
              <div>
                <h4 className="font-bold text-gray-100 text-sm">{s.display_title}</h4>
                <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-1">
                  <span>{s.date}</span>
                  <span>•</span>
                  <span className="text-emerald-400">{s.target_muscle}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Trophy,
  TrendingUp,
  Dumbbell,
  Scale,
  Plus,
  Trash2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { db } from "@/lib/db/schema";
import { runFullSync, deleteRemoteBodyWeight } from "@/lib/db/sync";
import type { WorkoutSession, SetItem, Exercise, BigThreeRecord, BodyWeightRecord } from "@/lib/types";

interface MonthBigThreeData {
  monthKey: string;
  monthLabel: string;
  bench: number;
  squat: number;
  deadlift: number;
  total: number;
}

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bigThree, setBigThree] = useState<BigThreeRecord | null>(null);
  const [allTimeStats, setAllTimeStats] = useState({
    胸: 0,
    背: 0,
    腿: 0,
    肩: 0,
    游泳: 0,
    total: 0,
  });
  const [monthlyTrend, setMonthlyTrend] = useState<MonthBigThreeData[]>([]);

  // 體重與身體成分數據狀態 (晨起空腹量測)
  const [bodyWeights, setBodyWeights] = useState<BodyWeightRecord[]>([]);
  const [newWeightDate, setNewWeightDate] = useState(new Date().toISOString().split("T")[0]);
  const [newWeightValue, setNewWeightValue] = useState("");
  const [newFatValue, setNewFatValue] = useState("");
  const [newMuscleValue, setNewMuscleValue] = useState("");
  const [bwMetricTab, setBwMetricTab] = useState<"weight" | "fat">("weight");
  const [bwSaving, setBwSaving] = useState(false);
  const [showBwList, setShowBwList] = useState(false);

  useEffect(() => {
    setMounted(true);
    async function loadData() {
      try {
        const b3 = await db.big_three.toArray();
        if (b3.length > 0) setBigThree(b3[0]);

        // 讀取歷史體重數據
        const bwList = await db.body_weight.orderBy("date").toArray();
        setBodyWeights(bwList);

        const sessions = await db.sessions
          .filter((s) => !s.deleted_at)
          .sortBy("date");

        // 全歷史累計訓練總量
        const totalCounts = { 胸: 0, 背: 0, 腿: 0, 肩: 0, 游泳: 0, total: sessions.length };
        for (const sess of sessions) {
          if (sess.target_muscle.includes("胸")) totalCounts["胸"]++;
          else if (sess.target_muscle.includes("背")) totalCounts["背"]++;
          else if (sess.target_muscle.includes("腿")) totalCounts["腿"]++;
          else if (sess.target_muscle.includes("肩")) totalCounts["肩"]++;
          else if (sess.target_muscle.includes("泳")) totalCounts["游泳"]++;
        }
        setAllTimeStats(totalCounts);

        const sessionMap = new Map<string, WorkoutSession>();
        for (const s of sessions) sessionMap.set(s.id, s);

        const allSets = await db.sets
          .filter((s) => !s.deleted_at && s.weight_kg > 0)
          .toArray();

        const allExercises = await db.exercises.toArray();
        const exMap = new Map<string, Exercise>();
        for (const e of allExercises) exMap.set(e.id, e);

        // 1. 每月份基本三項最高實測重量分析
        const benchExIds = allExercises.filter((e) => e.name.includes("臥推") && !e.name.includes("啞鈴")).map((e) => e.id);
        const squatExIds = allExercises.filter((e) => e.name.includes("深蹲")).map((e) => e.id);
        const deadliftExIds = allExercises.filter((e) => e.name.includes("硬舉")).map((e) => e.id);

        const monthKeys = Array.from(new Set(sessions.map((s) => s.month_key))).sort();
        const trendList: MonthBigThreeData[] = [];

        for (const mk of monthKeys) {
          const mSessIds = new Set(sessions.filter((s) => s.month_key === mk).map((s) => s.id));
          const mSets = allSets.filter((st) => mSessIds.has(st.session_id));

          let maxBench = 0;
          let maxSquat = 0;
          let maxDeadlift = 0;

          for (const st of mSets) {
            if (benchExIds.includes(st.exercise_id) && st.weight_kg > maxBench) maxBench = st.weight_kg;
            if (squatExIds.includes(st.exercise_id) && st.weight_kg > maxSquat) maxSquat = st.weight_kg;
            if (deadliftExIds.includes(st.exercise_id) && st.weight_kg > maxDeadlift) maxDeadlift = st.weight_kg;
          }

          const label = mk.replace("2026-", "") + "月";
          trendList.push({
            monthKey: mk,
            monthLabel: label,
            bench: maxBench,
            squat: maxSquat,
            deadlift: maxDeadlift,
            total: maxBench + maxSquat + maxDeadlift,
          });
        }
        setMonthlyTrend(trendList);
      } catch (err) {
        console.error("Failed to load analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  async function handleAddBodyWeight() {
    const w = parseFloat(newWeightValue);
    if (!w || w <= 0 || !newWeightDate) return;

    setBwSaving(true);
    const fat = newFatValue ? parseFloat(newFatValue) : undefined;
    const muscle = newMuscleValue ? parseFloat(newMuscleValue) : undefined;

    const newRec: BodyWeightRecord = {
      id: `bw-${newWeightDate}`,
      date: newWeightDate,
      weight_kg: w,
      body_fat_pct: fat && fat > 0 ? fat : undefined,
      skeletal_muscle_kg: muscle && muscle > 0 ? muscle : undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.body_weight.put(newRec);

    // 同步更新三項中的個人體重與體重倍數比
    const b3List = await db.big_three.toArray();
    if (b3List.length > 0) {
      const curB3 = b3List[0];
      const b = curB3.bench_press_kg;
      const s = curB3.squat_kg;
      const d = curB3.deadlift_kg;
      await db.big_three.update(curB3.id, {
        body_weight_kg: w,
        bench_ratio: b > 0 ? Math.round((b / w) * 100) / 100 : undefined,
        squat_ratio: s > 0 ? Math.round((s / w) * 100) / 100 : undefined,
        deadlift_ratio: d > 0 ? Math.round((d / w) * 100) / 100 : undefined,
        updated_at: new Date().toISOString(),
      });
    }

    const updatedList = await db.body_weight.orderBy("date").toArray();
    setBodyWeights(updatedList);
    setNewWeightValue("");
    setNewFatValue("");
    setNewMuscleValue("");
    setBwSaving(false);
    runFullSync().catch(() => {});
  }

  async function handleDeleteBodyWeight(id: string) {
    if (!confirm("確定刪除此筆體重紀錄？")) return;
    await db.body_weight.delete(id);
    deleteRemoteBodyWeight(id).catch(() => {});
    runFullSync().catch(() => {});
    const updatedList = await db.body_weight.orderBy("date").toArray();
    setBodyWeights(updatedList);
  }

  if (!mounted || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-400 gap-3">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm">載入力量進步分析中...</p>
      </div>
    );
  }

  const startBw = bodyWeights.length > 0 ? bodyWeights[0].weight_kg : 56.9;
  const latestBw = bodyWeights.length > 0 ? bodyWeights[bodyWeights.length - 1].weight_kg : 62.6;
  const netDiff = Math.round((latestBw - startBw) * 10) / 10;

  const bwWithFat = bodyWeights.filter((b) => typeof b.body_fat_pct === "number");
  const latestFat = bwWithFat.length > 0 && bwWithFat[bwWithFat.length - 1].body_fat_pct !== undefined
    ? bwWithFat[bwWithFat.length - 1].body_fat_pct!
    : null;
  const startFat = bwWithFat.length > 0 && bwWithFat[0].body_fat_pct !== undefined
    ? bwWithFat[0].body_fat_pct!
    : null;
  const fatDiff = latestFat !== null && startFat !== null ? Math.round((latestFat - startFat) * 10) / 10 : null;

  const bwChartData = bodyWeights.map((b) => ({
    date: b.date.slice(5),
    fullDate: b.date,
    weight: b.weight_kg,
    bodyFat: b.body_fat_pct,
    muscle: b.skeletal_muscle_kg,
  }));

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h1 className="text-xl font-black text-white">訓練與力量分析</h1>
        <p className="text-xs text-gray-400">
          全歷史累計訓練總量與每月三項實測最高重量成長
        </p>
      </div>

      {/* 全歷史累計訓練總量 */}
      <section className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-black text-white">全歷史累計訓練總量</h2>
          </div>
          <span className="text-xs text-emerald-400 font-bold">
            總共 {allTimeStats.total} 場訓練
          </span>
        </div>

        <div className={`grid ${allTimeStats["肩"] > 0 ? "grid-cols-5" : "grid-cols-4"} gap-2 text-center`}>
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
          {allTimeStats["肩"] > 0 && (
            <div className="bg-[#181b26] p-2.5 rounded-xl border border-amber-500/40">
              <span className="text-[11px] text-amber-400 block mb-0.5">練肩</span>
              <span className="text-lg font-black text-amber-300">{allTimeStats["肩"]}</span>
              <span className="text-[10px] text-gray-500 block">次</span>
            </div>
          )}
          <div className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d]/70">
            <span className="text-[11px] text-gray-400 block mb-0.5">游泳</span>
            <span className="text-lg font-black text-white">{allTimeStats["游泳"]}</span>
            <span className="text-[10px] text-gray-500 block">次</span>
          </div>
        </div>
      </section>

      {/* 體重追蹤與成長趨勢 (固定晨起空腹量測基準) */}
      <section className="bg-[#12141c] border border-cyan-500/30 rounded-2xl p-4 space-y-3.5 shadow-md">
        <div className="flex items-center justify-between border-b border-[#262b3d]/60 pb-2.5">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-gray-100">體重追蹤與成長趨勢</h2>
          </div>
          <span className="text-[10px] text-gray-400 bg-[#181b26] px-2 py-0.5 rounded border border-[#262b3d]">
            晨起空腹未穿衣基準
          </span>
        </div>

        {/* 3 大指標卡 (若有體脂數據則並列顯示) */}
        <div className={`grid ${latestFat !== null ? "grid-cols-4" : "grid-cols-3"} gap-2 text-center`}>
          <div className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d]/70">
            <span className="text-[10px] text-gray-400 block mb-0.5">起始體重</span>
            <span className="text-base font-black text-gray-200">{startBw}</span>
            <span className="text-[10px] text-gray-500 block">kg</span>
          </div>

          <div className="bg-[#181b26] p-2.5 rounded-xl border border-cyan-500/30">
            <span className="text-[10px] text-cyan-400 block mb-0.5">最新體重</span>
            <span className="text-base font-black text-white">{latestBw}</span>
            <span className="text-[10px] text-cyan-400/80 block">kg</span>
          </div>

          <div className="bg-[#181b26] p-2.5 rounded-xl border border-emerald-500/30">
            <span className="text-[10px] text-emerald-400 block mb-0.5">體重淨增減</span>
            <span className="text-base font-black text-emerald-300">
              {netDiff > 0 ? `+${netDiff}` : netDiff}
            </span>
            <span className="text-[10px] text-emerald-400/80 block">kg</span>
          </div>

          {latestFat !== null && (
            <div className="bg-[#181b26] p-2.5 rounded-xl border border-amber-500/30">
              <span className="text-[10px] text-amber-400 block mb-0.5">最新體脂</span>
              <span className="text-base font-black text-amber-300">{latestFat}%</span>
              <span className="text-[10px] text-amber-400/80 block">
                {fatDiff !== null ? (fatDiff > 0 ? `+${fatDiff}%` : `${fatDiff}%`) : "空腹量測"}
              </span>
            </div>
          )}
        </div>

        {/* 曲線切換分頁 */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setBwMetricTab("weight")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                bwMetricTab === "weight"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "bg-[#181b26] text-gray-400 hover:text-gray-200 border border-[#262b3d]"
              }`}
            >
              體重走勢 (kg)
            </button>
            <button
              type="button"
              onClick={() => setBwMetricTab("fat")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                bwMetricTab === "fat"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-[#181b26] text-gray-400 hover:text-gray-200 border border-[#262b3d]"
              }`}
            >
              體脂率趨勢 (%)
            </button>
          </div>
          <span className="text-[10px] text-gray-500">
            {bwMetricTab === "weight" ? "藍線：早晨體重" : "黃線：早晨體脂率"}
          </span>
        </div>

        {/* 歷史折線圖 */}
        <div className="h-44 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={bwChartData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262b3d" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={10} tickLine={false} interval="preserveStartEnd" />
              <YAxis stroke="#6b7280" fontSize={10} domain={["dataMin - 1", "dataMax + 1"]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#181b26",
                  borderColor: "#374151",
                  borderRadius: "0.75rem",
                  fontSize: "11px",
                  color: "#fff",
                }}
                formatter={(val: any) => [
                  bwMetricTab === "weight" ? `${val} kg` : `${val} %`,
                  bwMetricTab === "weight" ? "晨起體重" : "空腹體脂",
                ]}
                labelFormatter={(lbl, items) => {
                  const item = items[0]?.payload;
                  return item ? item.fullDate : lbl;
                }}
              />
              {bwMetricTab === "weight" ? (
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: "#06b6d4" }}
                />
              ) : (
                <Line
                  type="monotone"
                  dataKey="bodyFat"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  connectNulls
                  dot={{ r: 2.5, fill: "#f59e0b" }}
                  activeDot={{ r: 5, fill: "#f59e0b" }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 快速記錄體重 / 體脂 / 骨骼肌 輸入列 */}
        <div className="space-y-2 pt-2 border-t border-[#262b3d]/40">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">日期</label>
              <input
                type="date"
                value={newWeightDate}
                onChange={(e) => setNewWeightDate(e.target.value)}
                className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl px-2.5 py-2 outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-cyan-400 font-bold block mb-1">體重 (kg) *</label>
              <input
                type="number"
                step="0.1"
                placeholder="如 62.6"
                value={newWeightValue}
                onChange={(e) => setNewWeightValue(e.target.value)}
                className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-cyan-500 font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] text-amber-400 block mb-1">體脂率 (% 選填)</label>
              <input
                type="number"
                step="0.1"
                placeholder="如 16.5"
                value={newFatValue}
                onChange={(e) => setNewFatValue(e.target.value)}
                className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-emerald-400 block mb-1">骨骼肌 (kg 選填)</label>
              <input
                type="number"
                step="0.1"
                placeholder="如 28.5"
                value={newMuscleValue}
                onChange={(e) => setNewMuscleValue(e.target.value)}
                className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500">
              * 建議固定晨起空腹量測；體脂率可參考趨勢，骨骼肌建議每 1~2 月比對 InBody
            </span>
            <button
              type="button"
              onClick={handleAddBodyWeight}
              disabled={!newWeightValue || bwSaving}
              className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black font-black px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-1 shadow cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>記錄數據</span>
            </button>
          </div>
        </div>

        {/* 查看全部歷史紀錄 */}
        <div className="pt-0.5 text-right">
          <button
            type="button"
            onClick={() => setShowBwList(!showBwList)}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
          >
            {showBwList ? "收合歷史紀錄" : `查看全部 ${bodyWeights.length} 筆量測紀錄`}
          </button>
        </div>

        {showBwList && (
          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 border-t border-[#262b3d]/40 pt-2">
            {bodyWeights.slice().reverse().map((b) => (
              <div
                key={b.id}
                className="bg-[#181b26] px-3 py-1.5 rounded-lg flex items-center justify-between text-xs border border-[#262b3d]/60"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-gray-300 text-[11px]">{b.date}</span>
                  <span className="font-bold text-white">{b.weight_kg} kg</span>
                </div>
                <div className="flex items-center gap-3">
                  {typeof b.body_fat_pct === "number" && (
                    <span className="text-[11px] text-amber-400 font-medium">
                      體脂 {b.body_fat_pct}%
                    </span>
                  )}
                  {typeof b.skeletal_muscle_kg === "number" && (
                    <span className="text-[11px] text-emerald-400 font-medium">
                      骨骼肌 {b.skeletal_muscle_kg}kg
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteBodyWeight(b.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 每月三項實測最高重量走勢圖 */}
      <section className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-gray-100">每月三項最高重量成長曲線 (Kg)</h2>
          </div>
        </div>

        <div className="text-[11px] text-gray-400 flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block"></span>
            <span>臥推</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
            <span>深蹲</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block"></span>
            <span>硬舉</span>
          </span>
        </div>

        <div className="h-60 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262b3d" />
              <XAxis dataKey="monthLabel" stroke="#6b7280" fontSize={11} tickLine={false} />
              <YAxis stroke="#6b7280" fontSize={11} domain={["dataMin - 10", "dataMax + 10"]} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0]?.payload as MonthBigThreeData;
                  if (!data) return null;
                  return (
                    <div className="bg-[#181b26] border border-[#374151] rounded-xl p-3 text-xs shadow-xl space-y-1.5 min-w-[140px]">
                      <div className="font-bold text-white border-b border-[#262b3d] pb-1 text-[11px]">
                        {data.monthLabel || label}
                      </div>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center justify-between text-red-300">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-400"></span>
                            <span>臥推</span>
                          </span>
                          <span className="font-bold">{data.bench > 0 ? `${data.bench} Kg` : "-"}</span>
                        </div>
                        <div className="flex items-center justify-between text-emerald-300">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            <span>深蹲</span>
                          </span>
                          <span className="font-bold">{data.squat > 0 ? `${data.squat} Kg` : "-"}</span>
                        </div>
                        <div className="flex items-center justify-between text-blue-300">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                            <span>硬舉</span>
                          </span>
                          <span className="font-bold">{data.deadlift > 0 ? `${data.deadlift} Kg` : "-"}</span>
                        </div>
                        <div className="border-t border-[#262b3d] pt-1.5 mt-1 flex items-center justify-between text-amber-400 font-black">
                          <span>三項總和</span>
                          <span>{data.total > 0 ? `${data.total} Kg` : "-"}</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="bench"
                name="bench"
                stroke="#f87171"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#f87171" }}
              />
              <Line
                type="monotone"
                dataKey="squat"
                name="squat"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#10b981" }}
              />
              <Line
                type="monotone"
                dataKey="deadlift"
                name="deadlift"
                stroke="#60a5fa"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#60a5fa" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

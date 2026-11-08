"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Trophy,
  TrendingUp,
  Flame,
  Calendar,
  Dumbbell,
  BarChart2,
  Activity,
  Layers,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import { db } from "@/lib/db/schema";
import { estimate1RM } from "@/lib/db/crud";
import type { WorkoutSession, SetItem, Exercise, BigThreeRecord } from "@/lib/types";

interface PRItem {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  maxWeight: number;
  maxWeightReps: number;
  max1RM: number;
  achievedDate: string;
}

interface VolumeByMonth {
  month: string;
  volumeTons: number;
  sessionCount: number;
  setCount: number;
}

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bigThree, setBigThree] = useState<BigThreeRecord | null>(null);
  const [prList, setPrList] = useState<PRItem[]>([]);
  const [monthlyVolume, setMonthlyVolume] = useState<VolumeByMonth[]>([]);
  const [selectedExId, setSelectedExId] = useState<string>("");
  const [exTrendData, setExTrendData] = useState<{ date: string; weight: number; oneRM: number }[]>([]);
  const [stapleExercises, setStapleExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    setMounted(true);
    async function loadData() {
      try {
        const b3 = await db.big_three.toArray();
        if (b3.length > 0) setBigThree(b3[0]);

        const sessions = await db.sessions
          .filter((s) => !s.deleted_at)
          .sortBy("date");

        const sessionMap = new Map<string, WorkoutSession>();
        for (const s of sessions) sessionMap.set(s.id, s);

        const allSets = await db.sets
          .filter((s) => !s.deleted_at && s.weight_kg > 0)
          .toArray();

        const allExercises = await db.exercises.toArray();
        const exMap = new Map<string, Exercise>();
        for (const e of allExercises) exMap.set(e.id, e);

        // 篩選出常做的固定動作
        const staple = allExercises.filter(
          (e) =>
            e.name.includes("臥推") ||
            e.name.includes("深蹲") ||
            e.name.includes("硬舉") ||
            e.name.includes("夾胸") ||
            e.name.includes("划船") ||
            e.name.includes("下拉") ||
            e.name.includes("推蹬")
        );
        setStapleExercises(staple);
        if (staple.length > 0) setSelectedExId(staple[0].id);

        // 1. 計算全動作個人最佳 PR (Max Weight & Max 1RM)
        const prMap = new Map<
          string,
          {
            maxWeight: number;
            reps: number;
            max1RM: number;
            date: string;
          }
        >();

        for (const setItem of allSets) {
          const sess = sessionMap.get(setItem.session_id);
          const dateStr = sess ? sess.date : "";
          const oneRM = estimate1RM(setItem.weight_kg, setItem.reps);

          const existing = prMap.get(setItem.exercise_id);
          if (!existing) {
            prMap.set(setItem.exercise_id, {
              maxWeight: setItem.weight_kg,
              reps: setItem.reps,
              max1RM: oneRM,
              date: dateStr,
            });
          } else {
            if (oneRM > existing.max1RM) {
              existing.max1RM = oneRM;
              existing.date = dateStr;
            }
            if (setItem.weight_kg > existing.maxWeight) {
              existing.maxWeight = setItem.weight_kg;
              existing.reps = setItem.reps;
            }
          }
        }

        const calculatedPrs: PRItem[] = [];
        for (const [exId, data] of prMap.entries()) {
          const ex = exMap.get(exId);
          if (ex && data.maxWeight > 0) {
            calculatedPrs.push({
              exerciseId: exId,
              exerciseName: ex.name,
              muscleGroup: ex.muscle_group,
              maxWeight: data.maxWeight,
              maxWeightReps: data.reps,
              max1RM: data.max1RM,
              achievedDate: data.date,
            });
          }
        }
        calculatedPrs.sort((a, b) => b.max1RM - a.max1RM);
        setPrList(calculatedPrs);

        // 2. 計算每月訓練總容量 (噸數) 與組數
        const monthVolMap = new Map<string, { totalKg: number; setCount: number; sessionIds: Set<string> }>();
        for (const setItem of allSets) {
          const sess = sessionMap.get(setItem.session_id);
          if (!sess) continue;
          const mk = sess.month_key;
          if (!monthVolMap.has(mk)) {
            monthVolMap.set(mk, { totalKg: 0, setCount: 0, sessionIds: new Set() });
          }
          const rec = monthVolMap.get(mk)!;
          rec.totalKg += setItem.weight_kg * setItem.reps;
          rec.setCount += 1;
          rec.sessionIds.add(sess.id);
        }

        const volArray: VolumeByMonth[] = [];
        const sortedMonths = Array.from(monthVolMap.keys()).sort();
        for (const mk of sortedMonths) {
          const rec = monthVolMap.get(mk)!;
          const mLabel = mk.replace("2026-", "") + "月";
          volArray.push({
            month: mLabel,
            volumeTons: Math.round((rec.totalKg / 1000) * 10) / 10,
            sessionCount: rec.sessionIds.size,
            setCount: rec.setCount,
          });
        }
        setMonthlyVolume(volArray);
      } catch (err) {
        console.error("Failed to load analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // 當使用者選取不同動作時，計算該動作的歷史走勢
  useEffect(() => {
    if (!selectedExId) return;

    async function computeTrend() {
      const sets = await db.sets
        .where("exercise_id")
        .equals(selectedExId)
        .filter((s) => !s.deleted_at && s.weight_kg > 0)
        .toArray();

      const sessionIds = Array.from(new Set(sets.map((s) => s.session_id)));
      const sessions = await db.sessions
        .where("id")
        .anyOf(sessionIds)
        .filter((s) => !s.deleted_at)
        .sortBy("date");

      const trendPoints: { date: string; weight: number; oneRM: number }[] = [];

      for (const sess of sessions) {
        const sessSets = sets.filter((s) => s.session_id === sess.id);
        let maxW = 0;
        let max1RM = 0;
        for (const s of sessSets) {
          if (s.weight_kg > maxW) maxW = s.weight_kg;
          const r1 = estimate1RM(s.weight_kg, s.reps);
          if (r1 > max1RM) max1RM = r1;
        }
        if (maxW > 0) {
          trendPoints.push({
            date: sess.date.slice(5), // "06-12"
            weight: maxW,
            oneRM: max1RM,
          });
        }
      }

      setExTrendData(trendPoints);
    }

    computeTrend();
  }, [selectedExId]);

  if (!mounted || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-400 gap-3">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm">載入力量大數據中...</p>
      </div>
    );
  }

  const selectedEx = stapleExercises.find((e) => e.id === selectedExId);

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h1 className="text-xl font-black text-white">力量數據與進步分析</h1>
        <p className="text-xs text-gray-400">
          全歷史 6 個月、1,300 組數據的大數據力量成長軌跡
        </p>
      </div>

      {/* 基本三項 PR 榮譽看板 */}
      <section className="bg-gradient-to-br from-[#181b26] to-[#12141c] border border-amber-500/30 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold text-gray-100 uppercase tracking-wider">
              基本三項基準數據
            </h2>
          </div>
          <span className="text-xs bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
            總和 {bigThree?.total_kg ?? 235} Kg
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="bg-[#090a0f]/70 border border-[#262b3d] rounded-xl p-3">
            <span className="text-[11px] text-gray-400 block mb-0.5">臥推 PR</span>
            <span className="text-xl font-black text-white">{bigThree?.bench_press_kg ?? 60}</span>
            <span className="text-[10px] text-emerald-400 block mt-0.5 font-bold">
              {bigThree?.bench_ratio ?? 1}x 體重
            </span>
          </div>

          <div className="bg-[#090a0f]/70 border border-[#262b3d] rounded-xl p-3">
            <span className="text-[11px] text-gray-400 block mb-0.5">深蹲 PR</span>
            <span className="text-xl font-black text-white">{bigThree?.squat_kg ?? 85}</span>
            <span className="text-[10px] text-emerald-400 block mt-0.5 font-bold">
              {bigThree?.squat_ratio ?? 1.41}x 體重
            </span>
          </div>

          <div className="bg-[#090a0f]/70 border border-[#262b3d] rounded-xl p-3">
            <span className="text-[11px] text-gray-400 block mb-0.5">硬舉 PR</span>
            <span className="text-xl font-black text-white">{bigThree?.deadlift_kg ?? 90}</span>
            <span className="text-[10px] text-emerald-400 block mt-0.5 font-bold">
              {bigThree?.deadlift_ratio ?? 1.5}x 體重
            </span>
          </div>
        </div>

        {/* 力量等級進度條 */}
        <div className="mt-3 pt-3 border-t border-[#262b3d]/60 space-y-2 text-xs">
          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <span>當前力量總和水平：<strong className="text-emerald-400 font-bold">3.91x 體重 (中階紮實力量)</strong></span>
            <span className="text-amber-400 font-bold">下一里程碑: 4.6x (276Kg)</span>
          </div>
          <div className="w-full bg-[#090a0f] rounded-full h-2 border border-[#262b3d] overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-amber-400 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, Math.round(((bigThree?.total_kg ?? 235) / 276) * 100))}%` }}
            />
          </div>
        </div>
      </section>

      {/* 力量成長走勢折線圖 (1RM Progression) */}
      <section className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-3 shadow-md">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-gray-100">動作 1RM 成長走勢曲線</h2>
          </div>

          {/* 動作快速切換選單 */}
          <select
            value={selectedExId}
            onChange={(e) => setSelectedExId(e.target.value)}
            className="bg-[#181b26] border border-[#262b3d] text-emerald-400 text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none"
          >
            {stapleExercises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>

        <div className="text-[11px] text-gray-400 flex items-center justify-between">
          <span>{selectedEx?.name} 每次訓練頂尖重量 (綠: 推估 1RM / 藍: 當次頂重)</span>
          <span className="text-emerald-400 font-bold">共 {exTrendData.length} 次紀錄</span>
        </div>

        <div className="h-56 w-full pt-2">
          {exTrendData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-gray-500">
              尚無該動作歷史走勢數據
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={exTrendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262b3d" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={10} tickLine={false} />
                <YAxis stroke="#6b7280" fontSize={10} domain={["dataMin - 5", "dataMax + 5"]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#181b26",
                    borderColor: "#374151",
                    borderRadius: "0.75rem",
                    fontSize: "11px",
                    color: "#fff",
                  }}
                  formatter={(value: any, name: any) => [
                    `${value} Kg`,
                    name === "oneRM" ? "推估 1RM" : "當次最高重量",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="oneRM"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#10b981" }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 2, fill: "#3b82f6" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* 每月訓練總容量 (噸) 柱狀圖 */}
      <section className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-gray-100">每月累積訓練容量 (噸數)</h2>
          </div>
          <span className="text-[11px] text-gray-400">漸進式超負荷指標</span>
        </div>

        <div className="h-48 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyVolume} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262b3d" />
              <XAxis dataKey="month" stroke="#6b7280" fontSize={10} tickLine={false} />
              <YAxis stroke="#6b7280" fontSize={10} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#181b26",
                  borderColor: "#374151",
                  borderRadius: "0.75rem",
                  fontSize: "11px",
                  color: "#fff",
                }}
                formatter={(val: any) => [`${val} 噸 (Tons)`, "總容量"]}
              />
              <Bar dataKey="volumeTons" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 個人最佳紀錄榮譽榜 (All-Time PR Wall) */}
      <section className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-gray-100">各動作歷史 PR 榜</h2>
          </div>
          <span className="text-[11px] text-gray-400">共 {prList.length} 項動作突破</span>
        </div>

        <div className="space-y-2">
          {prList.slice(0, 15).map((pr, idx) => (
            <div
              key={pr.exerciseId || idx}
              className="bg-[#181b26] p-3 rounded-xl border border-[#262b3d] flex items-center justify-between text-xs"
            >
              <div>
                <div className="font-bold text-gray-100 flex items-center gap-1.5">
                  <span className="text-gray-500 text-[10px]">#{idx + 1}</span>
                  <span>{pr.exerciseName}</span>
                  <span className="text-[10px] bg-[#090a0f] text-emerald-400 px-1.5 py-0.5 rounded border border-[#262b3d]">
                    {pr.muscleGroup}
                  </span>
                </div>
                <div className="text-[11px] text-gray-400 mt-1">
                  最高實測：
                  <span className="text-gray-200 font-bold ml-0.5">
                    {pr.maxWeight}Kg × {pr.maxWeightReps}次
                  </span>
                  {pr.achievedDate && (
                    <span className="text-gray-500 ml-1.5">({pr.achievedDate})</span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-gray-400 block">推估 1RM</span>
                <span className="text-base font-black text-amber-400">
                  {pr.max1RM} <span className="text-[10px] font-normal text-gray-400">Kg</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Trophy,
  TrendingUp,
  Dumbbell,
  Calendar,
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
import type { WorkoutSession, SetItem, Exercise, BigThreeRecord } from "@/lib/types";

interface MonthBigThreeData {
  monthKey: string;
  monthLabel: string;
  bench: number;
  squat: number;
  deadlift: number;
  total: number;
}

interface PRItem {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  maxWeight: number;
  maxWeightReps: number;
  achievedDate: string;
}

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bigThree, setBigThree] = useState<BigThreeRecord | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthBigThreeData[]>([]);
  const [prList, setPrList] = useState<PRItem[]>([]);

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

        // 2. 各動作歷史實測最高重量排行榜
        const prMap = new Map<
          string,
          { maxWeight: number; reps: number; date: string }
        >();

        for (const setItem of allSets) {
          const sess = sessionMap.get(setItem.session_id);
          const dateStr = sess ? sess.date : "";

          const existing = prMap.get(setItem.exercise_id);
          if (!existing) {
            prMap.set(setItem.exercise_id, {
              maxWeight: setItem.weight_kg,
              reps: setItem.reps,
              date: dateStr,
            });
          } else {
            if (setItem.weight_kg > existing.maxWeight) {
              existing.maxWeight = setItem.weight_kg;
              existing.reps = setItem.reps;
              existing.date = dateStr;
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
              achievedDate: data.date,
            });
          }
        }
        calculatedPrs.sort((a, b) => b.maxWeight - a.maxWeight);
        setPrList(calculatedPrs);
      } catch (err) {
        console.error("Failed to load analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (!mounted || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-400 gap-3">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm">載入力量進步分析中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h1 className="text-xl font-black text-white">三項進步分析</h1>
        <p className="text-xs text-gray-400">
          追蹤每個月臥推、深蹲、硬舉實測最高重量成長
        </p>
      </div>

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
                contentStyle={{
                  backgroundColor: "#181b26",
                  borderColor: "#374151",
                  borderRadius: "0.75rem",
                  fontSize: "11px",
                  color: "#fff",
                }}
                formatter={(val: any, name: any) => [
                  `${val} Kg`,
                  name === "bench" ? "臥推最高" : name === "squat" ? "深蹲最高" : "硬舉最高",
                ]}
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

      {/* 每月三項實測最高數據表 */}
      <section className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-[#262b3d]/60 pb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-gray-100">各月三項最高對比表</h2>
          </div>
        </div>

        <div className="space-y-2">
          {monthlyTrend.slice().reverse().map((m) => (
            <div
              key={m.monthKey}
              className="bg-[#181b26] p-3 rounded-xl border border-[#262b3d] flex items-center justify-between text-xs"
            >
              <div className="font-black text-white text-sm">{m.monthLabel}</div>

              <div className="flex items-center gap-3 text-right">
                <div>
                  <span className="text-[10px] text-gray-400 block">臥推</span>
                  <span className="font-bold text-red-300">{m.bench > 0 ? `${m.bench}k` : "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block">深蹲</span>
                  <span className="font-bold text-emerald-300">{m.squat > 0 ? `${m.squat}k` : "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block">硬舉</span>
                  <span className="font-bold text-blue-300">{m.deadlift > 0 ? `${m.deadlift}k` : "-"}</span>
                </div>
                <div className="border-l border-[#262b3d] pl-3">
                  <span className="text-[10px] text-gray-400 block">三項總和</span>
                  <span className="font-black text-amber-400">{m.total > 0 ? `${m.total}k` : "-"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 動作實測最高榜 (不含 1RM) */}
      <section className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-[#262b3d]/60 pb-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-gray-100">各動作歷史實測最高重量</h2>
          </div>
        </div>

        <div className="space-y-2">
          {prList.map((pr, idx) => (
            <div
              key={pr.exerciseId}
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
                {pr.achievedDate && (
                  <span className="text-[10px] text-gray-500 mt-0.5 block">{pr.achievedDate}</span>
                )}
              </div>

              <div className="text-right">
                <span className="text-sm font-black text-white">
                  {pr.maxWeight} <span className="text-[10px] font-normal text-gray-400">Kg</span>
                </span>
                <span className="text-[10px] text-gray-400 block">× {pr.maxWeightReps} 下</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

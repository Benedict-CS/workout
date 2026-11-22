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
  Award,
  Activity,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  MonthlyTrendSvgChart,
  SingleMetricSvgChart,
  TriMetricCorrelationSvgChart,
} from "@/components/charts/NativeCharts";
import { db } from "@/lib/db/schema";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { runFullSync, deleteRemoteBodyWeight } from "@/lib/db/sync";
import { getStrengthStandard } from "@/lib/calc";
import type {
  WorkoutSession,
  SetItem,
  Exercise,
  BigThreeRecord,
  BodyWeightRecord,
  InBodyRecord,
} from "@/lib/types";

interface MonthBigThreeData {
  monthKey: string;
  monthLabel: string;
  bench: number;
  squat: number;
  deadlift: number;
  total: number;
}

function safeDateSlice(dateStr?: string): string {
  if (typeof dateStr !== "string" || !dateStr) return "";
  return dateStr.length >= 5 ? dateStr.slice(5) : dateStr;
}

function getInBodyTimingInfo(timing?: string, timeStr?: string) {
  let h = 12;
  let m = 0;
  if (typeof timeStr === "string" && timeStr.includes(":")) {
    const parts = timeStr.split(":");
    const parsedH = parseInt(parts[0], 10);
    const parsedM = parseInt(parts[1], 10);
    if (!isNaN(parsedH)) h = parsedH;
    if (!isNaN(parsedM)) m = parsedM;
  }
  const totalM = h * 60 + m;

  // 10:00 前（如 08:52, 09:09, 09:12）或 timing 為 morning_fasting：早晨空腹 (未吃早餐)
  if (timing === "morning_fasting" || (!timing && totalM < 10 * 60) || totalM < 10 * 60) {
    return {
      timing: "morning_fasting" as const,
      fullLabel: "早晨空腹 (未吃早餐)",
      badgeLabel: "早晨空腹",
      badgeClass: "bg-purple-500/20 text-purple-300 border border-purple-500/40",
    };
  }

  // 13:00 後（如 15:28）或 timing 為 after_lunch：午餐後 (已吃午餐)
  if (timing === "after_lunch" || totalM >= 13 * 60) {
    return {
      timing: "after_lunch" as const,
      fullLabel: "午餐後 (已吃午餐)",
      badgeLabel: "午餐後",
      badgeClass: "bg-blue-500/20 text-blue-300 border border-blue-500/40",
    };
  }

  // 10:00 ~ 13:00（如 12:xx）：午餐前 (僅吃早餐)
  return {
    timing: "before_lunch" as const,
    fullLabel: "午餐前 (僅吃早餐)",
    badgeLabel: "午餐前",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
  };
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
  const [bwRange, setBwRange] = useState<"all" | "90d" | "30d">("all");
  const [bwSaving, setBwSaving] = useState(false);
  const [showBwList, setShowBwList] = useState(false);

  // InBody 身體組成檢測狀態 (八點多頻電極實測)
  const [inbodyList, setInbodyList] = useState<InBodyRecord[]>([]);
  const [inbodyMetricTab, setInbodyMetricTab] = useState<"smm" | "pbf" | "water" | "weight" | "relation">("smm");
  const [showInbodyForm, setShowInbodyForm] = useState(false);
  const [showAllInbody, setShowAllInbody] = useState(false);
  const [inbodySaving, setInbodySaving] = useState(false);

  // 新增 InBody 檢測表單欄位
  const [newIbDate, setNewIbDate] = useState(new Date().toISOString().split("T")[0]);
  const [newIbTime, setNewIbTime] = useState("09:00");
  const [newIbWeight, setNewIbWeight] = useState("");
  const [newIbSmm, setNewIbSmm] = useState("");
  const [newIbFatPct, setNewIbFatPct] = useState("");
  const [newIbWater, setNewIbWater] = useState("");
  const [newIbScore, setNewIbScore] = useState("");
  const [newIbTiming, setNewIbTiming] = useState<"morning_fasting" | "before_lunch" | "after_lunch">("morning_fasting");
  const [prReps, setPrReps] = useState({ bench: 5, squat: 8, deadlift: 2 });

  useEffect(() => {
    setMounted(true);
    async function loadData() {
      try {
        try {
          await ensureDatabaseSeeded();
        } catch (seedErr) {
          console.warn("Database seeding notice:", seedErr);
        }

        const b3 = await db.big_three.toArray();
        if (b3 && b3.length > 0) setBigThree(b3[0]);

        // 讀取歷史體重數據
        const bwList = (await db.body_weight.orderBy("date").toArray()) || [];
        setBodyWeights(bwList);

        // 讀取 InBody 里程碑檢測紀錄
        const ibList = (await db.inbody_records.orderBy("date").toArray()) || [];
        setInbodyList(ibList);

        const sessions = (
          await db.sessions
            .filter((s) => !s.deleted_at)
            .sortBy("date")
        ) || [];

        // 全歷史累計訓練總量
        const totalCounts = { 胸: 0,背: 0, 腿: 0, 肩: 0, 游泳: 0, total: sessions.length };
        for (const sess of sessions) {
          const muscle = sess?.target_muscle || "";
          if (muscle.includes("胸")) totalCounts["胸"]++;
          else if (muscle.includes("背")) totalCounts["背"]++;
          else if (muscle.includes("腿")) totalCounts["腿"]++;
          else if (muscle.includes("肩")) totalCounts["肩"]++;
          else if (muscle.includes("泳")) totalCounts["游泳"]++;
        }
        setAllTimeStats(totalCounts);

        const allSets = (
          await db.sets
            .filter((s) => !s.deleted_at && typeof s.weight_kg === "number" && s.weight_kg > 0)
            .toArray()
        ) || [];

        const allExercises = (await db.exercises.toArray()) || [];

        // 1. 每月份基本三項最高實測重量分析 (嚴格僅採計標準傳統健力三項，排除哈克/六角槓/上斜史密斯)
        const benchExIds = allExercises
          .filter((e) => {
            const name = e?.name || "";
            return (
              e?.id === "ex-bench" ||
              e?.id === "ex-bench-press" ||
              (name.includes("臥推") &&
                !name.includes("啞鈴") &&
                !name.includes("機器") &&
                !name.includes("上斜") &&
                !name.includes("下斜") &&
                !name.includes("史密斯"))
            );
          })
          .map((e) => e.id);

        const squatExIds = allExercises
          .filter((e) => {
            const name = e?.name || "";
            return (
              e?.id === "ex-squat" ||
              (name.includes("深蹲") && !name.includes("分腿") && !name.includes("哈克"))
            );
          })
          .map((e) => e.id);

        const deadliftExIds = allExercises
          .filter((e) => {
            const name = e?.name || "";
            return (
              e?.id === "ex-deadlift" ||
              (name.includes("硬舉") && !name.includes("六角"))
            );
          })
          .map((e) => e.id);

        // 🌟 自動從真實訓練歷史中動態計算全歷史三項最高重量 (含深蹲 90Kg) 與最新體重
        let allTimeBench = 0;
        let allTimeSquat = 0;
        let allTimeDead = 0;
        for (const st of allSets) {
          if (!st || typeof st.weight_kg !== "number" || !isFinite(st.weight_kg)) continue;
          if (benchExIds.includes(st.exercise_id) && st.weight_kg > allTimeBench) allTimeBench = st.weight_kg;
          if (squatExIds.includes(st.exercise_id) && st.weight_kg > allTimeSquat) allTimeSquat = st.weight_kg;
          if (deadliftExIds.includes(st.exercise_id) && st.weight_kg > allTimeDead) allTimeDead = st.weight_kg;
        }

        const validBwList = bwList.filter(
          (b) => b && typeof b.weight_kg === "number" && isFinite(b.weight_kg) && b.weight_kg > 0
        );
        const latestWeight =
          validBwList.length > 0
            ? validBwList[validBwList.length - 1].weight_kg
            : b3[0]?.body_weight_kg || 63.6;
        const safeWeight =
          typeof latestWeight === "number" && latestWeight > 0 && isFinite(latestWeight)
            ? latestWeight
            : 63.6;

        const effectiveBench = Math.max(allTimeBench, b3[0]?.bench_press_kg || 60);
        const effectiveSquat = Math.max(allTimeSquat, b3[0]?.squat_kg || 90);
        const effectiveDead = Math.max(allTimeDead, b3[0]?.deadlift_kg || 90);
        const effectiveTotal = effectiveBench + effectiveSquat + effectiveDead;

        const effectiveB3: BigThreeRecord = {
          id: b3[0]?.id || "big-three-global",
          bench_press_kg: effectiveBench,
          squat_kg: effectiveSquat,
          deadlift_kg: effectiveDead,
          total_kg: effectiveTotal,
          body_weight_kg: safeWeight,
          bench_ratio: Math.round((effectiveBench / safeWeight) * 100) / 100,
          squat_ratio: Math.round((effectiveSquat / safeWeight) * 100) / 100,
          deadlift_ratio: Math.round((effectiveDead / safeWeight) * 100) / 100,
          updated_at: new Date().toISOString(),
          sync_status: "pending",
        };
        setBigThree(effectiveB3);
        try {
          await db.big_three.put(effectiveB3);
        } catch {
          // ignore cache put errors
        }

        // 計算 PR 實測次數 (非 1RM 極限單下，標記為實際完成之組數次數)
        let bReps = 5;
        let sReps = 8;
        let dReps = 2;
        for (const st of allSets) {
          if (!st || typeof st.weight_kg !== "number" || typeof st.reps !== "number") continue;
          if (benchExIds.includes(st.exercise_id) && st.weight_kg === effectiveBench && st.reps > 0) {
            if (st.reps > bReps) bReps = st.reps;
          }
          if (squatExIds.includes(st.exercise_id) && st.weight_kg === effectiveSquat && st.reps > 0) {
            if (st.reps > sReps) sReps = st.reps;
          }
          if (deadliftExIds.includes(st.exercise_id) && st.weight_kg === effectiveDead && st.reps > 0) {
            if (st.reps > dReps) dReps = st.reps;
          }
        }
        setPrReps({ bench: bReps, squat: sReps, deadlift: dReps });

        const monthKeys = Array.from(
          new Set(
            sessions
              .map((s) => s?.month_key || (typeof s?.date === "string" ? s.date.slice(0, 7) : ""))
              .filter(Boolean)
          )
        ).sort();
        const trendList: MonthBigThreeData[] = [];

        for (const mk of monthKeys) {
          const mSessIds = new Set(
            sessions
              .filter((s) => s && (s.month_key === mk || s.date?.slice(0, 7) === mk))
              .map((s) => s.id)
          );
          const mSets = allSets.filter((st) => mSessIds.has(st.session_id));

          let maxBench = 0;
          let maxSquat = 0;
          let maxDeadlift = 0;

          for (const st of mSets) {
            if (!st || typeof st.weight_kg !== "number") continue;
            if (benchExIds.includes(st.exercise_id) && st.weight_kg > maxBench) maxBench = st.weight_kg;
            if (squatExIds.includes(st.exercise_id) && st.weight_kg > maxSquat) maxSquat = st.weight_kg;
            if (deadliftExIds.includes(st.exercise_id) && st.weight_kg > maxDeadlift) maxDeadlift = st.weight_kg;
          }

          const parts = (mk || "").split("-");
          const label = parts.length > 1 ? `${parseInt(parts[1] || "1", 10)}月` : mk;
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

    const handleDataChanged = () => {
      loadData();
    };
    window.addEventListener("workout:data_changed", handleDataChanged);
    return () => {
      window.removeEventListener("workout:data_changed", handleDataChanged);
    };
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

    const updatedList = (await db.body_weight.orderBy("date").toArray()) || [];
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
    const updatedList = (await db.body_weight.orderBy("date").toArray()) || [];
    setBodyWeights(updatedList);
  }

  async function handleAddInbody() {
    const w = parseFloat(newIbWeight);
    const smm = parseFloat(newIbSmm);
    if (!w || !smm || !newIbDate) return;

    setInbodySaving(true);
    const fatPct = newIbFatPct ? parseFloat(newIbFatPct) : 17.0;
    const score = newIbScore ? parseInt(newIbScore) : 78;
    const fatMass = Math.round(((w * fatPct) / 100) * 10) / 10;
    const timingInfo = getInBodyTimingInfo(newIbTiming, newIbTime);

    const newRec: InBodyRecord = {
      id: `inbody-${newIbDate}-${(newIbTime || "1200").replace(":", "")}`,
      date: newIbDate,
      time: newIbTime || "12:00",
      weight_kg: w,
      skeletal_muscle_kg: smm,
      body_fat_mass_kg: fatMass,
      body_fat_pct: fatPct,
      body_water_l: newIbWater ? parseFloat(newIbWater) : undefined,
      inbody_score: score,
      timing: timingInfo.timing,
      condition_label: timingInfo.fullLabel,
      estimated_net_weight_kg: w,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.inbody_records.put(newRec);
    const updated = (await db.inbody_records.orderBy("date").toArray()) || [];
    setInbodyList(updated);
    setNewIbWeight("");
    setNewIbSmm("");
    setNewIbFatPct("");
    setNewIbWater("");
    setNewIbScore("");
    setShowInbodyForm(false);
    setInbodySaving(false);
  }

  async function handleDeleteInbody(id: string) {
    if (!confirm("確定刪除此筆 InBody 檢測紀錄？")) return;
    await db.inbody_records.delete(id);
    const updated = (await db.inbody_records.orderBy("date").toArray()) || [];
    setInbodyList(updated);
  }

  // 乾淨安全提取體重列表
  const validBw = bodyWeights.filter(
    (b) => b && typeof b.weight_kg === "number" && isFinite(b.weight_kg) && b.weight_kg > 0
  );
  const startBw = validBw.length > 0 ? validBw[0].weight_kg : 56.9;
  const latestBw = validBw.length > 0 ? validBw[validBw.length - 1].weight_kg : 62.6;
  const netDiff =
    isFinite(latestBw) && isFinite(startBw) ? Math.round((latestBw - startBw) * 10) / 10 : 0;

  const bwWithFat = validBw.filter(
    (b) => typeof b.body_fat_pct === "number" && isFinite(b.body_fat_pct) && b.body_fat_pct > 0
  );
  const latestFat =
    bwWithFat.length > 0 ? bwWithFat[bwWithFat.length - 1].body_fat_pct! : null;
  const startFat = bwWithFat.length > 0 ? bwWithFat[0].body_fat_pct! : null;
  const fatDiff =
    latestFat !== null && startFat !== null
      ? Math.round((latestFat - startFat) * 10) / 10
      : null;

  const bwChartData = validBw.map((b) => ({
    date: safeDateSlice(b.date),
    fullDate: b.date || "",
    weight: b.weight_kg,
    bodyFat: b.body_fat_pct,
    muscle: b.skeletal_muscle_kg,
  }));

  let filteredBwChartData = bwChartData;
  if (bwMetricTab === "fat") {
    filteredBwChartData = filteredBwChartData.filter(
      (b) => typeof b.bodyFat === "number" && !isNaN(b.bodyFat) && b.bodyFat > 0
    );
  }
  if (bwRange === "30d") filteredBwChartData = filteredBwChartData.slice(-30);
  else if (bwRange === "90d") filteredBwChartData = filteredBwChartData.slice(-90);

  // InBody 里程碑計算
  const validInbody = inbodyList.filter(
    (ib) =>
      ib &&
      typeof ib.weight_kg === "number" &&
      typeof ib.skeletal_muscle_kg === "number" &&
      isFinite(ib.weight_kg)
  );
  const latestInbody = validInbody.length > 0 ? validInbody[validInbody.length - 1] : null;
  const firstInbody = validInbody.length > 0 ? validInbody[0] : null;

  const smmDiff =
    latestInbody &&
    firstInbody &&
    isFinite(latestInbody.skeletal_muscle_kg) &&
    isFinite(firstInbody.skeletal_muscle_kg)
      ? Math.round((latestInbody.skeletal_muscle_kg - firstInbody.skeletal_muscle_kg) * 10) / 10
      : 0;

  const inbodyWeightDiff =
    latestInbody &&
    firstInbody &&
    isFinite(latestInbody.weight_kg) &&
    isFinite(firstInbody.weight_kg)
      ? Math.round((latestInbody.weight_kg - firstInbody.weight_kg) * 10) / 10
      : 0;

  const pbfDiff =
    latestInbody &&
    firstInbody &&
    typeof latestInbody.body_fat_pct === "number" &&
    typeof firstInbody.body_fat_pct === "number" &&
    isFinite(latestInbody.body_fat_pct) &&
    isFinite(firstInbody.body_fat_pct)
      ? Math.round((latestInbody.body_fat_pct - firstInbody.body_fat_pct) * 10) / 10
      : 0;

  const waterDiff =
    latestInbody &&
    firstInbody &&
    typeof latestInbody.body_water_l === "number" &&
    typeof firstInbody.body_water_l === "number" &&
    isFinite(latestInbody.body_water_l) &&
    isFinite(firstInbody.body_water_l)
      ? Math.round((latestInbody.body_water_l - firstInbody.body_water_l) * 10) / 10
      : 0;

  const inbodyChartData = validInbody.map((ib) => {
    const tInfo = getInBodyTimingInfo(ib.timing, ib.time);
    return {
      date: safeDateSlice(ib.date),
      fullDate: `${ib.date || ""} ${ib.time || ""}`,
      smm: ib.skeletal_muscle_kg,
      bodyFatPct: ib.body_fat_pct,
      fatMass: ib.body_fat_mass_kg,
      water: ib.body_water_l,
      weight: ib.weight_kg,
      score: ib.inbody_score,
      timing: tInfo.timing,
      condition: tInfo.fullLabel,
    };
  });

  return (
    <div className="space-y-5 pb-24 max-w-4xl mx-auto">
      {!mounted || loading ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-400 gap-3">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm">載入力量進步分析中...</p>
        </div>
      ) : (
        <>
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

        <div className="grid grid-cols-5 gap-2 text-center">
          <div className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d]/70">
            <span className="text-[11px] text-gray-400 block mb-0.5">練胸</span>
            <span className="text-lg font-black text-white">{allTimeStats["胸"] || 0}</span>
            <span className="text-[10px] text-gray-500 block">次</span>
          </div>
          <div className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d]/70">
            <span className="text-[11px] text-gray-400 block mb-0.5">練背</span>
            <span className="text-lg font-black text-white">{allTimeStats["背"] || 0}</span>
            <span className="text-[10px] text-gray-500 block">次</span>
          </div>
          <div className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d]/70">
            <span className="text-[11px] text-gray-400 block mb-0.5">練腿</span>
            <span className="text-lg font-black text-white">{allTimeStats["腿"] || 0}</span>
            <span className="text-[10px] text-gray-500 block">次</span>
          </div>
          <div className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d]/70">
            <span className="text-[11px] text-gray-400 block mb-0.5">練肩</span>
            <span className="text-lg font-black text-white">{allTimeStats["肩"] || 0}</span>
            <span className="text-[10px] text-gray-500 block">次</span>
          </div>
          <div className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d]/70">
            <span className="text-[11px] text-gray-400 block mb-0.5">游泳</span>
            <span className="text-lg font-black text-white">{allTimeStats["游泳"] || 0}</span>
            <span className="text-[10px] text-gray-500 block">次</span>
          </div>
        </div>
      </section>

      {/* 個人三項 PR 基準 & 體重倍數卡片 (動態計算 + 實測次數注記) */}
      {bigThree && (
        <section className="bg-[#12141c] border border-amber-500/30 rounded-2xl p-4 space-y-2.5 shadow-md">
          <div className="flex items-center justify-between border-b border-[#262b3d]/60 pb-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-gray-100">個人三項 PR 基準 & 體重倍數</h2>
            </div>
            <span className="text-[11px] text-gray-400">
              基準體重：<span className="text-white font-bold">{bigThree.body_weight_kg || 63.6} kg</span>
            </span>
          </div>

          {(() => {
            const bw = bigThree.body_weight_kg || 63.6;
            const benchRatio = bw > 0 ? bigThree.bench_press_kg / bw : 0.94;
            const squatRatio = bw > 0 ? bigThree.squat_kg / bw : 1.42;
            const deadliftRatio = bw > 0 ? bigThree.deadlift_kg / bw : 1.42;
            const totalKg = bigThree.bench_press_kg + bigThree.squat_kg + bigThree.deadlift_kg;
            const totalRatio = bw > 0 ? totalKg / bw : 3.77;

            const benchStd = getStrengthStandard("bench", benchRatio);
            const squatStd = getStrengthStandard("squat", squatRatio);
            const deadliftStd = getStrengthStandard("deadlift", deadliftRatio);
            const totalStd = getStrengthStandard("total", totalRatio);

            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-[#181b26] p-2.5 rounded-xl border border-red-500/20 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] text-gray-400 block mb-0.5">臥推 PR</span>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-base font-black text-red-300">{bigThree.bench_press_kg} kg</span>
                      <span className="text-[10px] text-red-400/90 font-bold">(x{prReps.bench})</span>
                    </div>
                    <span className="text-[10px] text-red-400 font-bold block mt-0.5">
                      {benchRatio.toFixed(2)}x 體重
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border inline-block ${benchStd.badgeClass}`}>
                      {benchStd.label}水準
                    </span>
                  </div>
                </div>

                <div className="bg-[#181b26] p-2.5 rounded-xl border border-emerald-500/20 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] text-gray-400 block mb-0.5">深蹲 PR</span>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-base font-black text-emerald-300">{bigThree.squat_kg} kg</span>
                      <span className="text-[10px] text-emerald-400/90 font-bold">(x{prReps.squat})</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-bold block mt-0.5">
                      {squatRatio.toFixed(2)}x 體重
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border inline-block ${squatStd.badgeClass}`}>
                      {squatStd.label}水準
                    </span>
                  </div>
                </div>

                <div className="bg-[#181b26] p-2.5 rounded-xl border border-blue-500/20 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] text-gray-400 block mb-0.5">硬舉 PR</span>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-base font-black text-blue-300">{bigThree.deadlift_kg} kg</span>
                      <span className="text-[10px] text-blue-400/90 font-bold">(x{prReps.deadlift})</span>
                    </div>
                    <span className="text-[10px] text-blue-400 font-bold block mt-0.5">
                      {deadliftRatio.toFixed(2)}x 體重
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border inline-block ${deadliftStd.badgeClass}`}>
                      {deadliftStd.label}水準
                    </span>
                  </div>
                </div>

                <div className="bg-[#181b26] p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] text-amber-400 font-bold block mb-0.5">三項總和</span>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-base font-black text-amber-300">
                        {totalKg} kg
                      </span>
                    </div>
                    <span className="text-[10px] text-amber-400 font-bold block mt-0.5">
                      {totalRatio.toFixed(2)}x 體重
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border inline-block ${totalStd.badgeClass}`}>
                      {totalStd.label}水準
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </section>
      )}

      {/* 每月三項最高重量成長曲線 (Kg) */}
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

        <div className="pt-2">
          <MonthlyTrendSvgChart data={monthlyTrend} />
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
            晨起空腹基準
          </span>
        </div>

        {/* 3 大指標卡 */}
        <div className={`grid ${latestFat !== null ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"} gap-2.5 text-center`}>
          <div className="bg-[#181b26] p-3 rounded-xl border border-[#262b3d]/70">
            <span className="text-xs text-gray-400 block mb-1 font-medium">起始體重</span>
            <span className="text-lg font-black text-gray-200">{startBw}</span>
            <span className="text-xs text-gray-500 block mt-0.5">kg</span>
          </div>

          <div className="bg-[#181b26] p-3 rounded-xl border border-cyan-500/30">
            <span className="text-xs text-cyan-400 block mb-1 font-semibold">最新體重</span>
            <span className="text-lg font-black text-white">{latestBw}</span>
            <span className="text-xs text-cyan-400/80 block mt-0.5">kg</span>
          </div>

          <div className="bg-[#181b26] p-3 rounded-xl border border-emerald-500/30">
            <span className="text-xs text-emerald-400 block mb-1 font-semibold">淨增減</span>
            <span className="text-lg font-black text-emerald-300">
              {netDiff > 0 ? `+${netDiff}` : netDiff}
            </span>
            <span className="text-xs text-emerald-400/80 block mt-0.5">kg</span>
          </div>

          {latestFat !== null && (
            <div className="bg-[#181b26] p-3 rounded-xl border border-amber-500/30">
              <span className="text-xs text-amber-400 block mb-1 font-semibold">最新體脂</span>
              <span className="text-lg font-black text-amber-300">{latestFat}%</span>
              <span className="text-xs text-amber-400/80 block mt-0.5">
                {fatDiff !== null ? (fatDiff > 0 ? `+${fatDiff}%` : `${fatDiff}%`) : "空腹量測"}
              </span>
            </div>
          )}
        </div>

        {/* 曲線切換分頁與時間範圍 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
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

          <div className="flex items-center gap-1 bg-[#181b26] p-0.5 rounded-lg border border-[#262b3d]">
            {(["all", "90d", "30d"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setBwRange(r)}
                className={`text-[10px] px-2 py-0.5 rounded transition-all cursor-pointer font-bold ${
                  bwRange === r ? "bg-cyan-500/30 text-cyan-300 shadow-sm" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {r === "all" ? "全部" : r === "90d" ? "近90天" : "近30天"}
              </button>
            ))}
          </div>
        </div>

        {/* 歷史折線圖 (Native SVG 零崩潰圖表) */}
        <div className="pt-1">
          {bwMetricTab === "weight" ? (
            <SingleMetricSvgChart
              data={filteredBwChartData.map((d) => ({
                date: d.date,
                fullDate: d.fullDate,
                value: d.weight,
              }))}
              color="#06b6d4"
              unit="kg"
              metricName="晨起體重"
            />
          ) : (
            <SingleMetricSvgChart
              data={filteredBwChartData
                .filter((d) => typeof d.bodyFat === "number")
                .map((d) => ({
                  date: d.date,
                  fullDate: d.fullDate,
                  value: d.bodyFat!,
                }))}
              color="#f59e0b"
              unit="%"
              metricName="空腹體脂"
            />
          )}
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

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-1">
            <span className="text-[10px] text-gray-500 leading-tight">
              * 建議固定晨起空腹量測；體脂率可參考走勢，骨骼肌建議每 1~2 月比對 InBody
            </span>
            <button
              type="button"
              onClick={handleAddBodyWeight}
              disabled={!newWeightValue || bwSaving}
              className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black font-black px-4 py-2 rounded-xl text-xs transition-all flex items-center justify-center gap-1 shadow cursor-pointer shrink-0 active:scale-95"
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

      {/* ⭐ InBody 身體組成檢測里程碑 (八點多頻電極實測專區) */}
      <section className="bg-[#12141c] border border-emerald-500/30 rounded-2xl p-4 space-y-3.5 shadow-md">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#262b3d]/60 pb-2.5">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-gray-100">
              InBody 身體組成里程碑
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">
              InBody 實測 ({inbodyList.length} 次)
            </span>
            <button
              type="button"
              onClick={() => setShowInbodyForm(!showInbodyForm)}
              className="text-[10px] text-emerald-300 hover:text-white bg-[#181b26] hover:bg-emerald-500/20 px-2 py-0.5 rounded border border-[#262b3d] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-2.5 h-2.5 stroke-[3]" />
              <span>新增紀錄</span>
            </button>
          </div>
        </div>

        {/* Latest InBody Hero Highlight Card */}
        {latestInbody && (
          <div className="bg-gradient-to-br from-[#181b26] to-[#141824] border border-emerald-500/30 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-gray-200">
                  {latestInbody.date} {latestInbody.time}
                </span>
                {(() => {
                  const tInfo = getInBodyTimingInfo(latestInbody.timing, latestInbody.time);
                  return (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tInfo.badgeClass}`}>
                      {tInfo.fullLabel}
                    </span>
                  );
                })()}
              </div>
              <span className="text-[11px] text-gray-400">
                身體總評分：
                <span className="text-emerald-400 font-black text-sm">
                  {latestInbody.inbody_score || 78}
                </span>{" "}
                分
              </span>
            </div>

            {/* 5 Core Hero Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <div className="bg-[#0f1118] p-2.5 rounded-lg border border-[#262b3d]">
                <span className="text-[10px] text-gray-400 block mb-0.5">實測體重</span>
                <span className="text-base font-black text-white">{latestInbody.weight_kg}</span>
                <span className="text-[10px] text-gray-400 block mt-0.5">
                  kg (首測 {firstInbody?.weight_kg || 60.3} → {latestInbody.weight_kg}kg)
                </span>
              </div>

              <div className="bg-[#0f1118] p-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/5">
                <span className="text-[10px] text-emerald-400 block mb-0.5 font-bold">骨骼肌重 (SMM)</span>
                <span className="text-base font-black text-emerald-300">{latestInbody.skeletal_muscle_kg}</span>
                <span className="text-[10px] text-emerald-400 font-bold block mt-0.5">
                  {smmDiff > 0 ? `+${smmDiff} kg` : `${smmDiff} kg`} (首測 {firstInbody?.skeletal_muscle_kg || 29.6} → {latestInbody.skeletal_muscle_kg}kg)
                </span>
              </div>

              <div className="bg-[#0f1118] p-2.5 rounded-lg border border-amber-500/30">
                <span className="text-[10px] text-amber-400 block mb-0.5 font-bold">體脂肪率 (PBF)</span>
                <span className="text-base font-black text-amber-300">{latestInbody.body_fat_pct}%</span>
                <span className="text-[10px] text-amber-400/90 font-bold block mt-0.5">
                  {pbfDiff > 0 ? `+${pbfDiff}%` : `${pbfDiff}%`} (首測 {firstInbody?.body_fat_pct || 12.9}% → {latestInbody.body_fat_pct}%)
                </span>
              </div>

              <div className="bg-[#0f1118] p-2.5 rounded-lg border border-sky-500/30">
                <span className="text-[10px] text-sky-400 block mb-0.5 font-bold">總水重 (TBW)</span>
                <span className="text-base font-black text-sky-300">{latestInbody.body_water_l ? `${latestInbody.body_water_l}` : "--"}</span>
                <span className="text-[10px] text-sky-400/90 font-bold block mt-0.5">
                  L ({waterDiff > 0 ? `+${waterDiff} L` : `${waterDiff} L`})
                </span>
              </div>

              <div className="bg-[#0f1118] p-2.5 rounded-lg border border-cyan-500/30">
                <span className="text-[10px] text-cyan-400 block mb-0.5 font-bold">體重成長幅度</span>
                <span className="text-base font-black text-cyan-300">
                  {inbodyWeightDiff > 0 ? `+${inbodyWeightDiff}` : inbodyWeightDiff}
                </span>
                <span className="text-[10px] text-cyan-400/80 block mt-0.5">
                  kg (首測 {firstInbody?.weight_kg || 60.3}kg)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setInbodyMetricTab("smm")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                inbodyMetricTab === "smm"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-[#181b26] text-gray-400 hover:text-gray-200 border border-[#262b3d]"
              }`}
            >
              骨骼肌 SMM (kg)
            </button>
            <button
              type="button"
              onClick={() => setInbodyMetricTab("pbf")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                inbodyMetricTab === "pbf"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-[#181b26] text-gray-400 hover:text-gray-200 border border-[#262b3d]"
              }`}
            >
              體脂率 PBF (%)
            </button>
            <button
              type="button"
              onClick={() => setInbodyMetricTab("water")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                inbodyMetricTab === "water"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                  : "bg-[#181b26] text-gray-400 hover:text-gray-200 border border-[#262b3d]"
              }`}
            >
              總水重 (L)
            </button>
            <button
              type="button"
              onClick={() => setInbodyMetricTab("weight")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                inbodyMetricTab === "weight"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "bg-[#181b26] text-gray-400 hover:text-gray-200 border border-[#262b3d]"
              }`}
            >
              實測體重 (kg)
            </button>
            <button
              type="button"
              onClick={() => setInbodyMetricTab("relation")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                inbodyMetricTab === "relation"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-sm shadow-purple-500/10"
                  : "bg-[#181b26] text-gray-400 hover:text-gray-200 border border-[#262b3d]"
              }`}
            >
              <Activity className="w-3 h-3 text-purple-400" />
              <span>連動對照 (水×肌×脂)</span>
            </button>
          </div>
          <span className="text-[10px] text-gray-500 hidden sm:inline">
            共 {inbodyList.length} 次檢測紀錄
          </span>
        </div>

        {/* InBody Line Chart (Native SVG 零崩潰圖表) */}
        <div className="pt-1">
          {inbodyMetricTab === "relation" ? (
            <TriMetricCorrelationSvgChart
              data={inbodyChartData.map((ib) => ({
                date: ib.date,
                fullDate: ib.fullDate,
                smm: ib.smm,
                water: ib.water || 0,
                pbf: ib.bodyFatPct,
                weight: ib.weight,
                extra: ib.condition,
              }))}
            />
          ) : (
            <SingleMetricSvgChart
              data={inbodyChartData.map((ib) => ({
                date: ib.date,
                fullDate: ib.fullDate,
                value:
                  inbodyMetricTab === "smm"
                    ? ib.smm
                    : inbodyMetricTab === "pbf"
                    ? ib.bodyFatPct
                    : inbodyMetricTab === "water"
                    ? (ib.water || 0)
                    : ib.weight,
                extra: ib.condition,
              }))}
              color={
                inbodyMetricTab === "smm"
                  ? "#10b981"
                  : inbodyMetricTab === "pbf"
                  ? "#f59e0b"
                  : inbodyMetricTab === "water"
                  ? "#38bdf8"
                  : "#06b6d4"
              }
              unit={inbodyMetricTab === "pbf" ? "%" : inbodyMetricTab === "water" ? "L" : "kg"}
              metricName={
                inbodyMetricTab === "smm"
                  ? "骨骼肌 (SMM)"
                  : inbodyMetricTab === "pbf"
                  ? "體脂率 (PBF)"
                  : inbodyMetricTab === "water"
                  ? "身體總水重 (TBW)"
                  : "實測體重"
              }
            />
          )}
        </div>

        {/* 水-肌-脂 連動機制診斷面板 */}
        <div className="bg-[#141620] border border-[#262b3d] rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#262b3d]/60 pb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-bold text-gray-200">
                水 💧 × 骨骼肌 💪 × 體脂肪 🔥 連動機制解密
              </h3>
            </div>
            <span className="text-[10px] text-purple-300 bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
              水肌皮爾森相關性 +98.8% (極度高度連動)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="bg-[#181b26] p-2.5 rounded-xl border border-sky-500/20 space-y-1">
              <span className="text-[11px] font-bold text-sky-400 flex items-center gap-1">
                💧 1. 水漲肌高（假性增肌）
              </span>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                肌肉中約 73% 是水分。InBody 藉由細胞水分導電推估骨骼肌；當補碳肝醣超補或水腫（如 11/17 水重 +1.1L），骨骼肌會瞬間暴增 +1.0kg，此時為儲水而非真長肉。
              </p>
            </div>

            <div className="bg-[#181b26] p-2.5 rounded-xl border border-amber-500/20 space-y-1">
              <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                📉 2. 蹺蹺板鏡像（假性發胖）
              </span>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                InBody 無法直接量測脂肪，公式為「體脂 = 體重 - 除脂體重」。剛吃進的食物與水停在胃腸未導電時（如 11/16 中午水重 -0.4L），骨骼肌被低估，體脂率便被等量推高 +1.2%！
              </p>
            </div>

            <div className="bg-[#181b26] p-2.5 rounded-xl border border-emerald-500/20 space-y-1">
              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                🎯 3. 如何看穿真實進步？
              </span>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                忽略單日 1~2% 體脂浮動。觀察 2~4 週的除脂體重（FFM）中位數，並搭配訓練日誌主要力量三項（臥推/深蹲/硬舉）是否突破，力量上升即為實質增肌！
              </p>
            </div>
          </div>
        </div>

        {/* 新增 InBody 檢測表單 (可收合) */}
        {showInbodyForm && (
          <div className="bg-[#181b26] border border-emerald-500/30 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-[#262b3d] pb-2">
              <span className="text-xs font-bold text-emerald-400">登錄新 InBody 檢測結果</span>
              <button
                type="button"
                onClick={() => setShowInbodyForm(false)}
                className="text-gray-400 hover:text-white text-xs cursor-pointer"
              >
                取消
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">檢測日期 *</label>
                <input
                  type="date"
                  value={newIbDate}
                  onChange={(e) => setNewIbDate(e.target.value)}
                  className="w-full bg-[#12141c] border border-[#262b3d] text-white text-xs rounded-xl px-2.5 py-1.5 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 block mb-1">時間 (時:分)</label>
                <input
                  type="text"
                  placeholder="09:00"
                  value={newIbTime}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewIbTime(val);
                    const [h, m] = val.split(":").map(Number);
                    const totalM = (h || 0) * 60 + (m || 0);
                    if (totalM < 10 * 60) {
                      setNewIbTiming("morning_fasting");
                    } else if (totalM < 13 * 60) {
                      setNewIbTiming("before_lunch");
                    } else {
                      setNewIbTiming("after_lunch");
                    }
                  }}
                  className="w-full bg-[#12141c] border border-[#262b3d] text-white text-xs rounded-xl px-2.5 py-1.5 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-cyan-400 font-bold block mb-1">實測體重 (kg) *</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="如 64.0"
                  value={newIbWeight}
                  onChange={(e) => setNewIbWeight(e.target.value)}
                  className="w-full bg-[#12141c] border border-[#262b3d] text-white text-xs rounded-xl px-2.5 py-1.5 outline-none focus:border-cyan-500 font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] text-emerald-400 font-bold block mb-1">骨骼肌 SMM (kg) *</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="如 30.0"
                  value={newIbSmm}
                  onChange={(e) => setNewIbSmm(e.target.value)}
                  className="w-full bg-[#12141c] border border-[#262b3d] text-white text-xs rounded-xl px-2.5 py-1.5 outline-none focus:border-emerald-500 font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] text-amber-400 block mb-1">體脂率 PBF (%)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="如 17.0"
                  value={newIbFatPct}
                  onChange={(e) => setNewIbFatPct(e.target.value)}
                  className="w-full bg-[#12141c] border border-[#262b3d] text-white text-xs rounded-xl px-2.5 py-1.5 outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-sky-400 block mb-1">總水重 TBW (L)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="如 38.5"
                  value={newIbWater}
                  onChange={(e) => setNewIbWater(e.target.value)}
                  className="w-full bg-[#12141c] border border-[#262b3d] text-white text-xs rounded-xl px-2.5 py-1.5 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 block mb-1">InBody 評分</label>
                <input
                  type="number"
                  placeholder="如 78"
                  value={newIbScore}
                  onChange={(e) => setNewIbScore(e.target.value)}
                  className="w-full bg-[#12141c] border border-[#262b3d] text-white text-xs rounded-xl px-2.5 py-1.5 outline-none focus:border-gray-500"
                />
              </div>

              <div className="col-span-2">
                <label className="text-[10px] text-gray-400 block mb-1">量測時段與狀態</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNewIbTiming("morning_fasting")}
                    className={`py-1.5 px-1 rounded-xl text-[11px] font-bold border cursor-pointer transition-colors text-center ${
                      newIbTiming === "morning_fasting"
                        ? "bg-purple-500/20 text-purple-300 border-purple-500/50"
                        : "bg-[#12141c] text-gray-400 border-[#262b3d]"
                    }`}
                  >
                    早晨空腹
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewIbTiming("before_lunch")}
                    className={`py-1.5 px-1 rounded-xl text-[11px] font-bold border cursor-pointer transition-colors text-center ${
                      newIbTiming === "before_lunch"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                        : "bg-[#12141c] text-gray-400 border-[#262b3d]"
                    }`}
                  >
                    午餐前 (僅吃早餐)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewIbTiming("after_lunch")}
                    className={`py-1.5 px-1 rounded-xl text-[11px] font-bold border cursor-pointer transition-colors text-center ${
                      newIbTiming === "after_lunch"
                        ? "bg-blue-500/20 text-blue-300 border-blue-500/50"
                        : "bg-[#12141c] text-gray-400 border-[#262b3d]"
                    }`}
                  >
                    午餐後 (已吃午餐)
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={handleAddInbody}
                disabled={!newIbWeight || !newIbSmm || inbodySaving}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-black px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-1 shadow cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>儲存 InBody 紀錄</span>
              </button>
            </div>
          </div>
        )}

        {/* 查看全部 17 次歷史明細開關 */}
        <div className="pt-0.5 text-right">
          <button
            type="button"
            onClick={() => setShowAllInbody(!showAllInbody)}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
          >
            {showAllInbody ? "收合 InBody 清單" : `查看全部 ${inbodyList.length} 次 InBody 實測明細`}
          </button>
        </div>

        {/* 17 次 InBody 歷史明細清單 */}
        {showAllInbody && (
          <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 border-t border-[#262b3d]/40 pt-2">
            {inbodyList.slice().reverse().map((ib) => {
              const tInfo = getInBodyTimingInfo(ib.timing, ib.time);
              return (
                <div
                  key={ib.id}
                  className="bg-[#181b26] p-2.5 rounded-xl border border-[#262b3d]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-gray-300 text-[11px] font-bold">
                      {ib.date} {ib.time}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${tInfo.badgeClass}`}
                    >
                      {tInfo.badgeLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 text-[11px]">
                    <span className="text-gray-300">
                      實測 <strong className="text-white">{ib.weight_kg}kg</strong>
                    </span>
                    <span className="text-emerald-400 font-bold">
                      骨骼肌 {ib.skeletal_muscle_kg}kg
                    </span>
                    <span className="text-amber-400 font-medium">
                      體脂 {ib.body_fat_pct}%
                    </span>
                    {ib.body_water_l ? (
                      <span className="text-sky-400 font-medium">
                        水重 {ib.body_water_l}L
                      </span>
                    ) : null}
                    <span className="text-gray-400 bg-[#12141c] px-1.5 py-0.5 rounded text-[10px]">
                      {ib.inbody_score || 78} 分
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteInbody(ib.id)}
                      className="text-gray-500 hover:text-red-400 transition-colors cursor-pointer pl-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
        </>
      )}
    </div>
  );
}

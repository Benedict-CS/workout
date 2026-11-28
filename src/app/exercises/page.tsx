"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Dumbbell,
  Search,
  Plus,
  X,
  CheckCircle2,
  Star,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Layers,
  ArrowDownAZ,
  AlertTriangle,
  Check,
  Info,
  Sparkles,
  Calculator,
  History,
  Calendar,
} from "lucide-react";
import { db } from "@/lib/db/schema";
import { runFullSync, deleteRemoteExercise } from "@/lib/db/sync";
import { calculate1RM, calculateBarbellPlates, generateWarmupPlan } from "@/lib/calc";
import type { Exercise, MuscleGroup, WeightType, WorkoutSession, SetItem } from "@/lib/types";

// 舊版重複動作 ID 映射至 Canonical 標準 ID
const LEGACY_ID_MAP: Record<string, string> = {
  "ex-bench-press": "ex-bench",
  "ex-flat-dumbbell": "ex-db-bench",
  "ex-db-flat-press": "ex-db-bench",
  "ex-flat-dumbbell-press": "ex-db-bench",
  "ex-incline-dumbbell": "ex-db-incline-bench",
  "ex-incline-db-press": "ex-db-incline-bench",
  "ex-incline-barbell-press": "ex-incline-bench",
  "ex-db-row": "ex-db-single-row",
  "ex-one-arm-dumbbell-row": "ex-db-single-row",
  "ex-pec-deck": "ex-pec-fly",
  "ex-machine-incline-press": "ex-incline-machine-bench",
  "ex-chest-press": "ex-chest-press-seated",
  "ex-seated-row-machine": "ex-seated-row-wide",
  "ex-seated-row": "ex-seated-row-wide",
  "ex-tricep-press-chest": "ex-dip-pushdown-machine",
  "ex-hex-deadlift": "ex-trap-bar-deadlift",
  "ex-lat-row-machine": "ex-high-row",
  "ex-seated-back-row-machine": "ex-seated-cable-row",
  "ex-lying-leg-curl": "ex-leg-curl",
  "ex-bulgarian-split-squat": "ex-bulgarian-squat",
  "ex-dumbbell-shoulder-press": "ex-db-shoulder-press",
  "ex-face-pull": "ex-cable-face-pull",
  "ex-reverse-pec-deck": "ex-reverse-pec-fly",
  "ex-rope-tricep-pushdown": "ex-rope-tricep",
  "ex-dumbbell-hammer-curl": "ex-db-hammer-curl",
  "ex-incline-dumbbell-curl": "ex-incline-db-curl",
};

interface ExerciseStat {
  exercise: Exercise;
  totalSets: number;
  maxWeight: number;
  maxWeightReps: number;
  bestSet: string;
  bestSetDetail?: string;
  isAssisted: boolean;
  isSwimming: boolean;
}

type SortMode = "sets" | "pr" | "name";

const MUSCLE_TABS = ["全部", "胸", "背", "腿", "肩", "手臂", "核心", "其他"] as const;
type MuscleTab = (typeof MUSCLE_TABS)[number];

// 預設核心動作清單（不可任意物理刪除，僅自訂動作允許刪除）
const CANONICAL_IDS = new Set([
  "ex-bench",
  "ex-incline-bench",
  "ex-decline-bench",
  "ex-smith-bench",
  "ex-db-bench",
  "ex-db-incline-bench",
  "ex-pec-fly",
  "ex-chest-press-machine",
  "ex-chest-press-seated",
  "ex-incline-machine-bench",
  "ex-dip-pushdown-machine",
  "ex-rope-tricep",
  "ex-cable-crossover",
  "ex-assisted-dip",
  "ex-squat",
  "ex-leg-press",
  "ex-leg-curl",
  "ex-bulgarian-squat",
  "ex-leg-extension",
  "ex-hack-squat",
  "ex-deadlift",
  "ex-trap-bar-deadlift",
  "ex-pullup",
  "ex-assisted-pullup",
  "ex-lat-pulldown",
  "ex-high-row",
  "ex-underhand-pulldown",
  "ex-seated-row-wide",
  "ex-seated-row-close",
  "ex-seated-cable-row",
  "ex-barbell-row",
  "ex-db-single-row",
  "ex-db-hammer-curl",
  "ex-incline-db-curl",
  "ex-db-lateral-raise",
  "ex-db-shoulder-press",
  "ex-cable-lateral-raise",
  "ex-cable-face-pull",
  "ex-reverse-pec-fly",
  "ex-swim",
]);

function isCustomExercise(ex: Exercise): boolean {
  if (ex.id.startsWith("custom-")) return true;
  if (/^ex-\d+$/.test(ex.id)) return true;
  return !CANONICAL_IDS.has(ex.id);
}

// 負重設備類型設定與解說
interface WeightTypeConfig {
  value: WeightType;
  label: string;
  tag: string;
  desc: string;
  example: string;
}

const WEIGHT_TYPE_CONFIGS: WeightTypeConfig[] = [
  {
    value: "barbell_total",
    label: "🏋️ 雙手總重 (槓鈴)",
    tag: "🏋️ 槓鈴總重",
    desc: "記錄槓鈴空槓加上全部槓片的雙手總合重量",
    example: "例如：槓鈴臥推、深蹲、硬舉",
  },
  {
    value: "dumbbell_single",
    label: "🦾 單手啞鈴 (單邊)",
    tag: "🦾 啞鈴單手",
    desc: "兩手各拿一隻，以單手持握重量為記錄基準",
    example: "例如：側平舉 12kg、單手啞鈴划船",
  },
  {
    value: "machine_stack",
    label: "⚙️ 插銷機器 (固定/滑輪)",
    tag: "⚙️ 插銷/滑輪",
    desc: "以機器插銷片數或掛片總重量為準",
    example: "例如：滑輪下拉、蝴蝶機夾胸、腿推機",
  },
  {
    value: "bodyweight",
    label: "🤸 自體體重 (自重動作)",
    tag: "🤸 徒手自重",
    desc: "僅以自身體重為阻力，主要記錄完成次數",
    example: "例如：自重引體向上、雙槓臂屈伸、伏地挺身",
  },
  {
    value: "machine_single",
    label: "⚙️ 單邊機械 (左右獨立)",
    tag: "⚙️ 單邊機械",
    desc: "左右手獨立活動之掛片式單邊訓練器",
    example: "例如：高拉單臂划船機、單邊上斜胸推機",
  },
  {
    value: "assisted_inverse",
    label: "⚖️ 反向輔助 (越重越輕)",
    tag: "⚖️ 反向輔助",
    desc: "輔助配重越重向上推力越大，實際本體負重越輕",
    example: "例如：輔助引體向上機、輔助雙槓臂屈伸機",
  },
];

function getWeightTypeLabel(type: WeightType): string {
  const match = WEIGHT_TYPE_CONFIGS.find((c) => c.value === type);
  return match ? match.tag : "一般負重";
}

// 部位專屬色彩配置（暗黑健身美學）
function getMuscleTheme(muscle: string) {
  switch (muscle) {
    case "胸":
      return {
        badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
        bar: "bg-cyan-400",
        activeTab: "bg-cyan-500 text-black shadow-md shadow-cyan-500/25 border-cyan-400",
      };
    case "背":
      return {
        badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
        bar: "bg-emerald-400",
        activeTab: "bg-emerald-500 text-black shadow-md shadow-emerald-500/25 border-emerald-400",
      };
    case "腿":
      return {
        badge: "bg-purple-500/15 text-purple-300 border-purple-500/30",
        bar: "bg-purple-400",
        activeTab: "bg-purple-500 text-white shadow-md shadow-purple-500/25 border-purple-400",
      };
    case "肩":
      return {
        badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
        bar: "bg-amber-400",
        activeTab: "bg-amber-400 text-black shadow-md shadow-amber-400/25 border-amber-300",
      };
    case "手臂":
      return {
        badge: "bg-pink-500/15 text-pink-300 border-pink-500/30",
        bar: "bg-pink-400",
        activeTab: "bg-pink-500 text-black shadow-md shadow-pink-500/25 border-pink-400",
      };
    case "核心":
      return {
        badge: "bg-orange-500/15 text-orange-300 border-orange-500/30",
        bar: "bg-orange-400",
        activeTab: "bg-orange-500 text-black shadow-md shadow-orange-500/25 border-orange-400",
      };
    case "游泳":
      return {
        badge: "bg-sky-500/15 text-sky-300 border-sky-500/30",
        bar: "bg-sky-400",
        activeTab: "bg-sky-500 text-black shadow-md shadow-sky-500/25 border-sky-400",
      };
    default:
      return {
        badge: "bg-slate-500/15 text-slate-300 border-slate-500/30",
        bar: "bg-slate-400",
        activeTab: "bg-slate-300 text-black shadow-md shadow-slate-300/25 border-slate-200",
      };
  }
}

export default function ExercisesPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ExerciseStat[]>([]);
  const [search, setSearch] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleTab>("全部");
  const [sortMode, setSortMode] = useState<SortMode>("sets");
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // 新增動作 Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMuscle, setNewMuscle] = useState<MuscleGroup>("胸");
  const [newWeightType, setNewWeightType] = useState<WeightType>("barbell_total");
  const [newNotes, setNewNotes] = useState("");

  // 編輯動作 Modal
  const [editingEx, setEditingEx] = useState<Exercise | null>(null);
  const [editName, setEditName] = useState("");
  const [editMuscle, setEditMuscle] = useState<MuscleGroup>("胸");
  const [editWeightType, setEditWeightType] = useState<WeightType>("barbell_total");
  const [editNotes, setEditNotes] = useState("");

  // 二次確認刪除 Modal
  const [deletingEx, setDeletingEx] = useState<Exercise | null>(null);

  // 槓鈴片配重 & 熱身組試算器 Modal
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcTargetWeight, setCalcTargetWeight] = useState<number>(60);
  const [calcBarWeight, setCalcBarWeight] = useState<number>(20);

  // 動作歷史做組軌跡 Modal
  const [viewingHistoryEx, setViewingHistoryEx] = useState<Exercise | null>(null);
  const [exerciseHistoryList, setExerciseHistoryList] = useState<{
    sessionId: string;
    date: string;
    title: string;
    sets: SetItem[];
  }[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  async function handleOpenHistory(e: React.MouseEvent, ex: Exercise) {
    e.stopPropagation();
    setViewingHistoryEx(ex);
    setLoadingHistory(true);
    try {
      const allExIds = [ex.id];
      for (const [legacyId, canonicalId] of Object.entries(LEGACY_ID_MAP)) {
        if (canonicalId === ex.id && !allExIds.includes(legacyId)) allExIds.push(legacyId);
      }
      const matchingSets = await db.sets
        .filter((s) => !s.deleted_at && allExIds.includes(s.exercise_id))
        .toArray();

      const sessionIds = Array.from(new Set(matchingSets.map((s) => s.session_id)));
      const sessions = await db.sessions.where("id").anyOf(sessionIds).toArray();

      const historyList = sessions
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((sess) => {
          const sSets = matchingSets
            .filter((s) => s.session_id === sess.id)
            .sort((a, b) => a.set_order - b.set_order);
          return {
            sessionId: sess.id,
            date: sess.date,
            title: sess.display_title,
            sets: sSets,
          };
        });

      setExerciseHistoryList(historyList);
    } catch (err) {
      console.error("載入歷史動作失敗:", err);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function loadData() {
    setLoading(true);
    const rawExList = await db.exercises
      .filter((e) => !e.deleted_at && !e.name.includes("繩索夾胸"))
      .toArray();
    const allSets = await db.sets.filter((s) => !s.deleted_at).toArray();
    const allSessions = await db.sessions.toArray();
    const sessionMap = new Map<string, WorkoutSession>();
    for (const sess of allSessions) {
      sessionMap.set(sess.id, sess);
    }

    // 1. 去重與合併重複動作 (以標準動作名稱與 ID 為準，排除 legacy 重複項目)
    const dedupedExMap = new Map<string, Exercise>();
    for (const ex of rawExList) {
      const canonicalId = LEGACY_ID_MAP[ex.id] || ex.id;
      // 若該舊 ID 屬於別名，且目標 canonical 已存在或即將存在，跳過該舊項目
      if (LEGACY_ID_MAP[ex.id]) {
        const canonical = dedupedExMap.get(canonicalId);
        if (canonical && ex.is_favorite) {
          canonical.is_favorite = true;
        }
        continue;
      }
      // 依名稱去重 (避免重複同名動作)
      const existing = Array.from(dedupedExMap.values()).find((e) => e.name === ex.name);
      if (existing) {
        if (ex.is_favorite) existing.is_favorite = true;
        continue;
      }
      dedupedExMap.set(ex.id, ex);
    }
    const allEx = Array.from(dedupedExMap.values());

    // 2. 映射組數到 canonical ID，使臥推、啞鈴臥推、上斜等所有歷史組數 100% 聚合
    const setsByExId = new Map<string, typeof allSets>();
    for (const s of allSets) {
      const cId = LEGACY_ID_MAP[s.exercise_id] || s.exercise_id;
      let listC = setsByExId.get(cId);
      if (!listC) {
        listC = [];
        setsByExId.set(cId, listC);
      }
      listC.push(s);

      if (s.exercise_id !== cId) {
        let listRaw = setsByExId.get(s.exercise_id);
        if (!listRaw) {
          listRaw = [];
          setsByExId.set(s.exercise_id, listRaw);
        }
        listRaw.push(s);
      }
    }

    const calculated: ExerciseStat[] = allEx.map((ex) => {
      const canonicalExId = LEGACY_ID_MAP[ex.id] || ex.id;
      const setListA = setsByExId.get(ex.id) || [];
      const setListB = canonicalExId !== ex.id ? setsByExId.get(canonicalExId) || [] : [];
      const combinedMap = new Map<string, (typeof allSets)[0]>();
      for (const s of [...setListA, ...setListB]) {
        combinedMap.set(s.id, s);
      }
      const exSets = Array.from(combinedMap.values());
      const isSwimming = ex.id === "ex-swim" || ex.name.includes("游泳");
      const isAssisted = ex.weight_type === "assisted_inverse" || ex.name.includes("輔助");

      let maxWeight = 0;
      let maxWeightReps = 0;
      let bestSet = "";
      let bestSetDetail = "";

      for (const s of exSets) {
        let isBetter = false;
        if (s.weight_kg > maxWeight || (s.weight_kg === maxWeight && s.reps > maxWeightReps)) {
          isBetter = true;
        } else if (maxWeight === 0 && s.reps > maxWeightReps) {
          isBetter = true;
        }

        if (isBetter) {
          maxWeight = s.weight_kg;
          maxWeightReps = s.reps;
          bestSet = s.raw_text || `${s.weight_kg}Kg x ${s.reps}`;
          const sess = sessionMap.get(s.session_id);
          if (sess) {
            const datePart = sess.date ? sess.date.slice(5).replace("-", "/") : "";
            const locPart = sess.location ? ` ${sess.location}` : "";
            bestSetDetail = `${datePart}${locPart}`.trim();
          }
        }
      }

      return {
        exercise: ex,
        totalSets: exSets.length,
        maxWeight,
        maxWeightReps,
        bestSet: bestSet || "尚未開始記錄",
        bestSetDetail,
        isAssisted,
        isSwimming,
      };
    });

    setStats(calculated);
    setLoading(false);
  }

  useEffect(() => {
    loadData();

    const handleDataChanged = () => {
      loadData();
    };
    window.addEventListener("workout:data_changed", handleDataChanged);
    return () => {
      window.removeEventListener("workout:data_changed", handleDataChanged);
    };
  }, []);

  // 部位分類動作數量統計
  const muscleCounts = useMemo(() => {
    const counts: Record<string, number> = {
      全部: stats.length,
      胸: 0,
      背: 0,
      腿: 0,
      肩: 0,
      手臂: 0,
      核心: 0,
      其他: 0,
    };
    for (const item of stats) {
      const m = item.exercise.muscle_group;
      if (m === "胸" || m === "背" || m === "腿" || m === "肩" || m === "手臂" || m === "核心") {
        counts[m]++;
      } else {
        counts["其他"]++;
      }
    }
    return counts;
  }, [stats]);

  // 即時切換最愛星號
  async function handleToggleFavorite(ex: Exercise) {
    const updated = !ex.is_favorite;
    setStats((prev) =>
      prev.map((item) =>
        item.exercise.id === ex.id
          ? { ...item, exercise: { ...item.exercise, is_favorite: updated } }
          : item
      )
    );

    await db.exercises.update(ex.id, {
      is_favorite: updated,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    });
    runFullSync().catch(() => {});
  }

  // 儲存新增自訂動作
  async function handleCreateExercise() {
    if (!newName.trim()) return;

    const newEx: Exercise = {
      id: `custom-ex-${Date.now()}`,
      name: newName.trim(),
      muscle_group: newMuscle,
      weight_type: newWeightType,
      default_notes: newNotes.trim() || undefined,
      is_favorite: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.exercises.add(newEx);
    setNewName("");
    setNewNotes("");
    setShowAddModal(false);
    runFullSync().catch(() => {});
    await loadData();
  }

  // 開啟編輯
  function handleStartEdit(ex: Exercise) {
    setEditingEx(ex);
    setEditName(ex.name);
    setEditMuscle(ex.muscle_group);
    setEditWeightType(ex.weight_type);
    setEditNotes(ex.default_notes || "");
  }

  // 儲存編輯更新
  async function handleSaveEdit() {
    if (!editingEx || !editName.trim()) return;

    const updated: Exercise = {
      ...editingEx,
      name: editName.trim(),
      muscle_group: editMuscle,
      weight_type: editWeightType,
      default_notes: editNotes.trim() || undefined,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.exercises.put(updated);
    setEditingEx(null);
    runFullSync().catch(() => {});
    await loadData();
  }

  // 二次確認後刪除動作
  async function handleConfirmDelete() {
    if (!deletingEx) return;
    const targetId = deletingEx.id;
    setDeletingEx(null);

    setStats((prev) => prev.filter((item) => item.exercise.id !== targetId));

    await db.exercises.delete(targetId);
    deleteRemoteExercise(targetId).catch(() => {});
    runFullSync().catch(() => {});
  }

  // 篩選與排序計算 (零跳動、零跑版)
  const filteredAndSorted = useMemo(() => {
    const filtered = stats.filter((st) => {
      if (onlyFavorites && !st.exercise.is_favorite) return false;

      if (selectedMuscle !== "全部") {
        if (selectedMuscle === "其他") {
          const standardGroups = ["胸", "背", "腿", "肩", "手臂", "核心"];
          if (standardGroups.includes(st.exercise.muscle_group)) return false;
        } else {
          if (st.exercise.muscle_group !== selectedMuscle) return false;
        }
      }

      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const matchName = st.exercise.name.toLowerCase().includes(query);
        const matchNotes = (st.exercise.default_notes || "").toLowerCase().includes(query);
        const matchMuscle = st.exercise.muscle_group.toLowerCase().includes(query);
        if (!matchName && !matchNotes && !matchMuscle) return false;
      }

      return true;
    });

    return filtered.sort((a, b) => {
      // 1. 最愛星號置頂
      if (a.exercise.is_favorite && !b.exercise.is_favorite) return -1;
      if (!a.exercise.is_favorite && b.exercise.is_favorite) return 1;

      // 2. 依選擇的排序模式
      if (sortMode === "sets") {
        if (b.totalSets !== a.totalSets) return b.totalSets - a.totalSets;
        if (b.maxWeight !== a.maxWeight) return b.maxWeight - a.maxWeight;
        return a.exercise.name.localeCompare(b.exercise.name, "zh-Hant");
      }
      if (sortMode === "pr") {
        if (b.maxWeight !== a.maxWeight) return b.maxWeight - a.maxWeight;
        if (b.totalSets !== a.totalSets) return b.totalSets - a.totalSets;
        return a.exercise.name.localeCompare(b.exercise.name, "zh-Hant");
      }
      if (sortMode === "name") {
        return a.exercise.name.localeCompare(b.exercise.name, "zh-Hant");
      }
      return 0;
    });
  }, [stats, onlyFavorites, selectedMuscle, search, sortMode]);

  return (
    <div className="space-y-4 pb-28 max-w-2xl mx-auto">
      {/* 頂部導航列 */}
      <div className="flex items-center justify-between">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-400 transition-colors py-1 group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>返回設定</span>
        </Link>

        <span className="text-[11px] text-gray-400 flex items-center gap-1 font-mono">
          <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />
          動作庫管理
        </span>
      </div>

      {/* 頁面標題與自訂新增按鈕 */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>精選動作庫</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
              {stats.length} 動作
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">專注核心動作、實測最高重量紀錄</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCalculator(true)}
            className="bg-[#121520] hover:bg-[#181b26] border border-[#262b3d] text-emerald-400 hover:text-emerald-300 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shrink-0"
            title="開啟槓鈴片配重與熱身組試算器"
          >
            <Calculator className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">槓片/熱身試算</span>
            <span className="sm:hidden">試算器</span>
          </button>

          <button
            onClick={() => {
              setNewName(search.trim());
              setShowAddModal(true);
            }}
            className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black px-3.5 py-2 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>自訂動作</span>
          </button>
        </div>
      </div>

      {/* 搜尋框與最愛開關列 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="搜尋動作名稱、備註或器材..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#121520] border border-[#262b3d] text-white text-xs rounded-xl pl-9 pr-9 py-2.5 outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/30 transition-all placeholder:text-gray-400"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="清除搜尋"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 最愛釘選篩選鈕 */}
        <button
          onClick={() => setOnlyFavorites(!onlyFavorites)}
          className={`px-3 py-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition-all shrink-0 cursor-pointer ${
            onlyFavorites
              ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm shadow-amber-500/20"
              : "bg-[#121520] border-[#262b3d] text-gray-400 hover:text-gray-200 hover:bg-[#181b26]"
          }`}
          title={onlyFavorites ? "顯示全部動作" : "僅顯示常用星號動作"}
        >
          <Star className={`w-3.5 h-3.5 ${onlyFavorites ? "fill-amber-400 text-amber-400" : ""}`} />
          <span className="hidden sm:inline">常用置頂</span>
        </button>
      </div>

      {/* 部位篩選膠囊按鈕列 (水平捲動、顯示各部位動作總數) */}
      <div className="overflow-x-auto no-scrollbar -mx-1 px-1 py-0.5">
        <div className="flex items-center gap-1.5 min-w-max">
          {MUSCLE_TABS.map((tab) => {
            const isSelected = selectedMuscle === tab;
            const theme = getMuscleTheme(tab);
            const count = muscleCounts[tab] || 0;

            return (
              <button
                key={tab}
                onClick={() => setSelectedMuscle(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                  isSelected
                    ? tab === "全部"
                      ? "bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-500/20 font-black"
                      : theme.activeTab
                    : "bg-[#121520] hover:bg-[#181b26] text-gray-400 hover:text-gray-200 border-[#262b3d]"
                }`}
              >
                <span>{tab}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected
                      ? tab === "腿"
                        ? "bg-white/20 text-white"
                        : "bg-black/20 text-black font-black"
                      : "bg-[#181b26] text-gray-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 排序切換器與搜尋計數回饋列 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 border-t border-[#262b3d]/60">
        <div className="text-xs text-gray-400 flex items-center gap-1.5">
          {search ? (
            <>
              <span>
                找到 <strong className="text-emerald-400 font-bold">{filteredAndSorted.length}</strong> 個符合「{search}」的動作
              </span>
              <button
                onClick={() => setSearch("")}
                className="text-[11px] text-gray-400 hover:text-white underline cursor-pointer"
              >
                清除
              </button>
            </>
          ) : (
            <span>
              顯示 <strong className="text-white font-bold">{filteredAndSorted.length}</strong> / {stats.length} 個動作
              {selectedMuscle !== "全部" && `（${selectedMuscle}部）`}
              {onlyFavorites && "（僅常用星號）"}
            </span>
          )}
        </div>

        {/* 排序切換分段膠囊 */}
        <div className="flex items-center gap-1 bg-[#121520] p-1 rounded-xl border border-[#262b3d] shrink-0 self-stretch sm:self-auto justify-between sm:justify-start">
          <button
            onClick={() => setSortMode("sets")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              sortMode === "sets"
                ? "bg-emerald-500 text-black shadow-sm font-black"
                : "text-gray-400 hover:text-white"
            }`}
            title="依累計訓練組數高至低排序"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>最多組數</span>
          </button>

          <button
            onClick={() => setSortMode("pr")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              sortMode === "pr"
                ? "bg-amber-400 text-black shadow-sm font-black"
                : "text-gray-400 hover:text-white"
            }`}
            title="依歷史個人最佳重量高至低排序"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>最高 PR</span>
          </button>

          <button
            onClick={() => setSortMode("name")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              sortMode === "name"
                ? "bg-cyan-400 text-black shadow-sm font-black"
                : "text-gray-400 hover:text-white"
            }`}
            title="依動作筆劃與名稱排序"
          >
            <ArrowDownAZ className="w-3.5 h-3.5" />
            <span>名稱 A-Z</span>
          </button>
        </div>
      </div>

      {/* 動作卡片清單 */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-xs flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <span>正在載入動作庫與歷史紀錄...</span>
        </div>
      ) : filteredAndSorted.length === 0 ? (
        /* 查無結果友善反饋與極速新增 */
        <div className="text-center py-12 px-4 bg-[#121520] border border-[#262b3d] rounded-2xl space-y-3.5 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-[#181b26] border border-[#262b3d] flex items-center justify-center mx-auto text-gray-400">
            <Search className="w-6 h-6 text-gray-400" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white">找不到符合條件的動作</h4>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              {search
                ? `資料庫中尚未建立「${search}」，您可以直接點擊下方按鈕自訂新增！`
                : "此篩選條件下目前無動作，可嘗試切換部位或取消常用篩選。"}
            </p>
          </div>

          <button
            onClick={() => {
              setNewName(search.trim());
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black px-4 py-2 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>立即自訂新增「{search.trim() || "新動作"}」</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredAndSorted.map((item) => {
            const theme = getMuscleTheme(item.exercise.muscle_group);
            const isCustom = isCustomExercise(item.exercise);

            return (
              <div
                key={item.exercise.id}
                className="bg-[#121520] border border-[#262b3d] hover:border-[#3b4259] rounded-2xl p-3.5 sm:p-4 space-y-3 transition-all duration-150 shadow-sm relative overflow-hidden group"
              >
                {/* 左側微光指示條 (跟隨部位色彩) */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${theme.bar} transition-all group-hover:w-1.5`}
                />

                {/* 卡片標題與控制按鈕 */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    {/* 最愛釘選星號 */}
                    <button
                      onClick={() => handleToggleFavorite(item.exercise)}
                      className="p-1 -ml-1 text-gray-500 hover:text-amber-400 hover:scale-110 active:scale-95 transition-all cursor-pointer shrink-0 mt-0.5"
                      title={item.exercise.is_favorite ? "取消最愛釘選" : "加入最愛並置頂"}
                    >
                      <Star
                        className={`w-4 h-4 transition-colors ${
                          item.exercise.is_favorite
                            ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                            : "text-gray-500 hover:text-gray-300"
                        }`}
                      />
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-gray-100 text-sm sm:text-base tracking-tight truncate">
                          {item.exercise.name}
                        </h3>

                        {/* 部位顏色標籤 */}
                        <span
                          className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md border ${theme.badge}`}
                        >
                          {item.exercise.muscle_group}
                        </span>

                        {/* 設備型態標籤 */}
                        <span className="text-[10px] text-gray-400 bg-[#181b26] border border-[#262b3d] px-1.5 py-0.5 rounded-md">
                          {getWeightTypeLabel(item.exercise.weight_type)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 右側操作按鈕 (編輯 / 刪除) */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleStartEdit(item.exercise)}
                      className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-[#181b26] rounded-lg transition-colors active:scale-95 cursor-pointer"
                      title="編輯動作名稱與設定"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    {isCustom && (
                      <button
                        onClick={() => setDeletingEx(item.exercise)}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors active:scale-95 cursor-pointer"
                        title="刪除此自訂動作"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 統計膠囊列 (組數與 PR) */}
                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  {/* 累積訓練組數膠囊 */}
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#181b26] border border-[#262b3d] text-xs text-gray-300">
                    <Layers className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>
                      {item.isSwimming ? (
                        <>
                          完成 <strong className="text-white font-bold">{item.totalSets}</strong> 場泳訓
                        </>
                      ) : (
                        <>
                          累積訓練 <strong className="text-white font-bold">{item.totalSets}</strong> 組
                        </>
                      )}
                    </span>
                  </div>

                  {/* 歷史最佳 PR 膠囊 */}
                  {item.isSwimming ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-300">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>專項有氧心肺訓練</span>
                    </div>
                  ) : item.isAssisted ? (
                    <div
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs text-purple-300"
                      title="反向配重：配重為輔助減重磅數"
                    >
                      <Trophy className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>
                        輔助配重:{" "}
                        <strong className="text-white font-bold">{item.maxWeight} kg</strong>
                        {item.maxWeightReps > 0 && (
                          <span className="text-purple-200/90 ml-1">× {item.maxWeightReps} 下</span>
                        )}
                        {item.bestSetDetail && (
                          <span className="text-gray-400 font-normal ml-1.5 text-[11px]">
                            ({item.bestSetDetail})
                          </span>
                        )}
                      </span>
                    </div>
                  ) : item.maxWeight > 0 ? (
                    (() => {
                      const est1RM = item.maxWeight > 0 && item.maxWeightReps > 0 ? calculate1RM(item.maxWeight, item.maxWeightReps) : 0;
                      return (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex-wrap">
                          <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>
                            歷史最佳 PR:{" "}
                            <strong className="text-white font-bold">{item.maxWeight} kg</strong>
                            {item.maxWeightReps > 0 && (
                              <span className="text-amber-200/90 ml-1">× {item.maxWeightReps} 下</span>
                            )}
                            {item.bestSetDetail && (
                              <span className="text-gray-400 font-normal ml-1.5 text-[11px]">
                                ({item.bestSetDetail})
                              </span>
                            )}
                          </span>

                          {est1RM > 0 && item.maxWeightReps > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCalcTargetWeight(item.maxWeight);
                                setShowCalculator(true);
                              }}
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border border-amber-400/40 transition-colors cursor-pointer"
                              title="點擊依此重量開啟槓片配重試算"
                            >
                              估算 1RM ~{est1RM}kg ⚡
                            </button>
                          )}
                        </div>
                      );
                    })()
                  ) : item.totalSets > 0 ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                      <Trophy className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>
                        歷史最佳 PR:{" "}
                        <strong className="text-white font-bold">
                          {item.maxWeightReps > 0 ? `${item.maxWeightReps} 下 (自重)` : "自重完成"}
                        </strong>
                        {item.bestSetDetail && (
                          <span className="text-gray-400 font-normal ml-1.5 text-[11px]">
                            ({item.bestSetDetail})
                          </span>
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#181b26]/50 border border-[#262b3d]/40 text-xs text-gray-400">
                      <span>尚未開始記錄</span>
                    </div>
                  )}
                </div>

                {/* 歷史做組軌跡快捷按鈕 */}
                {item.totalSets > 0 && !item.isSwimming && (
                  <div className="pt-0.5 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={(e) => handleOpenHistory(e, item.exercise)}
                      className="text-[11px] font-bold text-gray-400 hover:text-emerald-400 flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5 text-emerald-400" />
                      <span>查看歷史做組軌跡 ({item.totalSets} 組) ➔</span>
                    </button>
                  </div>
                )}

                {/* 預設備註 (如有) */}
                {item.exercise.default_notes && (
                  <div className="bg-[#0e1017] border border-[#262b3d]/70 rounded-xl px-3 py-2 text-[11px] text-gray-400 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{item.exercise.default_notes}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 新增動作 Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-[#121520] border border-emerald-500/40 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#262b3d] pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </div>
                <span>自訂新增動作</span>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* 動作名稱 */}
              <div>
                <label className="text-xs text-gray-300 block mb-1.5 font-bold">
                  動作名稱 <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="例如：雙槓臂屈伸、側平舉、羅馬尼亞硬舉..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 transition-all placeholder:text-gray-400"
                  autoFocus
                />
              </div>

              {/* 訓練部位膠囊選取 */}
              <div>
                <label className="text-xs text-gray-300 block mb-1.5 font-bold">訓練部位</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(["胸", "背", "腿", "肩", "手臂", "核心", "其他"] as MuscleGroup[]).map((m) => {
                    const isSelected = newMuscle === m;
                    const theme = getMuscleTheme(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setNewMuscle(m)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          isSelected
                            ? theme.activeTab
                            : "bg-[#181b26] border-[#262b3d] text-gray-400 hover:text-white"
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 負重設備類型卡片選擇 */}
              <div>
                <label className="text-xs text-gray-300 block mb-1.5 font-bold">
                  負重類型說明（影響組數重量統計與計算）
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto no-scrollbar pr-0.5">
                  {WEIGHT_TYPE_CONFIGS.map((cfg) => {
                    const isSelected = newWeightType === cfg.value;
                    return (
                      <div
                        key={cfg.value}
                        onClick={() => setNewWeightType(cfg.value)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-emerald-500/15 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500/30"
                            : "bg-[#181b26] border-[#262b3d] text-gray-400 hover:border-gray-500 hover:text-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-xs font-bold ${
                              isSelected ? "text-emerald-300" : "text-gray-200"
                            }`}
                          >
                            {cfg.label}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />}
                        </div>
                        <p className="text-[10px] text-gray-400 leading-tight mb-1">{cfg.desc}</p>
                        <span className="text-[9px] text-gray-400 font-mono block">{cfg.example}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 預設備註 */}
              <div>
                <label className="text-xs text-gray-300 block mb-1.5 font-bold">
                  預設備註 / 器材調整孔位 (選填)
                </label>
                <textarea
                  rows={2}
                  placeholder="例如：座椅孔位 4 號、中寬握距、離心 3 秒、頂峰停頓 1 秒..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.1)] transition-all resize-none placeholder:text-gray-400"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-[#262b3d]">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-[#181b26] hover:bg-[#262b3d] text-gray-300 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateExercise}
                disabled={!newName.trim()}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                <span>儲存至動作庫</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 修改動作 Modal */}
      {editingEx && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setEditingEx(null)}
        >
          <div
            className="bg-[#121520] border border-emerald-500/40 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#262b3d] pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Pencil className="w-4 h-4" />
                </div>
                <span>編輯動作設定</span>
              </div>
              <button
                onClick={() => setEditingEx(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* 動作名稱 */}
              <div>
                <label className="text-xs text-gray-300 block mb-1.5 font-bold">動作名稱</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 transition-all"
                />
              </div>

              {/* 部位選取 */}
              <div>
                <label className="text-xs text-gray-300 block mb-1.5 font-bold">部位分類</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(["胸", "背", "腿", "肩", "手臂", "核心", "其他"] as MuscleGroup[]).map((m) => {
                    const isSelected = editMuscle === m;
                    const theme = getMuscleTheme(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setEditMuscle(m)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          isSelected
                            ? theme.activeTab
                            : "bg-[#181b26] border-[#262b3d] text-gray-400 hover:text-white"
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 負重類型選擇 */}
              <div>
                <label className="text-xs text-gray-300 block mb-1.5 font-bold">負重類型設定</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto no-scrollbar pr-0.5">
                  {WEIGHT_TYPE_CONFIGS.map((cfg) => {
                    const isSelected = editWeightType === cfg.value;
                    return (
                      <div
                        key={cfg.value}
                        onClick={() => setEditWeightType(cfg.value)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-emerald-500/15 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500/30"
                            : "bg-[#181b26] border-[#262b3d] text-gray-400 hover:border-gray-500 hover:text-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-xs font-bold ${
                              isSelected ? "text-emerald-300" : "text-gray-200"
                            }`}
                          >
                            {cfg.label}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />}
                        </div>
                        <p className="text-[10px] text-gray-400 leading-tight mb-1">{cfg.desc}</p>
                        <span className="text-[9px] text-gray-400 font-mono block">{cfg.example}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 備註編輯 */}
              <div>
                <label className="text-xs text-gray-300 block mb-1.5 font-bold">
                  動作備註 / 器材調整
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="例如：座椅孔位 4 號、中寬握距..."
                  className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.1)] transition-all resize-none placeholder:text-gray-400"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-[#262b3d]">
              <button
                type="button"
                onClick={() => setEditingEx(null)}
                className="flex-1 bg-[#181b26] hover:bg-[#262b3d] text-gray-300 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={!editName.trim()}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black py-2.5 rounded-xl text-xs font-black shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
              >
                儲存更新
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 刪除二次確認對話框 (防誤刪) */}
      {deletingEx && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setDeletingEx(null)}
        >
          <div
            className="bg-[#121520] border border-red-500/40 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base">確認刪除動作？</h3>
                <p className="text-[11px] text-gray-400">刪除後此動作將自動作選單中移除</p>
              </div>
            </div>

            <div className="bg-[#181b26] border border-[#262b3d] rounded-xl p-3 text-xs space-y-1.5">
              <div className="text-gray-300 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                <span>【{deletingEx.name}】</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                歷史訓練紀錄中該動作的所有做組資料將會完整保留，僅從動作庫選單中移除。
              </p>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setDeletingEx(null)}
                className="flex-1 bg-[#181b26] hover:bg-[#262b3d] text-gray-300 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                取消保留
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 bg-red-500 hover:bg-red-400 text-white font-black py-2.5 rounded-xl text-xs shadow-lg shadow-red-500/25 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>確定刪除</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 槓鈴片配重 & 科學熱身組試算器 Modal */}
      {showCalculator && (() => {
        const platesResult = calculateBarbellPlates(calcTargetWeight, calcBarWeight);
        const warmupPlan = generateWarmupPlan(calcTargetWeight, calcBarWeight);

        return (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={() => setShowCalculator(false)}
          >
            <div
              className="bg-[#121520] border border-emerald-500/40 rounded-2xl max-w-lg w-full p-4 sm:p-5 space-y-4 shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal 頂部標題 */}
              <div className="flex items-center justify-between border-b border-[#262b3d] pb-3">
                <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Calculator className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-white font-black text-sm sm:text-base">槓鈴片配重 & 熱身試算器</h3>
                    <p className="text-[11px] text-gray-400 font-normal">快速換算單邊掛片與階梯熱身組</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCalculator(false)}
                  className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 空槓重量選擇器 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 flex items-center justify-between">
                  <span>1. 選擇空槓重量</span>
                  <span className="text-emerald-400 font-mono font-black">{calcBarWeight} kg 空槓</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { w: 20, label: "標準槓 20kg", desc: "奧林匹克大槓" },
                    { w: 15, label: "女子槓 15kg", desc: "輕量/女用槓" },
                    { w: 10, label: "短槓 10kg", desc: "EZ曲槓/短槓" },
                    { w: 8, label: "史密斯 8kg", desc: "常見空軌重" },
                  ].map((bar) => (
                    <button
                      key={bar.w}
                      type="button"
                      onClick={() => setCalcBarWeight(bar.w)}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        calcBarWeight === bar.w
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm"
                          : "bg-[#181b26] border-[#262b3d] text-gray-400 hover:text-white hover:bg-[#202533]"
                      }`}
                    >
                      <span className="block text-xs font-black">{bar.label}</span>
                      <span className="block text-[10px] opacity-75">{bar.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 目標總重量調整 (支援微調按鈕與快捷預設) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300 flex items-center justify-between">
                  <span>2. 目標訓練總重 (雙手含槓)</span>
                  <span className="text-amber-400 font-mono font-bold">
                    單邊需掛: <strong className="text-white text-sm font-black">{platesResult.sideWeight}</strong> kg
                  </span>
                </label>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCalcTargetWeight((w) => Math.max(calcBarWeight, Math.round((w - 5) * 10) / 10))}
                    className="flex-1 py-2 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-200 text-xs font-black rounded-xl active:scale-95 transition-all cursor-pointer"
                  >
                    -5
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalcTargetWeight((w) => Math.max(calcBarWeight, Math.round((w - 2.5) * 10) / 10))}
                    className="flex-1 py-2 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-200 text-xs font-black rounded-xl active:scale-95 transition-all cursor-pointer"
                  >
                    -2.5
                  </button>

                  <div className="flex-[2] flex items-center justify-center bg-[#0e1017] border border-[#262b3d] py-1.5 px-3 rounded-xl">
                    <input
                      type="number"
                      step="2.5"
                      min={calcBarWeight}
                      value={calcTargetWeight}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) setCalcTargetWeight(v);
                      }}
                      className="w-20 bg-transparent text-center text-xl font-black font-mono text-emerald-400 outline-none"
                    />
                    <span className="text-xs text-gray-400 font-bold ml-1">kg</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCalcTargetWeight((w) => Math.round((w + 2.5) * 10) / 10)}
                    className="flex-1 py-2 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-200 text-xs font-black rounded-xl active:scale-95 transition-all cursor-pointer"
                  >
                    +2.5
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalcTargetWeight((w) => Math.round((w + 5) * 10) / 10)}
                    className="flex-1 py-2 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-200 text-xs font-black rounded-xl active:scale-95 transition-all cursor-pointer"
                  >
                    +5
                  </button>
                </div>

                {/* 常用預設重量膠囊 */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {[30, 40, 50, 60, 70, 80, 90, 100, 120, 140].map((pw) => (
                    <button
                      key={pw}
                      type="button"
                      onClick={() => setCalcTargetWeight(pw)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold whitespace-nowrap transition-all cursor-pointer ${
                        calcTargetWeight === pw
                          ? "bg-amber-400 text-black font-black shadow-sm"
                          : "bg-[#181b26] text-gray-400 hover:text-white border border-[#262b3d]"
                      }`}
                    >
                      {pw}kg
                    </button>
                  ))}
                </div>
              </div>

              {/* 單邊槓片配重圖解 */}
              <div className="bg-[#181b26] border border-[#262b3d] rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>💡 單邊所需掛片</span>
                    <span className="text-[11px] text-gray-400 font-normal">（左右兩側對稱掛相同配片）</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    單邊: {platesResult.sideWeight} kg
                  </span>
                </div>

                {platesResult.plates.length === 0 ? (
                  <div className="text-center py-3 text-xs text-gray-400 bg-[#0e1017] rounded-xl border border-[#262b3d]/60">
                    僅需空槓 ({calcBarWeight} kg)，兩側無須懸掛槓片
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* 槓片清單膠囊 */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {platesResult.plates.map((p, idx) => (
                        <div
                          key={idx}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black border flex items-center gap-1.5 ${p.color} ${p.textColor} border-black/20 shadow-sm`}
                        >
                          <span>{p.weight} kg</span>
                          <span className="opacity-90">× {p.count} 片</span>
                        </div>
                      ))}
                    </div>

                    {/* 視覺化槓鈴袖套圖解 */}
                    <div className="relative bg-[#0e1017] rounded-xl p-3 border border-[#262b3d]/70 flex items-center justify-center min-h-[64px]">
                      {/* 槓鈴軸心線 */}
                      <div className="absolute left-4 right-4 h-2 bg-gray-600 rounded-full" />
                      {/* 卡扣法蘭環 */}
                      <div className="relative z-10 w-4 h-12 bg-gray-400 border border-gray-300 rounded-sm mr-2 shadow" />

                      {/* 槓鈴袖套上的槓片堆疊 */}
                      <div className="relative z-10 flex items-center gap-1">
                        {platesResult.plates.map((p, pIdx) =>
                          Array.from({ length: p.count }).map((_, cIdx) => {
                            const h = p.weight >= 20 ? "h-14 w-6" : p.weight >= 15 ? "h-12 w-5" : p.weight >= 10 ? "h-11 w-4" : p.weight >= 5 ? "h-9 w-3.5" : "h-7 w-3";
                            return (
                              <div
                                key={`${pIdx}-${cIdx}`}
                                className={`${h} ${p.color} ${p.textColor} rounded-sm flex items-center justify-center font-mono font-black text-[9px] shadow-md border border-black/30`}
                                title={`${p.weight} kg`}
                              >
                                {p.weight >= 5 && <span className="rotate-90">{p.weight}</span>}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* 軸套末端 */}
                      <div className="relative z-10 w-8 h-3 bg-gray-500 rounded-r-sm ml-1" />
                    </div>

                    {platesResult.remaining > 0 && (
                      <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 p-2 rounded-lg">
                        ⚠️ 剩餘 {platesResult.remaining} kg 無法以現有槓片 (1.25kg 以上) 完全整除，請微調目標重量。
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 科學熱身金字塔表 (Warm-up Sets Progression) */}
              {warmupPlan.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-300 flex items-center gap-1">
                      <span>🔥 科學熱身階梯規劃</span>
                    </span>
                    <span className="text-[11px] text-gray-400">保護關節 • 激活神經不力竭</span>
                  </div>

                  <div className="bg-[#181b26] border border-[#262b3d] rounded-xl overflow-hidden divide-y divide-[#262b3d]/60 text-xs">
                    {warmupPlan.map((wp, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono font-black flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="font-bold text-white block">{wp.label}</span>
                            <span className="text-[10px] text-gray-400">{wp.percentage}% 目標強度</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-mono font-black text-emerald-300 text-sm">
                            {wp.weightKg} kg
                          </span>
                          <span className="text-gray-400 font-bold ml-1.5">
                            × {wp.reps} 下
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* 正式目標組 */}
                    <div className="p-2.5 bg-emerald-950/20 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-500 text-black font-mono font-black flex items-center justify-center text-[10px]">
                          ★
                        </span>
                        <div>
                          <span className="font-black text-emerald-300 block">正式工作組</span>
                          <span className="text-[10px] text-gray-400">100% 目標強度</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-black text-amber-300 text-sm">
                          {calcTargetWeight} kg
                        </span>
                        <span className="text-gray-400 font-bold ml-1.5">
                          正式做組
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowCalculator(false)}
                className="w-full bg-[#181b26] hover:bg-[#202533] text-gray-300 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                關閉試算器
              </button>
            </div>
          </div>
        );
      })()}

      {/* 動作歷史做組軌跡 Modal */}
      {viewingHistoryEx && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#12141c] border border-emerald-500/40 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#262b3d] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-black text-white text-base">
                    {viewingHistoryEx.name}
                  </h3>
                  <span className="text-[10px] text-gray-400">
                    歷史漸進超負荷做組軌跡（共 {exerciseHistoryList.length} 場訓練）
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingHistoryEx(null)}
                className="text-gray-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {loadingHistory ? (
                <div className="py-12 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                  <span>載入歷史紀錄中...</span>
                </div>
              ) : exerciseHistoryList.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  此動作尚無詳細歷史做組紀錄
                </div>
              ) : (
                exerciseHistoryList.map((item) => (
                  <div
                    key={item.sessionId}
                    className="bg-[#181b26] border border-[#262b3d] rounded-xl p-3 space-y-2 hover:border-[#384059] transition-all"
                  >
                    <div className="flex items-center justify-between text-xs border-b border-[#262b3d]/60 pb-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-gray-200">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{item.date}</span>
                        <span className="text-gray-400 font-normal">({item.title.split(" - ")[1] || "訓練"})</span>
                      </div>
                      <Link
                        href={`/workout/${item.sessionId}`}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-0.5"
                      >
                        <span>檢視日誌</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>

                    {/* 當日做組一覽 */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.sets.map((s, idx) => {
                        const isWarmup = (s.raw_text || "").includes("熱身") || s.set_type === "warmup";
                        return (
                          <div
                            key={s.id || idx}
                            className={`text-xs px-2 py-1 rounded-lg border font-mono ${
                              isWarmup
                                ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                                : "bg-[#10141e] border-[#262b3d] text-white font-bold"
                            }`}
                          >
                            <span className="text-[10px] text-gray-400 mr-1">#{idx + 1}</span>
                            <span>{s.weight_kg > 0 ? `${s.weight_kg}kg` : "自重"}</span>
                            <span className="text-gray-400 mx-1">×</span>
                            <span className="text-emerald-300 font-black">{s.reps}</span>
                            {s.notes && (
                              <span className="text-[10px] text-gray-400 ml-1">({s.notes})</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-[#262b3d] bg-[#10121a]">
              <button
                type="button"
                onClick={() => setViewingHistoryEx(null)}
                className="w-full bg-[#181b26] hover:bg-[#202533] text-gray-300 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

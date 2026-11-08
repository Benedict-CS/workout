"use client";

import { useEffect, useState } from "react";
import { Dumbbell, TrendingUp, Search, Plus, X, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db/schema";
import { estimate1RM } from "@/lib/db/crud";
import type { Exercise, SetItem, MuscleGroup, WeightType } from "@/lib/types";

interface ExerciseStat {
  exercise: Exercise;
  totalSets: number;
  maxWeight: number;
  max1RM: number;
  bestSet: string;
}

export default function ExercisesPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ExerciseStat[]>([]);
  const [search, setSearch] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<string>("all");

  // 自訂新增動作狀態
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMuscle, setNewMuscle] = useState<MuscleGroup>("胸部");
  const [newWeightType, setNewWeightType] = useState<WeightType>("barbell_total");

  async function loadData() {
    const allEx = await db.exercises.filter((e) => !e.deleted_at).toArray();
    const allSets = await db.sets.filter((s) => !s.deleted_at).toArray();

    const calculated: ExerciseStat[] = allEx.map((ex) => {
      const exSets = allSets.filter((s) => s.exercise_id === ex.id);
      let maxWeight = 0;
      let max1RM = 0;
      let bestSet = "";

      for (const s of exSets) {
        if (s.weight_kg > maxWeight) maxWeight = s.weight_kg;
        const e1rm = estimate1RM(s.weight_kg, s.reps);
        if (e1rm > max1RM) {
          max1RM = e1rm;
          bestSet = s.raw_text || `${s.weight_kg}Kg x ${s.reps}`;
        }
      }

      return {
        exercise: ex,
        totalSets: exSets.length,
        maxWeight,
        max1RM,
        bestSet: bestSet || "尚未開始記錄",
      };
    });

    // 依總組數多到少排序
    calculated.sort((a, b) => b.totalSets - a.totalSets);
    setStats(calculated);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateExercise() {
    if (!newName.trim()) return;

    const newEx: Exercise = {
      id: `custom-ex-${Date.now()}`,
      name: newName.trim(),
      muscle_group: newMuscle,
      weight_type: newWeightType,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await db.exercises.add(newEx);
    setNewName("");
    setShowAddModal(false);
    await loadData();
  }

  const filtered = stats.filter((st) => {
    if (selectedMuscle !== "all" && st.exercise.muscle_group !== selectedMuscle) return false;
    if (search && !st.exercise.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">核心動作庫 & 1RM</h1>
          <p className="text-xs text-gray-400">專屬於你的精選固定動作與最佳做組紀錄</p>
        </div>
        <button
          onClick={() => setShowAddModal(!showAddModal)}
          className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black px-3 py-1.5 rounded-xl shadow flex items-center gap-1 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>自訂動作</span>
        </button>
      </div>

      {/* 新增動作展開卡片 */}
      {showAddModal && (
        <div className="bg-[#12141c] border border-emerald-500/40 rounded-2xl p-4 space-y-3 animate-in fade-in duration-200 shadow-xl">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
            <span>新增專屬自訂動作</span>
            <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="text-[10px] text-gray-400 block mb-1">動作名稱</label>
              <input
                type="text"
                placeholder="例如: 雙槓臂屈伸、側平舉、啞鈴飛鳥..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">部位</label>
              <select
                value={newMuscle}
                onChange={(e) => setNewMuscle(e.target.value as MuscleGroup)}
                className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-2.5 outline-none"
              >
                <option value="胸部">胸部</option>
                <option value="背部">背部</option>
                <option value="腿部">腿部</option>
                <option value="肩部">肩部</option>
                <option value="手臂">手臂</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">設備型態</label>
              <select
                value={newWeightType}
                onChange={(e) => setNewWeightType(e.target.value as WeightType)}
                className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-2.5 outline-none"
              >
                <option value="barbell_total">槓鈴 (總重)</option>
                <option value="dumbbell_single">啞鈴 (單邊)</option>
                <option value="machine_stack">訓練機 (插銷/滑輪)</option>
                <option value="bodyweight">自重動作</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleCreateExercise}
            disabled={!newName.trim()}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black py-2 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>儲存至動作庫</span>
          </button>
        </div>
      )}

      {/* 搜尋與篩選 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="搜尋動作名稱..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#12141c] border border-[#262b3d] text-white text-xs rounded-xl pl-9 pr-3 py-2.5 focus:border-emerald-500 outline-none"
          />
        </div>
        <select
          value={selectedMuscle}
          onChange={(e) => setSelectedMuscle(e.target.value)}
          className="bg-[#12141c] border border-[#262b3d] text-xs text-emerald-400 font-bold rounded-xl px-3 outline-none"
        >
          <option value="all">全部分類</option>
          <option value="胸部">胸部</option>
          <option value="背部">背部</option>
          <option value="腿部">腿部</option>
          <option value="肩部">肩部</option>
          <option value="手臂">手臂</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400 text-xs">載入動作庫中...</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.exercise.id}
              className="bg-[#12141c] border border-[#262b3d] rounded-2xl p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-100 text-sm">{item.exercise.name}</h3>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                    <span className="text-emerald-400 font-medium">
                      {item.exercise.muscle_group}
                    </span>
                    <span>•</span>
                    <span>總累計 {item.totalSets} 組</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 block">推估 1RM</span>
                  <span className="text-sm font-black text-amber-400">
                    {item.max1RM > 0 ? `${item.max1RM} Kg` : "-"}
                  </span>
                </div>
              </div>

              {/* 最佳紀錄 */}
              <div className="bg-[#181b26] px-3 py-2 rounded-xl border border-[#262b3d]/60 flex items-center justify-between text-xs">
                <span className="text-[11px] text-gray-400">最佳做組：</span>
                <span className="font-bold text-emerald-300">{item.bestSet}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

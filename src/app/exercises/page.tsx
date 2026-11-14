"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { db } from "@/lib/db/schema";
import { runFullSync, deleteRemoteExercise } from "@/lib/db/sync";
import type { Exercise, SetItem, MuscleGroup, WeightType } from "@/lib/types";

interface ExerciseStat {
  exercise: Exercise;
  totalSets: number;
  maxWeight: number;
  maxWeightReps: number;
  bestSet: string;
}

export default function ExercisesPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ExerciseStat[]>([]);
  const [search, setSearch] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<string>("all");
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // 自訂新增動作狀態
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMuscle, setNewMuscle] = useState<MuscleGroup>("胸");
  const [newWeightType, setNewWeightType] = useState<WeightType>("barbell_total");
  const [newNotes, setNewNotes] = useState("");

  // 編輯動作狀態
  const [editingEx, setEditingEx] = useState<Exercise | null>(null);
  const [editName, setEditName] = useState("");
  const [editMuscle, setEditMuscle] = useState<MuscleGroup>("胸");
  const [editWeightType, setEditWeightType] = useState<WeightType>("barbell_total");
  const [editNotes, setEditNotes] = useState("");

  async function loadData() {
    // 排除繩索夾胸
    const allEx = await db.exercises
      .filter((e) => !e.deleted_at && !e.name.includes("繩索夾胸"))
      .toArray();
    const allSets = await db.sets.filter((s) => !s.deleted_at).toArray();

    const calculated: ExerciseStat[] = allEx.map((ex) => {
      const exSets = allSets.filter((s) => s.exercise_id === ex.id);
      let maxWeight = 0;
      let maxWeightReps = 0;
      let bestSet = "";

      for (const s of exSets) {
        if (s.weight_kg > maxWeight) {
          maxWeight = s.weight_kg;
          maxWeightReps = s.reps;
          bestSet = s.raw_text || `${s.weight_kg}Kg x ${s.reps}`;
        }
      }

      return {
        exercise: ex,
        totalSets: exSets.length,
        maxWeight,
        maxWeightReps,
        bestSet: bestSet || "尚未開始記錄",
      };
    });

    // 常用置頂，並依總組數排序
    calculated.sort((a, b) => {
      if (a.exercise.is_favorite && !b.exercise.is_favorite) return -1;
      if (!a.exercise.is_favorite && b.exercise.is_favorite) return 1;
      return b.totalSets - a.totalSets;
    });

    setStats(calculated);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleToggleFavorite(ex: Exercise) {
    const updated = !ex.is_favorite;
    await db.exercises.update(ex.id, {
      is_favorite: updated,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    });
    runFullSync().catch(() => {});
    setStats((prev) =>
      prev.map((item) =>
        item.exercise.id === ex.id
          ? { ...item, exercise: { ...item.exercise, is_favorite: updated } }
          : item
      )
    );
  }

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

  function handleStartEdit(ex: Exercise) {
    setEditingEx(ex);
    setEditName(ex.name);
    setEditMuscle(ex.muscle_group);
    setEditWeightType(ex.weight_type);
    setEditNotes(ex.default_notes || "");
  }

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

  async function handleDeleteExercise(ex: Exercise) {
    if (!confirm(`確定要從動作庫刪除【${ex.name}】嗎？`)) return;
    await db.exercises.delete(ex.id);
    deleteRemoteExercise(ex.id).catch(() => {});
    runFullSync().catch(() => {});
    await loadData();
  }

  const filtered = stats.filter((st) => {
    if (onlyFavorites && !st.exercise.is_favorite) return false;
    if (selectedMuscle !== "all" && st.exercise.muscle_group !== selectedMuscle) return false;
    if (search && !st.exercise.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4 pb-24">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-400 transition-colors py-1"
      >
        <ChevronLeft className="w-4 h-4" />
        <span>返回設定</span>
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">精選動作庫</h1>
          <p className="text-xs text-gray-400">專注核心動作、實測最高重量紀錄</p>
        </div>
        <button
          onClick={() => setShowAddModal(!showAddModal)}
          className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black px-3 py-1.5 rounded-xl shadow flex items-center gap-1 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>自訂動作</span>
        </button>
      </div>

      {/* 新增動作卡片 */}
      {showAddModal && (
        <div className="bg-[#12141c] border border-emerald-500/40 rounded-2xl p-4 space-y-3 shadow-xl">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
            <span>新增動作</span>
            <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="text-[10px] text-gray-400 block mb-1 font-bold">動作名稱</label>
              <input
                type="text"
                placeholder="例如: 雙槓臂屈伸、側平舉..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1 font-bold">部位</label>
              <select
                value={newMuscle}
                onChange={(e) => setNewMuscle(e.target.value as MuscleGroup)}
                className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-2.5 outline-none"
              >
                <option value="胸">胸</option>
                <option value="背">背</option>
                <option value="腿">腿</option>
                <option value="游泳">游泳</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1 font-bold">設備型態</label>
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
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black py-2 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>儲存至動作庫</span>
          </button>
        </div>
      )}

      {/* 修改動作 Modal */}
      {editingEx && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12141c] border border-emerald-500/40 rounded-2xl max-w-sm w-full p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#262b3d] pb-2">
              <h3 className="text-white text-sm font-bold flex items-center gap-2">
                <Pencil className="w-4 h-4 text-emerald-400" />
                <span>編輯動作設定</span>
              </h3>
              <button onClick={() => setEditingEx(null)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="text-[10px] text-gray-400 block mb-1 font-bold">動作名稱</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1 font-bold">部位</label>
                  <select
                    value={editMuscle}
                    onChange={(e) => setEditMuscle(e.target.value as MuscleGroup)}
                    className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-2 outline-none"
                  >
                    <option value="胸">胸</option>
                    <option value="背">背</option>
                    <option value="腿">腿</option>
                    <option value="游泳">游泳</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 block mb-1 font-bold">設備型態</label>
                  <select
                    value={editWeightType}
                    onChange={(e) => setEditWeightType(e.target.value as WeightType)}
                    className="w-full bg-[#181b26] border border-[#262b3d] text-white text-xs rounded-xl p-2 outline-none"
                  >
                    <option value="barbell_total">槓鈴 (總重)</option>
                    <option value="dumbbell_single">啞鈴 (單邊)</option>
                    <option value="machine_stack">訓練機 (插銷/滑輪)</option>
                    <option value="bodyweight">自重動作</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditingEx(null)}
                className="flex-1 bg-[#181b26] text-gray-300 py-2 rounded-xl text-xs font-bold"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black py-2 rounded-xl text-xs font-black shadow"
              >
                儲存更新
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 搜尋與篩選列 */}
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

        <button
          onClick={() => setOnlyFavorites(!onlyFavorites)}
          className={`p-2.5 rounded-xl border flex items-center gap-1 text-xs font-bold transition-all ${
            onlyFavorites
              ? "bg-amber-500/20 border-amber-500 text-amber-300"
              : "bg-[#12141c] border-[#262b3d] text-gray-400"
          }`}
          title="僅顯示常用固定動作"
        >
          <Star className={`w-4 h-4 ${onlyFavorites ? "fill-amber-400 text-amber-400" : ""}`} />
        </button>

        <select
          value={selectedMuscle}
          onChange={(e) => setSelectedMuscle(e.target.value)}
          className="bg-[#12141c] border border-[#262b3d] text-xs text-emerald-400 font-bold rounded-xl px-3 outline-none"
        >
          <option value="all">全部分類</option>
          <option value="胸">胸</option>
          <option value="背">背</option>
          <option value="腿">腿</option>
          <option value="游泳">游泳</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400 text-xs">載入動作庫中...</div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((item) => (
            <div
              key={item.exercise.id}
              className="bg-[#12141c] border border-[#262b3d] hover:border-emerald-500/40 rounded-2xl p-3.5 space-y-2 transition-all shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleFavorite(item.exercise)}
                      className="p-1 hover:scale-110 transition-transform cursor-pointer"
                      title={item.exercise.is_favorite ? "取消常用釘選" : "加入常用固定動作"}
                    >
                      <Star
                        className={`w-4 h-4 ${
                          item.exercise.is_favorite
                            ? "fill-amber-400 text-amber-400"
                            : "text-gray-500 hover:text-gray-300"
                        }`}
                      />
                    </button>
                    <h3 className="font-black text-gray-100 text-[15px]">{item.exercise.name}</h3>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] sm:text-xs text-gray-400 mt-0.5 ml-6">
                    <span className="text-emerald-400 font-semibold">
                      {item.exercise.muscle_group}
                    </span>
                    <span>•</span>
                    <span>累計 {item.totalSets} 組</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-[11px] text-gray-400 block">實測最高</span>
                    <span className="text-base font-black text-white">
                      {item.maxWeight > 0 ? `${item.maxWeight} Kg` : "-"}
                    </span>
                  </div>

                  <button
                    onClick={() => handleStartEdit(item.exercise)}
                    className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors ml-1 active:scale-95 cursor-pointer"
                    title="編輯此動作"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  {item.exercise.id.startsWith("custom-") && (
                    <button
                      onClick={() => handleDeleteExercise(item.exercise)}
                      className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg transition-colors active:scale-95 cursor-pointer"
                      title="刪除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* 最佳紀錄 */}
              {item.maxWeight > 0 && (
                <div className="bg-[#181b26] px-3 py-1.5 rounded-xl border border-[#262b3d]/60 flex items-center justify-between text-xs">
                  <span className="text-xs text-gray-400">歷史最佳做組：</span>
                  <span className="font-bold text-emerald-300 text-xs sm:text-[13px]">{item.bestSet}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

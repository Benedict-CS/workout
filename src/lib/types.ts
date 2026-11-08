export type SyncStatus = "synced" | "pending";

export type SetType =
  | "normal"        // 正式組 (e.g. set 1: 25Kg x10)
  | "warmup"        // 熱身組 (e.g. 20Kg x10 熱身)
  | "primer"        // 神經激發組 (e.g. 20Kg x4 神經激發)
  | "rest_pause"    // 休息暫停組 (e.g. 60Kg x4 + 休 + 55Kg x5)
  | "drop"          // 遞減組 (e.g. 45Kg x8 + 40Kg x4 遞減組)
  | "test"          // 測試組 / 挑戰組 (e.g. 25Kg x3 力量測試)
  | "cooldown";     // 收尾力竭組

export type MuscleGroup = "胸部" | "背部" | "腿部" | "肩部" | "手臂" | "核心" | "游泳" | "綜合";

export type WeightType =
  | "barbell_total"     // 槓鈴總重 (含空槓)
  | "dumbbell_single"   // 啞鈴單邊重量
  | "machine_stack"     // 插銷/掛片式訓練機
  | "machine_single"    // 機械單邊重量
  | "bodyweight"        // 自身體重 (如引體向上)
  | "assisted_inverse"; // 輔助機 (重量越重越容易，如輔助引體向上/雙槓)

export interface Exercise {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  weight_type: WeightType;
  default_notes?: string;
  is_favorite?: boolean;
  user_id?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  sync_status: SyncStatus;
}

export interface SetItem {
  id: string;
  session_id: string;
  exercise_id: string;
  set_order: number;
  set_type: SetType;
  weight_kg: number;
  reps: number;
  raw_text?: string;
  // 進階記錄
  rest_pause_detail?: string; // 如 "休 + 55Kg x5" 或 "休後補 3 下"
  forced_reps?: number;       // 如 "補2", "補4" (強迫次數/輔助次數)
  is_failure?: boolean;       // 是否力竭
  feedback?: string;          // 體感 (e.g. "感受度不錯", "首度突破雙位數", "動作不標準")
  notes?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  sync_status: SyncStatus;
}

export interface WorkoutSession {
  id: string;
  date: string;               // ISO 格式 YYYY-MM-DD
  month_key: string;          // e.g. "2026-06", "2026-11"
  display_title: string;      // e.g. "11/5 (背部) - 交大健身房 - 第 4 次"
  target_muscle: string;      // e.g. "胸部", "背部", "胸部 + 三頭", "腿部", "游泳"
  monthly_index: number;      // 當月第幾次
  location?: string;          // 訓練場地 e.g. "交大健身房", "三劍客", "學校健身房"
  notes?: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  sync_status: SyncStatus;
}

export interface BigThreeRecord {
  id: string;
  bench_press_kg: number;
  squat_kg: number;
  deadlift_kg: number;
  total_kg: number;
  body_weight_kg?: number;
  bench_ratio?: number;
  squat_ratio?: number;
  deadlift_ratio?: number;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface MonthSummaryStats {
  month_name: string;
  counts: Record<string, number>;
}

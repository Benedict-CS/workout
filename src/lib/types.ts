export type SyncStatus = "synced" | "pending";

export type SetType =
  | "normal"        // 正式組
  | "warmup"        // 熱身組
  | "drop";         // 遞減組

export interface SetSubField {
  mode: "休" | "補" | "遞減"; // 休 = 休息暫停, 補 = 輔助/強迫次數, 遞減 = 降重組
  weight_kg?: number;
  reps: number;
}

export type MuscleGroup = "胸" | "背" | "腿" | "肩" | "游泳";

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
  sub_fields?: SetSubField[];
  // 進階記錄 / 相容
  rest_pause_detail?: string;
  forced_reps?: number;
  is_failure?: boolean;
  is_completed?: boolean;
  feedback?: string;
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
  display_title: string;      // e.g. "11/5 (背) - 三健客 - 第 4 次"
  target_muscle: string;      // e.g. "胸", "背", "腿", "游泳"
  monthly_index: number;      // 當月第幾次
  location?: string;          // 訓練場地 e.g. "三健客", "交大健身房", "交大游泳池"
  notes?: string;
  status?: "in_progress" | "completed"; // ⭐ 訓練狀態：進行中草稿 vs 已完成訓練
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

export interface InBodyRecord {
  id: string;
  date: string;               // YYYY-MM-DD
  time: string;               // HH:MM
  weight_kg: number;          // 現場實測體重
  skeletal_muscle_kg: number; // 骨骼肌重 SMM (kg)
  body_fat_mass_kg: number;   // 體脂肪重 (kg)
  body_fat_pct: number;       // 體脂率 PBF (%)
  inbody_score: number;       // InBody 身體評分
  timing: "morning_fasting" | "before_lunch" | "after_lunch" | "morning" | "noon"; // 早晨空腹 (未吃早餐) / 午餐前 (僅吃早餐) / 午餐後 (已吃午餐)
  condition_label: string;    // "早晨空腹 (未吃早餐)" | "午餐前 (僅吃早餐)" | "午餐後 (已吃午餐)"
  estimated_net_weight_kg?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  sync_status?: SyncStatus;
}

export interface BodyWeightRecord {
  id: string;
  date: string;       // YYYY-MM-DD
  time?: string;      // HH:MM
  weight_kg: number;
  body_fat_pct?: number;       // 體脂率 (%)
  skeletal_muscle_kg?: number; // 骨骼肌重 (kg)
  source?: "okok" | "inbody" | "manual";
  condition?: string;
  note?: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface MonthSummaryStats {
  month_name: string;
  counts: Record<string, number>;
}


import type { SetType, SetItem } from "./types";

/**
 * 健身力量計算工具庫 (1RM 計算、槓鈴片換算、熱身組規劃、體重比)
 */

export interface PlateCount {
  weight: number;
  count: number;
  color: string;
  textColor: string;
}

export interface WarmupSetPlan {
  percentage: number;
  weightKg: number;
  reps: number;
  label: string;
  type: SetType;
}

const AVAILABLE_PLATES = [
  { weight: 20, color: "bg-blue-600", textColor: "text-white" },
  { weight: 15, color: "bg-yellow-500", textColor: "text-black" },
  { weight: 10, color: "bg-emerald-600", textColor: "text-white" },
  { weight: 5, color: "bg-gray-200", textColor: "text-black" },
  { weight: 2.5, color: "bg-red-600", textColor: "text-white" },
  { weight: 1.25, color: "bg-gray-400", textColor: "text-black" },
];

/**
 * 依據 Brzycki 公式估算 1RM 最大單次重量 (Kg)
 * 1RM = Weight × (36 / (37 - Reps))
 */
export function calculate1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weightKg * 10) / 10;
  if (reps > 30) reps = 30; // 避免過高次數失真
  const oneRM = weightKg * (36 / (37 - reps));
  return Math.round(oneRM * 10) / 10;
}

/**
 * 依據標準奧林匹克槓鈴換算「單邊」槓片配置
 * 預設空槓重 20 Kg (可自訂)
 */
export function calculateBarbellPlates(
  totalWeightKg: number,
  barWeightKg = 20
): {
  sideWeight: number;
  plates: PlateCount[];
  remaining: number;
} {
  if (totalWeightKg < barWeightKg) {
    return { sideWeight: 0, plates: [], remaining: 0 };
  }

  let sideTarget = (totalWeightKg - barWeightKg) / 2;
  const plates: PlateCount[] = [];

  for (const plate of AVAILABLE_PLATES) {
    if (sideTarget <= 0) break;
    const count = Math.floor(sideTarget / plate.weight);
    if (count > 0) {
      plates.push({
        weight: plate.weight,
        count,
        color: plate.color,
        textColor: plate.textColor,
      });
      sideTarget = Math.round((sideTarget - count * plate.weight) * 100) / 100;
    }
  }

  return {
    sideWeight: Math.max(0, (totalWeightKg - barWeightKg) / 2),
    plates,
    remaining: sideTarget,
  };
}

/**
 * 專業熱身金字塔規劃 (Warm-up Sets Progression)
 * 針對目標正式組重量，科學化階梯式熱身，防止運動傷害並激活神經系統
 */
export function generateWarmupPlan(
  workWeightKg: number,
  barWeightKg = 20
): WarmupSetPlan[] {
  if (workWeightKg <= barWeightKg) return [];

  const plan: WarmupSetPlan[] = [];

  // 1. 空槓熱身 (激活關節與動作軌跡)
  plan.push({
    percentage: Math.round((barWeightKg / workWeightKg) * 100),
    weightKg: barWeightKg,
    reps: 10,
    label: "空槓熱身",
    type: "warmup",
  });

  // 2. 50% 目標重量 (5下)
  const diff = workWeightKg - barWeightKg;
  const w50 = Math.round((barWeightKg + diff * 0.45) / 2.5) * 2.5;
  if (w50 > barWeightKg && w50 < workWeightKg) {
    plan.push({
      percentage: Math.round((w50 / workWeightKg) * 100),
      weightKg: w50,
      reps: 5,
      label: "輕量增溫組",
      type: "warmup",
    });
  }

  // 3. 70% 目標重量 (3下)
  const w70 = Math.round((barWeightKg + diff * 0.7) / 2.5) * 2.5;
  if (w70 > w50 && w70 < workWeightKg) {
    plan.push({
      percentage: Math.round((w70 / workWeightKg) * 100),
      weightKg: w70,
      reps: 3,
      label: "適應組",
      type: "warmup",
    });
  }

  // 4. 85-90% 目標重量 (1下，大重量手感適應，不累積疲勞)
  const w85 = Math.round((barWeightKg + diff * 0.88) / 2.5) * 2.5;
  if (w85 > w70 && w85 < workWeightKg && w85 >= workWeightKg - 5) {
    plan.push({
      percentage: Math.round((w85 / workWeightKg) * 100),
      weightKg: w85,
      reps: 1,
      label: "手感適應組",
      type: "warmup",
    });
  }

  return plan;
}

export interface VolumableSet {
  weight_kg: number;
  reps: number;
  raw_text?: string;
}

/**
 * 精確計算單組的總訓練容量 (Kg)
 * 支援一般組 (e.g. 60Kg x 8) 與遞減組/休息暫停組 (e.g. 45Kg x8 + 40Kg x4 (遞減組) 或 60Kg x4 + 休 + 55Kg x5)
 */
export function calculateSetVolume(s: VolumableSet): number {
  if (s.raw_text) {
    const matches = Array.from(s.raw_text.matchAll(/(\d+(?:\.\d+)?)\s*Kg\s*x\s*(\d+)/gi));
    if (matches.length > 0) {
      return matches.reduce((sum: number, m: RegExpMatchArray) => sum + parseFloat(m[1]) * parseInt(m[2], 10), 0);
    }
  }
  return (s.weight_kg || 0) * (s.reps || 0);
}

/**
 * 計算一組多筆做組紀錄的總容量 (Kg)
 */
export function calculateTotalVolume(sets: VolumableSet[]): number {
  return sets.reduce((sum: number, s: VolumableSet) => sum + calculateSetVolume(s), 0);
}

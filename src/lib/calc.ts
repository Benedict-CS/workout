/**
 * 健身力量計算工具庫 (1RM 計算、槓鈴片換算、重量體重比)
 */

export interface PlateCount {
  weight: number;
  count: number;
  color: string;
  textColor: string;
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

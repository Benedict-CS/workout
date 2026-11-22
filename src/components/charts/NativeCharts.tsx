"use client";

import React, { useState } from "react";

interface MonthData {
  monthKey: string;
  monthLabel: string;
  bench: number;
  squat: number;
  deadlift: number;
  total: number;
}

// -------------------------------------------------------------
// 1. 每月三項最高重量成長曲線 (SVG 原生零依賴圖表)
// -------------------------------------------------------------
export function MonthlyTrendSvgChart({ data }: { data: MonthData[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const validData = Array.isArray(data)
    ? data.filter(
        (d) =>
          d &&
          typeof d === "object" &&
          typeof d.monthLabel === "string"
      )
    : [];

  if (validData.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-xs text-gray-500 bg-[#141620] rounded-xl border border-[#262b3d]/50">
        尚無三項訓練紀錄
      </div>
    );
  }

  // 計算數值極值以映射 Y 軸
  const allVals = validData
    .flatMap((d) => [Number(d.bench) || 0, Number(d.squat) || 0, Number(d.deadlift) || 0])
    .filter((v) => v > 0);
  const minVal = 0;
  const maxRaw = allVals.length > 0 ? Math.max(...allVals) : 90;
  const maxVal = Math.max(60, Math.ceil((maxRaw + 10) / 10) * 10);

  const width = 500;
  const height = 220;
  const padLeft = 35;
  const padRight = 15;
  const padTop = 20;
  const padBottom = 30;

  const plotW = Math.max(10, width - padLeft - padRight);
  const plotH = Math.max(10, height - padTop - padBottom);

  const getX = (idx: number) => {
    if (validData.length <= 1) return padLeft + plotW / 2;
    const x = padLeft + (idx / (validData.length - 1)) * plotW;
    return isFinite(x) ? Math.round(x * 10) / 10 : padLeft;
  };

  const getY = (rawVal: any) => {
    const val = Number(rawVal) || 0;
    const range = maxVal - minVal;
    if (range <= 0 || !isFinite(range)) return padTop + plotH / 2;
    const ratio = Math.max(0, Math.min(1, (val - minVal) / range));
    const y = padTop + plotH - ratio * plotH;
    return isFinite(y) ? Math.round(y * 10) / 10 : padTop + plotH / 2;
  };

  // 生成折線路徑 (濾除非數值座標)
  const benchPoints = validData
    .map((d, i) => `${getX(i)},${getY(d.bench)}`)
    .filter((pt) => !pt.includes("NaN"))
    .join(" ");
  const squatPoints = validData
    .map((d, i) => `${getX(i)},${getY(d.squat)}`)
    .filter((pt) => !pt.includes("NaN"))
    .join(" ");
  const deadPoints = validData
    .map((d, i) => `${getX(i)},${getY(d.deadlift)}`)
    .filter((pt) => !pt.includes("NaN"))
    .join(" ");

  // Y 軸刻度 (4 等分)
  const yTicks = [
    0,
    Math.round(maxVal * 0.33),
    Math.round(maxVal * 0.66),
    maxVal,
  ];

  const activeData =
    hoverIndex !== null && hoverIndex >= 0 && hoverIndex < validData.length
      ? validData[hoverIndex]
      : validData[validData.length - 1];

  return (
    <div className="space-y-2 relative select-none">
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-56 overflow-visible"
          onMouseLeave={() => setHoverIndex(null)}
        >
          {/* 背景橫向網格線與 Y 軸標籤 */}
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#262b3d"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  fill="#6b7280"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* X 軸刻度文字 */}
          {validData.map((d, i) => {
            const x = getX(i);
            return (
              <text
                key={d.monthKey || i}
                x={x}
                y={height - 8}
                textAnchor="middle"
                fill={hoverIndex === i ? "#ffffff" : "#6b7280"}
                fontSize="11"
                fontWeight={hoverIndex === i ? "bold" : "normal"}
              >
                {d.monthLabel}
              </text>
            );
          })}

          {/* 垂直選取輔助線 */}
          {hoverIndex !== null && (
            <line
              x1={getX(hoverIndex)}
              y1={padTop}
              x2={getX(hoverIndex)}
              y2={height - padBottom}
              stroke="#4b5563"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
          )}

          {/* 臥推線 (紅色) */}
          {benchPoints && (
            <polyline
              fill="none"
              stroke="#f87171"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={benchPoints}
            />
          )}

          {/* 深蹲線 (綠色) */}
          {squatPoints && (
            <polyline
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={squatPoints}
            />
          )}

          {/* 硬舉線 (藍色) */}
          {deadPoints && (
            <polyline
              fill="none"
              stroke="#60a5fa"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={deadPoints}
            />
          )}

          {/* 數據節點圓點 */}
          {validData.map((d, i) => {
            const x = getX(i);
            const bY = getY(d.bench);
            const sY = getY(d.squat);
            const dY = getY(d.deadlift);
            const colW = Math.max(14, plotW / validData.length);

            return (
              <g key={i}>
                {/* 臥推點 */}
                {d.bench > 0 && (
                  <circle
                    cx={x}
                    cy={bY}
                    r={hoverIndex === i ? 5 : 3.5}
                    fill="#f87171"
                    stroke="#12141c"
                    strokeWidth="1.5"
                  />
                )}
                {/* 深蹲點 */}
                {d.squat > 0 && (
                  <circle
                    cx={x}
                    cy={sY}
                    r={hoverIndex === i ? 5 : 3.5}
                    fill="#10b981"
                    stroke="#12141c"
                    strokeWidth="1.5"
                  />
                )}
                {/* 硬舉點 */}
                {d.deadlift > 0 && (
                  <circle
                    cx={x}
                    cy={dY}
                    r={hoverIndex === i ? 5 : 3.5}
                    fill="#60a5fa"
                    stroke="#12141c"
                    strokeWidth="1.5"
                  />
                )}

                {/* 互動透明覆蓋點 (方便觸控與滑鼠懸停) */}
                <rect
                  x={x - colW / 2}
                  y={padTop}
                  width={colW}
                  height={plotH}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverIndex(i)}
                  onTouchStart={() => setHoverIndex(i)}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* 互動數據卡 (Tooltip Card) */}
      {activeData && (
        <div className="bg-[#181b26] border border-[#374151] rounded-xl p-3 text-xs shadow-xl space-y-1.5 flex items-center justify-between flex-wrap gap-2">
          <div className="font-bold text-white flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>{activeData.monthLabel} 實測紀錄</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-red-300 font-bold">
              臥推: <strong className="text-white">{activeData.bench > 0 ? `${activeData.bench}kg` : "-"}</strong>
            </span>
            <span className="text-emerald-300 font-bold">
              深蹲: <strong className="text-white">{activeData.squat > 0 ? `${activeData.squat}kg` : "-"}</strong>
            </span>
            <span className="text-blue-300 font-bold">
              硬舉: <strong className="text-white">{activeData.deadlift > 0 ? `${activeData.deadlift}kg` : "-"}</strong>
            </span>
            <span className="text-amber-400 font-black border-l border-[#262b3d] pl-3">
              總和: {activeData.total > 0 ? `${activeData.total}kg` : "-"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// 2. 單一趨勢線原生 SVG 圖表 (體重 / 體脂走勢 / InBody)
// -------------------------------------------------------------
export interface SingleSeriesPoint {
  date: string;
  fullDate: string;
  value: number;
  extra?: string;
}

export function SingleMetricSvgChart({
  data,
  color = "#06b6d4",
  unit = "kg",
  metricName = "數值",
}: {
  data: SingleSeriesPoint[];
  color?: string;
  unit?: string;
  metricName?: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const validData = Array.isArray(data)
    ? data
        .filter((d) => d && typeof d.value === "number" && !isNaN(d.value) && isFinite(d.value))
        .map((d) => ({
          ...d,
          date: String(d.date || ""),
          fullDate: String(d.fullDate || d.date || ""),
        }))
    : [];

  if (validData.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-xs text-gray-500 bg-[#141620] rounded-xl border border-[#262b3d]/50">
        尚無足夠數據繪製趨勢圖
      </div>
    );
  }

  const values = validData.map((d) => d.value);
  const minVal = Math.max(0, Math.floor(Math.min(...values) - 1));
  const maxVal = Math.ceil(Math.max(...values) + 1);

  const width = 500;
  const height = 180;
  const padLeft = 35;
  const padRight = 15;
  const padTop = 15;
  const padBottom = 25;

  const plotW = Math.max(10, width - padLeft - padRight);
  const plotH = Math.max(10, height - padTop - padBottom);

  const getX = (idx: number) => {
    if (validData.length <= 1) return padLeft + plotW / 2;
    const x = padLeft + (idx / (validData.length - 1)) * plotW;
    return isFinite(x) ? Math.round(x * 10) / 10 : padLeft;
  };

  const getY = (rawVal: number) => {
    const val = Number(rawVal);
    if (!isFinite(val)) return padTop + plotH / 2;
    const range = maxVal - minVal;
    if (range <= 0 || !isFinite(range)) return padTop + plotH / 2;
    const ratio = Math.max(0, Math.min(1, (val - minVal) / range));
    const y = padTop + plotH - ratio * plotH;
    return isFinite(y) ? Math.round(y * 10) / 10 : padTop + plotH / 2;
  };

  const pointList = validData.map((d, i) => `${getX(i)},${getY(d.value)}`);
  const pointsStr = pointList.join(" ");

  // 面積填充漸層路徑
  const firstX = getX(0);
  const lastX = getX(validData.length - 1);
  const bottomY = height - padBottom;
  const areaPath =
    validData.length > 0 && pointsStr
      ? `M ${firstX},${bottomY} L ${pointList.join(" L ")} L ${lastX},${bottomY} Z`
      : "";

  const yTicks = [
    minVal,
    Math.round((minVal + (maxVal - minVal) * 0.5) * 10) / 10,
    maxVal,
  ];

  const activeItem =
    hoverIndex !== null && hoverIndex >= 0 && hoverIndex < validData.length
      ? validData[hoverIndex]
      : validData[validData.length - 1];

  const colWidth = Math.max(10, plotW / validData.length);

  return (
    <div className="space-y-1.5 relative select-none">
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 overflow-visible"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id={`grad-${color.replace(/[^a-zA-Z0-9]/g, "")}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* 橫向網格線 */}
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#262b3d"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  fill="#6b7280"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* X 軸日期刻度 (取樣顯示首末與中間) */}
          {validData.length > 0 && (
            <>
              <text x={getX(0)} y={height - 6} textAnchor="start" fill="#6b7280" fontSize="10">
                {validData[0].date}
              </text>
              {validData.length > 2 && (
                <text
                  x={getX(Math.floor(validData.length / 2))}
                  y={height - 6}
                  textAnchor="middle"
                  fill="#6b7280"
                  fontSize="10"
                >
                  {validData[Math.floor(validData.length / 2)].date}
                </text>
              )}
              {validData.length > 1 && (
                <text
                  x={getX(validData.length - 1)}
                  y={height - 6}
                  textAnchor="end"
                  fill="#6b7280"
                  fontSize="10"
                >
                  {validData[validData.length - 1].date}
                </text>
              )}
            </>
          )}

          {/* 垂直指示線 */}
          {hoverIndex !== null && (
            <line
              x1={getX(hoverIndex)}
              y1={padTop}
              x2={getX(hoverIndex)}
              y2={height - padBottom}
              stroke="#4b5563"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
          )}

          {/* 面積微光 */}
          {areaPath && (
            <path d={areaPath} fill={`url(#grad-${color.replace(/[^a-zA-Z0-9]/g, "")})`} />
          )}

          {/* 折線 */}
          {pointsStr && (
            <polyline
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pointsStr}
            />
          )}

          {/* 數據節點圓點 */}
          {validData.map((d, i) => (
            <g key={i}>
              <circle
                cx={getX(i)}
                cy={getY(d.value)}
                r={hoverIndex === i ? 4.5 : validData.length > 40 ? 1.5 : 3}
                fill={color}
                stroke="#12141c"
                strokeWidth="1"
              />
              <rect
                x={getX(i) - colWidth / 2}
                y={padTop}
                width={colWidth}
                height={plotH}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(i)}
                onTouchStart={() => setHoverIndex(i)}
              />
            </g>
          ))}
        </svg>
      </div>

      {/* 互動資訊列 */}
      {activeItem && (
        <div className="bg-[#181b26] border border-[#262b3d] rounded-xl px-3 py-1.5 text-xs flex items-center justify-between">
          <span className="text-gray-400 font-mono">
            {activeItem.fullDate} {activeItem.extra ? `(${activeItem.extra})` : ""}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 text-[11px]">{metricName}:</span>
            <strong className="font-bold text-white text-sm" style={{ color }}>
              {activeItem.value} {unit}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// 3. 水 - 肌 - 脂 三指標連動對照圖 (Tri-Metric Correlation SVG Chart)
// -------------------------------------------------------------
export interface InBodyTriPoint {
  date: string;
  fullDate: string;
  smm: number;
  water: number;
  pbf: number;
  weight: number;
  extra?: string;
}

export function TriMetricCorrelationSvgChart({ data }: { data: InBodyTriPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showWater, setShowWater] = useState(true);
  const [showSmm, setShowSmm] = useState(true);
  const [showPbf, setShowPbf] = useState(true);

  const validData = Array.isArray(data)
    ? data.filter(
        (d) =>
          d &&
          typeof d.smm === "number" &&
          typeof d.water === "number" &&
          typeof d.pbf === "number" &&
          isFinite(d.smm) &&
          isFinite(d.water) &&
          isFinite(d.pbf)
      )
    : [];

  if (validData.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-xs text-gray-500 bg-[#141620] rounded-xl border border-[#262b3d]/50">
        尚無足夠數據繪製關聯對照圖
      </div>
    );
  }

  const waterVals = validData.map((d) => d.water);
  const smmVals = validData.map((d) => d.smm);
  const pbfVals = validData.map((d) => d.pbf);

  const minWater = Math.floor(Math.min(...waterVals) * 10) / 10 - 0.2;
  const maxWater = Math.ceil(Math.max(...waterVals) * 10) / 10 + 0.2;

  const minSmm = Math.floor(Math.min(...smmVals) * 10) / 10 - 0.2;
  const maxSmm = Math.ceil(Math.max(...smmVals) * 10) / 10 + 0.2;

  const minPbf = Math.floor(Math.min(...pbfVals) * 10) / 10 - 0.5;
  const maxPbf = Math.ceil(Math.max(...pbfVals) * 10) / 10 + 0.5;

  const width = 500;
  const height = 210;
  const padLeft = 40;
  const padRight = 15;
  const padTop = 20;
  const padBottom = 25;

  const plotW = Math.max(10, width - padLeft - padRight);
  const plotH = Math.max(10, height - padTop - padBottom);

  const getX = (idx: number) => {
    if (validData.length <= 1) return padLeft + plotW / 2;
    const x = padLeft + (idx / (validData.length - 1)) * plotW;
    return isFinite(x) ? Math.round(x * 10) / 10 : padLeft;
  };

  const getNormY = (val: number, min: number, max: number) => {
    const range = max - min;
    if (range <= 0 || !isFinite(range)) return padTop + plotH / 2;
    const ratio = Math.max(0, Math.min(1, (val - min) / range));
    const y = padTop + plotH - ratio * plotH;
    return isFinite(y) ? Math.round(y * 10) / 10 : padTop + plotH / 2;
  };

  const waterPoints = validData.map((d, i) => `${getX(i)},${getNormY(d.water, minWater, maxWater)}`).join(" ");
  const smmPoints = validData.map((d, i) => `${getX(i)},${getNormY(d.smm, minSmm, maxSmm)}`).join(" ");
  const pbfPoints = validData.map((d, i) => `${getX(i)},${getNormY(d.pbf, minPbf, maxPbf)}`).join(" ");

  const curIndex = hoverIndex !== null && hoverIndex >= 0 && hoverIndex < validData.length
    ? hoverIndex
    : validData.length - 1;
  const activeItem = validData[curIndex];
  const prevItem = curIndex > 0 ? validData[curIndex - 1] : null;

  const dWater = prevItem && activeItem ? Math.round((activeItem.water - prevItem.water) * 10) / 10 : null;
  const dSmm = prevItem && activeItem ? Math.round((activeItem.smm - prevItem.smm) * 10) / 10 : null;
  const dPbf = prevItem && activeItem ? Math.round((activeItem.pbf - prevItem.pbf) * 10) / 10 : null;
  const dWeight = prevItem && activeItem ? Math.round((activeItem.weight - prevItem.weight) * 10) / 10 : null;

  const isHydrationShift = dWater !== null && Math.abs(dWater) >= 0.4;

  const colWidth = Math.max(10, plotW / validData.length);

  return (
    <div className="space-y-2 relative select-none">
      {/* 互動式圖例過濾按鈕 */}
      <div className="flex items-center justify-between text-[11px] px-1 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowWater(!showWater)}
            className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
              showWater
                ? "bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sm"
                : "bg-[#181b26] text-gray-500 border-[#262b3d] opacity-50 line-through"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-sky-400 inline-block"></span>
            總水重 (L)
          </button>
          <button
            type="button"
            onClick={() => setShowSmm(!showSmm)}
            className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
              showSmm
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm"
                : "bg-[#181b26] text-gray-500 border-[#262b3d] opacity-50 line-through"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
            骨骼肌 (kg)
          </button>
          <button
            type="button"
            onClick={() => setShowPbf(!showPbf)}
            className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
              showPbf
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm"
                : "bg-[#181b26] text-gray-500 border-[#262b3d] opacity-50 line-through"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
            體脂率 (%)
          </button>
        </div>
        <span className="text-[10px] text-gray-400 font-mono">
          水肌正相關: <strong className="text-purple-300 font-bold">+98.8%</strong>
        </span>
      </div>

      {/* SVG Chart */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-48 overflow-visible"
          onMouseLeave={() => setHoverIndex(null)}
        >
          {/* 橫向參考線 */}
          {[0, 0.5, 1].map((ratio) => {
            const y = padTop + plotH * (1 - ratio);
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#262b3d"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  fill="#6b7280"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {ratio === 1 ? "峰值" : ratio === 0 ? "低點" : "中位"}
                </text>
              </g>
            );
          })}

          {/* X 軸刻度 */}
          {validData.length > 0 && (
            <>
              <text x={getX(0)} y={height - 6} textAnchor="start" fill="#6b7280" fontSize="10">
                {validData[0].date}
              </text>
              {validData.length > 2 && (
                <text
                  x={getX(Math.floor(validData.length / 2))}
                  y={height - 6}
                  textAnchor="middle"
                  fill="#6b7280"
                  fontSize="10"
                >
                  {validData[Math.floor(validData.length / 2)].date}
                </text>
              )}
              {validData.length > 1 && (
                <text
                  x={getX(validData.length - 1)}
                  y={height - 6}
                  textAnchor="end"
                  fill="#6b7280"
                  fontSize="10"
                >
                  {validData[validData.length - 1].date}
                </text>
              )}
            </>
          )}

          {/* 垂直指示線 */}
          {hoverIndex !== null && (
            <line
              x1={getX(hoverIndex)}
              y1={padTop}
              x2={getX(hoverIndex)}
              y2={height - padBottom}
              stroke="#6b7280"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
          )}

          {/* 折線 1: 體脂率 (橘色虛線，呈鏡像反比蹺蹺板) */}
          {showPbf && (
            <polyline
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4 2"
              points={pbfPoints}
            />
          )}

          {/* 折線 2: 總水重 (天藍色) */}
          {showWater && (
            <polyline
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={waterPoints}
            />
          )}

          {/* 折線 3: 骨骼肌重 (翡翠綠，與水重幾乎重疊) */}
          {showSmm && (
            <polyline
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={smmPoints}
            />
          )}

          {/* 互動觸控區域與節點圓點 */}
          {validData.map((d, i) => (
            <g key={i}>
              {showWater && (
                <circle
                  cx={getX(i)}
                  cy={getNormY(d.water, minWater, maxWater)}
                  r={curIndex === i ? 4 : 2}
                  fill="#38bdf8"
                  stroke="#12141c"
                  strokeWidth="1"
                />
              )}
              {showSmm && (
                <circle
                  cx={getX(i)}
                  cy={getNormY(d.smm, minSmm, maxSmm)}
                  r={curIndex === i ? 4 : 2}
                  fill="#10b981"
                  stroke="#12141c"
                  strokeWidth="1"
                />
              )}
              {showPbf && (
                <circle
                  cx={getX(i)}
                  cy={getNormY(d.pbf, minPbf, maxPbf)}
                  r={curIndex === i ? 4 : 2}
                  fill="#f59e0b"
                  stroke="#12141c"
                  strokeWidth="1"
                />
              )}
              <rect
                x={getX(i) - colWidth / 2}
                y={padTop}
                width={colWidth}
                height={plotH}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(i)}
                onTouchStart={() => setHoverIndex(i)}
              />
            </g>
          ))}
        </svg>
      </div>

      {/* 互動數值資訊看板 */}
      {activeItem && (
        <div className="bg-[#181b26] border border-[#262b3d] rounded-xl p-2.5 text-xs space-y-2">
          <div className="flex items-center justify-between border-b border-[#262b3d]/60 pb-1.5 flex-wrap gap-1">
            <div className="flex items-center gap-2">
              <span className="text-gray-300 font-mono font-bold">
                📅 {activeItem.fullDate}
              </span>
              <span className="text-[10px] text-gray-400 bg-[#12141c] px-1.5 py-0.5 rounded border border-[#262b3d]">
                {activeItem.extra || "實測紀錄"}
              </span>
            </div>
            {prevItem && (
              <span className="text-[10px] text-gray-500 font-mono">
                對比上次: {prevItem.date} {prevItem.fullDate.split(" ")[1] || ""}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5 text-center">
            <div className="bg-[#12141c] p-1.5 rounded-lg border border-sky-500/30">
              <span className="text-[10px] text-sky-400 block font-bold">💧 總水重</span>
              <strong className="text-sky-300 text-sm font-black">{activeItem.water} L</strong>
              {dWater !== null && (
                <span className={`text-[10px] block font-mono font-bold ${dWater > 0 ? "text-sky-400" : dWater < 0 ? "text-amber-400" : "text-gray-400"}`}>
                  {dWater > 0 ? `+${dWater}` : dWater} L
                </span>
              )}
            </div>

            <div className="bg-[#12141c] p-1.5 rounded-lg border border-emerald-500/30">
              <span className="text-[10px] text-emerald-400 block font-bold">💪 骨骼肌</span>
              <strong className="text-emerald-300 text-sm font-black">{activeItem.smm} kg</strong>
              {dSmm !== null && (
                <span className={`text-[10px] block font-mono font-bold ${dSmm > 0 ? "text-emerald-400" : dSmm < 0 ? "text-rose-400" : "text-gray-400"}`}>
                  {dSmm > 0 ? `+${dSmm}` : dSmm} kg
                </span>
              )}
            </div>

            <div className="bg-[#12141c] p-1.5 rounded-lg border border-amber-500/30">
              <span className="text-[10px] text-amber-400 block font-bold">🔥 體脂率</span>
              <strong className="text-amber-300 text-sm font-black">{activeItem.pbf}%</strong>
              {dPbf !== null && (
                <span className={`text-[10px] block font-mono font-bold ${dPbf > 0 ? "text-rose-400" : dPbf < 0 ? "text-emerald-400" : "text-gray-400"}`}>
                  {dPbf > 0 ? `+${dPbf}` : dPbf}%
                </span>
              )}
            </div>

            <div className="bg-[#12141c] p-1.5 rounded-lg border border-gray-600/30">
              <span className="text-[10px] text-gray-400 block font-bold">⚖️ 實測體重</span>
              <strong className="text-white text-sm font-black">{activeItem.weight} kg</strong>
              {dWeight !== null && (
                <span className="text-[10px] block font-mono text-gray-400">
                  {dWeight > 0 ? `+${dWeight}` : dWeight} kg
                </span>
              )}
            </div>
          </div>

          {/* 波動即時診斷提示 */}
          {isHydrationShift && (
            <div className="bg-purple-950/30 border border-purple-500/40 rounded-lg p-2 text-[11px] text-purple-200 flex items-start gap-1.5">
              <span className="text-xs">⚡</span>
              <div>
                <strong>顯著水分連動事件：</strong>
                水分相較前次變動 <span className="font-mono font-bold text-sky-300">{dWater !== null && dWater > 0 ? `+${dWater}` : dWater} L</span>，
                牽引骨骼肌同步變動 <span className="font-mono font-bold text-emerald-300">{dSmm !== null && dSmm > 0 ? `+${dSmm}` : (dSmm ?? 0)} kg</span>，
                同時體脂率呈相反鏡像變動 <span className="font-mono font-bold text-amber-300">{dPbf !== null && dPbf > 0 ? `+${dPbf}` : (dPbf ?? 0)}%</span>。
                此為標準的 BIA 生理儲水波動！
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

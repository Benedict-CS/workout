"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, ChevronLeft, Database, Terminal } from "lucide-react";
import { db } from "@/lib/db/schema";

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [resetting, setResetting] = useState(false);
  const [showStack, setShowStack] = useState(false);

  useEffect(() => {
    console.error("Analytics page error boundary caught error:", error);
  }, [error]);

  async function handleResetCache() {
    try {
      setResetting(true);
      // 清空本地 IndexedDB 快取，強制下一次載入時從 seedData 乾淨初始化
      await db.delete();
      window.location.reload();
    } catch (err) {
      console.error("Failed to reset DB cache:", err);
      window.location.reload();
    }
  }

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-lg mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/5">
        <AlertCircle className="w-7 h-7" />
      </div>

      <div className="space-y-1.5">
        <h2 className="text-base font-bold text-white">載入分析數據時遇到狀況</h2>
        <p className="text-xs text-gray-400 leading-relaxed">
          本地快取或圖表渲染遇到異常，已啟用自動安全保護。
        </p>
      </div>

      {/* 異常資訊摘要框 */}
      {error && (
        <div className="w-full bg-[#12141c] border border-red-500/30 rounded-xl p-3 text-left space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-red-400 font-bold">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              <span>異常訊息: {error.name || "Error"}</span>
            </span>
            {error.digest && (
              <span className="text-gray-500 font-mono text-[10px]">#{error.digest.slice(0, 8)}</span>
            )}
          </div>
          <p className="text-xs text-gray-200 font-mono break-all bg-black/40 p-2 rounded-lg border border-red-500/10">
            {error.message || "未知運行時異常"}
          </p>

          {error.stack && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowStack(!showStack)}
                className="text-[10px] text-gray-400 hover:text-gray-200 cursor-pointer underline"
              >
                {showStack ? "收合詳細呼叫堆疊 (Stack Trace)" : "查看詳細呼叫堆疊 (Stack Trace)"}
              </button>
              {showStack && (
                <pre className="mt-1.5 p-2 bg-black/60 rounded-lg text-[10px] text-gray-400 font-mono overflow-x-auto max-h-40 leading-relaxed whitespace-pre-wrap border border-gray-800">
                  {error.stack}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* 操作按鈕群 */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
        <Link
          href="/"
          className="px-4 py-2 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>返回首頁</span>
        </Link>

        <button
          onClick={() => {
            reset();
            window.location.reload();
          }}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <RefreshCw className="w-4 h-4 stroke-[2.5]" />
          <span>重新載入</span>
        </button>

        <button
          onClick={handleResetCache}
          disabled={resetting}
          className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          title="清空本地快取並重新載入原始完整數據"
        >
          <Database className="w-4 h-4" />
          <span>{resetting ? "修復快取中..." : "重置本地快取並修復"}</span>
        </button>
      </div>
    </div>
  );
}

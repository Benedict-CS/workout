"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, ChevronLeft } from "lucide-react";

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Analytics page error boundary caught error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-md mx-auto">
      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
        <AlertCircle className="w-6 h-6" />
      </div>

      <div className="space-y-1">
        <h2 className="text-base font-bold text-white">載入分析數據時遇到狀況</h2>
        <p className="text-xs text-gray-400">
          本地資料快取已自動保護，請點擊下方按鈕重新整理數據。
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Link
          href="/"
          className="px-4 py-2 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>返回首頁</span>
        </Link>

        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <RefreshCw className="w-4 h-4 stroke-[2.5]" />
          <span>重新載入分析</span>
        </button>
      </div>
    </div>
  );
}

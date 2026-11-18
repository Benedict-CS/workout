"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global application error caught:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-md mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/5">
        <AlertCircle className="w-7 h-7" />
      </div>

      <div className="space-y-1.5">
        <h2 className="text-base font-bold text-white">頁面載入異常保護</h2>
        <p className="text-xs text-gray-400 leading-relaxed">
          系統已攔截異常並保護當前訓練數據安全，請嘗試重新整理。
        </p>
      </div>

      {error?.message && (
        <div className="w-full bg-[#12141c] border border-red-500/20 rounded-xl p-3 text-left">
          <p className="text-xs text-red-300 font-mono break-all">
            {error.message}
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Link
          href="/"
          className="px-4 py-2 bg-[#181b26] hover:bg-[#202533] border border-[#262b3d] text-gray-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Home className="w-4 h-4" />
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
      </div>
    </div>
  );
}

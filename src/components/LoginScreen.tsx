"use client";

import React, { useState } from "react";
import { Dumbbell, Lock, User, Eye, EyeOff, ShieldCheck, AlertCircle, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError("請輸入帳號");
      return;
    }
    if (!password.trim()) {
      setError("請輸入密碼");
      return;
    }

    setIsSubmitting(true);

    // 短暫動畫增加體驗質感
    setTimeout(() => {
      const res = login(username, password, remember);
      if (!res.success) {
        setError(res.error || "登入失敗，請確認帳號與密碼");
        setIsSubmitting(false);
      }
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090a0f] p-4 sm:p-6 overflow-y-auto">
      {/* 背景柔和光暈效果 */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm sm:max-w-md bg-[#121520]/95 backdrop-blur-xl border border-[#262b3d] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* 標誌與標題區 */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.25)]">
            <Dumbbell className="w-8 h-8 stroke-[2.2]" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#121520]" />
          </div>

          <div>
            <h1 className="text-2xl font-black tracking-wider text-white">WORKOUT</h1>
            <p className="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>力量訓練日誌 • 個人專屬保護</span>
            </p>
          </div>
        </div>

        {/* 錯誤警告橫幅 */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/15 border border-red-500/40 rounded-xl text-red-300 text-xs font-semibold animate-in shake duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* 登入表單 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 帳號欄位 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-300 tracking-wide">
              帳號 (Username)
            </label>
            <div className="relative flex items-center">
              <User className="absolute left-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="請輸入帳號 (Benedict)"
                autoComplete="username"
                autoFocus
                className="w-full bg-[#181b26] border border-[#262b3d] hover:border-gray-600 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/50 rounded-xl py-2.5 pl-10 pr-3.5 text-sm text-gray-100 placeholder-gray-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* 密碼欄位 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-300 tracking-wide">
              密碼 (Password)
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="請輸入密碼"
                autoComplete="current-password"
                className="w-full bg-[#181b26] border border-[#262b3d] hover:border-gray-600 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/50 rounded-xl py-2.5 pl-10 pr-10 text-sm text-gray-100 placeholder-gray-500 outline-none transition-all font-mono tracking-wider"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 p-1 text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
                title={showPassword ? "隱藏密碼" : "顯示密碼"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 記住登入狀態核取方塊 */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-[#262b3d] bg-[#181b26] text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-emerald-500"
              />
              <span className="text-xs text-gray-400 hover:text-gray-300">
                記住此裝置登入狀態
              </span>
            </label>
          </div>

          {/* 登入按鈕 */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting ? (
              <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>登入系統</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>

        {/* 底部提示 */}
        <div className="pt-2 border-t border-[#262b3d]/60 text-center">
          <p className="text-[11px] text-gray-400">
            僅供授權使用者存取 • 離線支援與雲端同步
          </p>
        </div>
      </div>
    </div>
  );
}

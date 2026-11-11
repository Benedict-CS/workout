import type { Metadata, Viewport } from "next";
import "./globals.css";
import Link from "next/link";
import {
  Dumbbell,
  History,
  Activity,
  Settings,
  PlusCircle,
  TrendingUp,
} from "lucide-react";
import { GlobalRestTimer } from "@/components/GlobalRestTimer";

export const metadata: Metadata = {
  title: "Workout - 力量訓練日誌",
  description: "專業力量訓練離線記錄 App，支援漸進式超負荷、休補暫停與歷史對比",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/favicon-32.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Workout",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#090a0f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="antialiased bg-[#090a0f] text-gray-100 min-h-screen">
        {/* 頂部導航列 */}
        <header className="sticky top-0 z-40 bg-[#090a0f]/80 backdrop-blur-md border-b border-[#262b3d]/60 px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 font-black tracking-wider text-xl text-emerald-400 active:scale-95 transition-transform"
          >
            <Dumbbell className="w-6 h-6" />
            <span>WORKOUT</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/workout/new"
              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black px-3 py-1.5 rounded-full shadow-md transition-all active:scale-95"
            >
              <PlusCircle className="w-4 h-4 stroke-[2.5]" />
              <span>記訓練</span>
            </Link>
          </div>
        </header>

        {/* 主要內容區 (含底部預留高度防遮擋) */}
        <main className="max-w-xl mx-auto px-4 py-4 pb-24">{children}</main>

        {/* 全域浮動休息計時器 (跨頁面持續顯示與一鍵跳回) */}
        <GlobalRestTimer />

        {/* 底部 5 鍵導航 Bar (手機單手操作優化) */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#12141c]/95 backdrop-blur-lg border-t border-[#262b3d] px-3 py-2 flex items-center justify-around text-[11px] font-medium text-gray-400">
          <Link
            href="/"
            className="flex flex-col items-center gap-1 hover:text-emerald-400 active:scale-95 transition-colors p-1"
          >
            <Activity className="w-4 h-4" />
            <span>訓練日誌</span>
          </Link>

          <Link
            href="/exercises"
            className="flex flex-col items-center gap-1 hover:text-emerald-400 active:scale-95 transition-colors p-1"
          >
            <Dumbbell className="w-4 h-4" />
            <span>動作庫</span>
          </Link>

          {/* 中央突出開新訓練鈕 */}
          <Link
            href="/workout/new"
            className="flex flex-col items-center -mt-4 bg-emerald-500 hover:bg-emerald-400 text-black p-2.5 rounded-full shadow-xl active:scale-90 transition-all font-black"
          >
            <PlusCircle className="w-6 h-6 stroke-[2.5]" />
          </Link>

          <Link
            href="/analytics"
            className="flex flex-col items-center gap-1 hover:text-emerald-400 active:scale-95 transition-colors p-1"
          >
            <TrendingUp className="w-4 h-4" />
            <span>訓練分析</span>
          </Link>

          <Link
            href="/settings"
            className="flex flex-col items-center gap-1 hover:text-emerald-400 active:scale-95 transition-colors p-1"
          >
            <Settings className="w-4 h-4" />
            <span>設定</span>
          </Link>
        </nav>

        {/* 自動註冊 Service Worker 實現完整 PWA 離線快取 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('Workout PWA Service Worker Registered');
                  }).catch(function(err) {
                    console.warn('Workout PWA Service Worker Failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}

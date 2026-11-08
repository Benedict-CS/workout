import type { Metadata, Viewport } from "next";
import "./globals.css";
import Link from "next/link";
import { Dumbbell, History, Activity, Settings, PlusCircle } from "lucide-react";

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
      <body className="antialiased">
        {/* 頂部導航列 */}
        <header className="sticky top-0 z-40 bg-[#090a0f]/80 backdrop-blur-md border-b border-[#262b3d]/60 px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-black tracking-wider text-xl text-emerald-400">
            <Dumbbell className="w-6 h-6" />
            <span>WORKOUT</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/workout/new"
              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold px-3 py-1.5 rounded-full shadow-md transition-all active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>記訓練</span>
            </Link>
          </div>
        </header>

        {/* 主要內容區 */}
        <main className="max-w-xl mx-auto px-4 py-4">{children}</main>

        {/* 底部導航 Bar (手機操作優先) */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#12141c]/90 backdrop-blur-lg border-t border-[#262b3d] px-6 py-2.5 flex items-center justify-around text-xs font-medium text-gray-400">
          <Link href="/" className="flex flex-col items-center gap-1 hover:text-emerald-400 active:scale-95 transition-colors">
            <Activity className="w-5 h-5" />
            <span>首頁總覽</span>
          </Link>
          <Link href="/history" className="flex flex-col items-center gap-1 hover:text-emerald-400 active:scale-95 transition-colors">
            <History className="w-5 h-5" />
            <span>歷史日誌</span>
          </Link>
          <Link href="/exercises" className="flex flex-col items-center gap-1 hover:text-emerald-400 active:scale-95 transition-colors">
            <Dumbbell className="w-5 h-5" />
            <span>動作庫</span>
          </Link>
          <Link href="/settings" className="flex flex-col items-center gap-1 hover:text-emerald-400 active:scale-95 transition-colors">
            <Settings className="w-5 h-5" />
            <span>設定同步</span>
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

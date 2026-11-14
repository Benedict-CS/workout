import type { Metadata, Viewport } from "next";
import "./globals.css";
import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { GlobalRestTimer } from "@/components/GlobalRestTimer";
import { AutoSyncManager } from "@/components/AutoSyncManager";
import { BottomNav } from "@/components/BottomNav";

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
  viewportFit: "cover",
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
        {/* 頂部導航列 (支援 iOS PWA 瀏海與動態島安全區) */}
        <header className="sticky top-0 z-40 bg-[#090a0f]/85 backdrop-blur-md border-b border-[#262b3d]/60 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 font-black tracking-wider text-xl text-emerald-400 active:scale-95 transition-transform"
          >
            <Dumbbell className="w-6 h-6" />
            <span>WORKOUT</span>
          </Link>
        </header>

        {/* 主要內容區 (含底部導航與 Safe Area 防遮擋) */}
        <main className="max-w-xl mx-auto px-3.5 sm:px-4 py-3.5 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">{children}</main>

        {/* 全域浮動休息計時器 (跨頁面持續顯示與一鍵跳回) */}
        <GlobalRestTimer />

        {/* 全域背景自動雲端雙向同步 (開 App、回頁面、網路重連均自動同步) */}
        <AutoSyncManager />

        {/* 底部導航 Bar (具備動態當前頁面高光與 iOS Safe Area 防遮擋) */}
        <BottomNav />

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

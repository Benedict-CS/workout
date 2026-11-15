---
description: Critical guidelines, domain knowledge, PR standards, and UI anti-patterns for the Workout app to prevent regressions and errors.
globs: ["*"]
---

# Workout App Core Engineering & Domain Guidelines

這份文件記錄了本專案的「核心鐵律」、「數據標準」、「UI/UX 規範」與「歷史踩坑禁忌」。在進行任何程式碼修改、功能開發或資料庫維護時，**必須嚴格遵守以下規則，絕不重複犯錯**。

---

## 1. UI/UX 與互動鐵律（簡約、安靜、直覺）

- 🚫 **嚴禁私自添加未經用戶同意的「花俏」輔助按鈕或推測指標**：
  - 絕對不要在紀錄區或編輯彈窗加入重量增減晶片（如 `[-5] [-2.5] [+2.5] [+5] [+10]`）。用戶已明確指示反感。
  - 絕對不要顯示單組即時推估 1RM（如 `⚡ 預估 1RM ≈ ... kg (Epley)`）。
  - 紀錄介面與「修改組數 Modal」必須保持**極簡、安靜、直覺**，只保留：
    1. 組數類型切換（正式組 / 熱身組 / 遞減組）
    2. 重量 (Kg) 輸入框
    3. 次數 (下) 輸入框
    4. 同一組附加欄位（+休 / +補 / +遞減）
    5. 取消與儲存按鈕
  - 任何輔助計算工具（例如奧運槓槓片速算）必須預設收起，不得搶佔或干擾輸入主視覺。

---

## 2. 個人三項基準與 PR 真實性規範

- 🏋️ **個人健力三項實測基準（不可擅自更動）**：
  - **基準體重**：`63.6 kg`
  - **槓鈴臥推 PR**：`60 kg (x5)`，體重倍數：`0.94x` 體重
  - **槓鈴深蹲 PR**：`90 kg (x8)`，體重倍數：`1.42x` 體重
  - **傳統硬舉 PR**：`90 kg (x2)`，體重倍數：`1.42x` 體重
  - **三項總和**：`240 kg`，體重倍數：`3.77x` 體重
  - 格式要求：次數僅以簡潔括號標記（如 `(x5)`），**不要寫任何「(多下實測)」字樣**，也不要加入冗長的免責備註。

- 🏊 **游泳專項（`ex-swim`）**：
  - 游泳是以「場次/時間」進行的有氧專項訓練，資料庫組數紀錄為 dummy set（reps: 1, weight: 0）。
  - **絕對嚴禁顯示為「歷史最佳 PR: 1 下 (自重)」**！這會讓使用者覺得荒謬。
  - 必須標記為：`完成 X 場泳訓`，標籤屬性為 `專項有氧心肺訓練`。

- 🧗 **反向輔助機器（`weight_type === "assisted_inverse"`）**：
  - 包括：輔助雙槓臂屈伸機、輔助引體向上機等。
  - 這類器材的配重是**減重反向輔助推力**（配重越重越輕，配重越輕本體強度越高）。
  - **嚴禁顯示為正向負重「歷史最佳 PR: 20 kg」**。
  - 必須明確顯示：`輔助配重: 20 kg × 8 下`，並帶有紫色 `(輔助減重)` 標記。

- 🦵 **大重量機器實測（如 腿推機 150 kg）**：
  - 機器插銷/掛片（如 大腿推蹬機 `ex-leg-press`）實測重量若高達 140~150 kg，必須自動標示場次時空資訊（如 `150 kg × 8 下 (07/04 交大健身房)`），讓使用者一目了然其出處，避免懷疑系統捏造數據。

- 🥗 **InBody 檢測時段判定**：
  - 若量測時間在上午 10:00 前（如 08:xx、09:xx），判定為「早晨空腹 (未吃早餐)」。

---

## 3. 動作庫 Canonical ID 映射與去重鐵律

- 🔗 **單一真實來源（Canonical IDs）**：
  - 槓鈴臥推：`ex-bench`（全庫 170 組，PR 60kg x 5）
  - 啞鈴平臥推：`ex-db-bench`（全庫 39 組，PR 27.5kg x 5）
  - 啞鈴上斜臥推：`ex-db-incline-bench`（全庫 167 組，PR 25kg x 8）
  - 槓鈴深蹲：`ex-squat`
  - 傳統硬舉：`ex-deadlift`
  - 自重引體向上：`ex-pullup`
  - 大腿推蹬機：`ex-leg-press`
- 🚫 **嚴防舊版別名分裂數據**：
  - 歷史別名如 `ex-bench-press`、`ex-flat-dumbbell`、`ex-incline-dumbbell` 曾殘留在遠端資料庫並帶有最愛星號，導致置頂並顯示為「1 組 / 5 組」。
  - **同步與載入時必須 100% 執行 `LEGACY_ID_MAP` 重新映射**：
    1. 同名動作合併至 Canonical ID。
    2. 組數（Sets）全部聚合至 Canonical ID。
    3. 絕不可讓重複動作呈現在使用者畫面上。

---

## 4. 前端圖表與系統防崩潰鐵律

- 🚫 **嚴禁使用 Recharts（React 19 致命相容性陷阱）**：
  - Recharts 2.x 內部綁定 `react-is@18.3.1`，在 React 19（`react@19.2.8`）環境下無法識別 React 19 的 Virtual DOM 節點，且在 Next.js App Router SSR / Hydration 階段會觸發未捕獲異常，直接導致整頁崩潰（「This page couldn’t load. Reload to try again, or go back」）。
  - **專案一律使用 100% 原生 React 19 SVG 圖表組件**（`NativeCharts.tsx`），零第三方依賴、零 DOM 測量報錯、渲染毫秒級完成。
  - `/analytics` 路由層級配置 `error.tsx` 邊界保護，提供詳細異常堆疊與「重置本地快取並修復」按鈕，杜絕死循環崩潰。
  - 嚴格防範 `NaN` 運算，所有 SVG 路徑座標計算必須通過 `isFinite` 檢查。

- 🚫 **嚴格遵守 React Rules of Hooks，杜絕 React Error #310**：
  - **嚴禁在任何 Hook 前方寫提早返回（Early Return: `if (...) return ...`）**：
    - 若在 `useMemo` / `useEffect` / `useState` 前方存在 `if (!mounted || loading) return <Spinner />`，在狀態切換時 React 會拋出致命的 **Minified React error #310 ("Rendered more hooks than during the previous render")**。
    - **鐵則**：所有 Hook 必須無條件置於組件最頂層；加載中畫面一律在 JSX 內透過三元運算符 `{(!mounted || loading) ? <Spinner /> : <Content />}` 呈現，絕不可提早 `return`。
  - **嚴禁濫用 `useMemo`**：
    - 體重數據（~90 筆）、月份統計（~12 個月）等小規模數據的過濾與計算，耗時 < 0.001 毫秒，一律使用純 JavaScript 變數計算，不使用 `useMemo`，消除多餘 Hook 相依性及順序錯亂風險。

- 🚫 **嚴防資料亂跳、畫面閃爍與無限重新整理（Infinite Loop / Flickering）**：
  - **事件循環互斥鎖**：`AutoSyncManager` 與各頁面的 `workout:data_changed` 監聽器嚴格隔離，只有當 `pulled > 0 || pushed > 0` 且真有資料變更時才觸發廣播，嚴禁在讀取或初次渲染時無差別發布事件引發無限 re-render。
  - **依賴項安全**：`useEffect` 依賴項絕不放置在組件內部每次 render 重新宣告的物件或陣列（如未 memoized 的 array），避免無限迴圈觸發。
  - **數據初值與快照保護**：狀態變更必須平滑過渡，有數據時直接渲染，絕不可在重整或點擊按鈕時將已載入數據清空跳回 `0` 再跳回原數值（避免「數據亂跳、數值從 19 跳 17」的不穩定感）。

---

## 5. 設計美學與視覺調色盤（簡約、清新、乾淨、高質感）

- 🎨 **配色靈感（記帳 App 簡約乾淨淺色系哲學）**：
  - **基底與對比**：採用清爽純淨的冷灰色系與高對比排版，文字層級清晰，留白適度。
  - **調色盤推薦**：
    - 主背景 / 卡片基底：`#0e1017` / `#12141c` / `#181b26`
    - 卡片邊框：細緻冷灰 `#262b3d`，高貴不刺眼。
    - 文字層級：主要文字 `#FFFFFF`、次要標籤 `#E2E8F0` / `#CBD5E0`、輔助說明 `#A0AEC0` / `#64748B`。
    - 清爽點綴色：天空藍 `#63B3ED`、薄荷綠 `#B2F5EA`、柔和琥珀 `#FFD54F`。
  - 嚴禁刺眼純螢光色或厚重暗影，維持如現代記帳 App 般精緻、純淨、舒適的閱讀體驗。

---

## 6. 資料庫同步與雲端分頁鐵律

- 🚫 **Supabase PostgREST 單次查詢上限 1000 筆之致命陷阱**：
  - Supabase 預設單次 API 請求最多回傳 **1000 筆資料**（`max-rows: 1000`）。
  - 若使用 `.select("*").limit(5000)`，後端依然強制只截斷回傳 1000 筆！
  - **歷史血淚教訓**：本專案組數（`workout_sets`）已超過 1570 筆，若未分頁只抓回 1000 筆，同步邏輯會誤以為剩餘 570+ 筆在遠端已被刪除，進而將本地 IndexedDB 早期月份的組數當成「孤兒數據 (orphaned)」批量刪除，直接導致使用者歷史臥推 PR 暴跌（如 60kg x5 跌至 60kg x3，170 組跌至 5 組）。
  - **鐵則**：所有組數與歷史資料的拉取，一律採用 `.range(offset, offset + batchSize - 1)` 進行全量分頁拉取，直到取得完整資料集。
  - **本地保護**：本地新增或狀態為 `pending` 之組數，絕對禁止在 pull 過程中刪除。

---

## 7. PWA 快取與版本控制鐵律

- 🔄 **Service Worker 靜態資源更新與版號同步**：
  - 當任何 UI 元件、Modal 欄位（如移除重量調節晶片）更新時，必須同步遞增 `public/sw.js` 中的 `CACHE_NAME`（如 `workout-pwa-v5`）。
  - Service Worker 必須配置 `self.skipWaiting()` 與 `self.clients.claim()`，並在 `activate` 階段主動清除所有舊版 Cache，杜絕客戶端瀏覽器持續加載舊版快取 JS chunk 的情況。
  - **推薦色彩碼（Colorist AI 推薦規範）**：
    - 淺冷灰底色與文字：`#F1F5F9`（slate-100）、`#E2E8F0`（slate-200）、`#CBD5E0`（slate-300）、`#A0AEC0`（slate-400）
    - 清新點綴色：
      - 天空天青藍：`#63B3ED` / `#38BDF8`（主要重點動作、走勢折線）
      - 薄荷粉綠：`#B2F5EA` / `#10B981`（完成確認、肌肉成長指標）
      - 柔和珊瑚/琥珀：`#FFD54F` / `#F59E0B`（體脂率、三項總和 PR）
  - **排版原則**：卡片圓角一致（`rounded-2xl`）、輸入框乾淨對齊（數字居中）、數據與單位清晰分離，單手操作零負擔。

---

## 5. 自我驗證與交付流程

在交付任何修改前，必須依序完成：
1. **本地編譯檢查**：執行 `npm run build`，確保 0 TypeScript 錯誤、0 Turbopack 錯誤。
2. **Git Diff 複核**：確認無未經授權的改動，無遺漏的殘留調試碼。
3. **Commit & Push 部署**：推送到 `origin master`，並自動觸發 Vercel 生產部署。
4. **線上健康檢查**：使用 HTTP 請求驗證生產站點主要路由正常回傳 200。

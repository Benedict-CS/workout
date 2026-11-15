# Workout App Project Rules & Domain Guidelines

## 1. UI/UX 鐵律 (UI & UX Anti-Patterns)
- **嚴禁私自添加未經用戶明確要求的增減晶片或推測指標**：
  - 絕對不要在「紀錄組數面板」或「修改組數彈窗 (Modal)」中加入 `[-5] [-2.5] [+2.5] [+5] [+10]` 等重量調節按鈕。
  - 絕對不要顯示推估 1RM（如 `⚡ 預估 1RM ≈ ... kg (Epley)`）。
  - 使用者追求的是**極簡、安靜、直覺、純粹**的記錄體驗，絕不塞入浮誇花俏的功能。
  - 奧運槓槓片計算器等輔助小工具必須預設收起，不可干擾主要輸入區域。

## 2. 數據真實性與 PR 基準鐵律 (Data Standards)
- **個人三項 PR 基準（嚴格鎖定）**：
  - **基準體重**：`63.6 kg`
  - **臥推 PR**：`60 kg (x5)`，體重倍數：`0.94x`
  - **深蹲 PR**：`90 kg (x8)`，體重倍數：`1.42x`
  - **硬舉 PR**：`90 kg (x2)`，體重倍數：`1.42x`
  - **三項總和**：`240 kg`，體重倍數：`3.77x`
  - 次數以簡潔括號標記 `(x數字)`，不要加寫「(多下實測)」，不要加免責聲明備註。
- **動作庫組數聚合（Canonical ID Enforcement）**：
  - 必須嚴格使用 Canonical ID：
    - 槓鈴臥推：`ex-bench`（170 組，PR 60kg x 5）
    - 啞鈴平臥推：`ex-db-bench`（39 組，PR 27.5kg x 5）
    - 啞鈴上斜臥推：`ex-db-incline-bench`（167 組，PR 25kg x 8）
  - 任何歷史別名（如 `ex-bench-press`、`ex-flat-dumbbell`、`ex-incline-dumbbell`）在載入與同步時必須 100% 自動合併到主動作，絕不允許出現組數分裂（如顯示 1 組或 5 組的錯誤同名動作）。
- **游泳專項（`ex-swim`）**：
  - 游泳為有氧專項訓練，資料庫組數為 dummy 紀錄。
  - **嚴禁顯示「PR: 1 下 (自重)」**。
  - 必須顯示為「完成 X 場泳訓」，標籤為「專項有氧心肺訓練」。
- **反向輔助機器（`assisted_inverse`）**：
  - 如輔助雙槓臂屈伸機、輔助引體向上機。
  - 配重代表輔助減重磅數（越輕代表本體強度越高）。
  - **嚴禁顯示為正向負重「歷史最佳 PR: 20 kg」**。
  - 必須標記為「輔助配重: 20 kg × 8 下」並帶紫色「輔助減重」標記。
- **大重量機器實測（如腿推機 150 kg）**：
  - 顯示機器實測 PR 時，附註訓練日期與地點（如 `150 kg × 8 下 (07/04 交大健身房)`），清楚回溯時空背景。
- **InBody 量測時機**：
  - 上午 10:00 前（如 08:xx, 09:xx）量測判定為「早晨空腹 (未吃早餐)」。

## 3. 圖表渲染與系統防崩潰 (Chart Safety & Hook Rules)
- **嚴禁使用 Recharts（React 19 致命相容性陷阱）**：
  - Recharts 2.x 內部綁定 `react-is@18.3.1`，在 React 19（`react@19.2.8`）環境下無法識別 React 19 的 Virtual DOM 節點，且在 Next.js App Router SSR / Hydration 階段會觸發未捕獲異常，直接導致整頁崩潰（"This page couldn't load"）。
  - **專案一律使用 100% 原生 React 19 SVG 圖表組件**（[NativeCharts.tsx](file:///F:/workout/src/components/charts/NativeCharts.tsx)），零第三方依賴、零 DOM 測量報錯、渲染毫秒級完成。
  - `/analytics` 路由層級配置 `error.tsx` 邊界保護，杜絕任何未捕獲異常擴散至全域。
- **嚴格遵守 React Rules of Hooks，杜絕 React Error #310**：
  - 絕不在任何 Hook 前方寫 Early Return（`if (...) return ...`）。
  - 所有 Hook 必須無條件置於組件最頂層；加載狀態一律在 JSX 中透過三元運算符 `{loading ? <Spinner /> : <Content />}` 處理。
  - 小規模數據過濾計算直接使用純 JS 變數，不濫用 `useMemo`。
- **杜絕畫面閃爍與無限重新整理 (Infinite Loop Protection)**：
  - `AutoSyncManager` 與各頁面資料監聽嚴格鎖定互斥，避免重複發送廣播引發死循環。
  - 狀態變更平滑過渡，有數據時直接渲染，絕不可在重整或點擊按鈕時將已載入數據清空跳回 `0` 再跳回原數值。

## 4. 驗證與部署規範 (Deployment Protocol)
- 每次代碼修改後必須在本地執行 `npm run build` 確認 0 錯誤。
- 每次代碼提交並推送到 GitHub 後，必須執行 `npx vercel deploy --yes --prod` 確保雲端即時上線。

## 5. 視覺美學調色盤 (Colorist AI Reference)
- 參考 Colorist AI 記帳 App 簡約乾淨淺色系哲學：
  - 核心淺冷灰調：`#F1F5F9`, `#E2E8F0`, `#CBD5E0`, `#A0AEC0`
  - 重點點綴色：天空藍 `#63B3ED`, 薄荷綠 `#B2F5EA` / `#10B981`, 柔和暖色 `#FFD54F` / `#F59E0B`
  - 介面追求：高對比、不花俏、留白舒適、數據直觀。
- 檢查 `git status` 與 `git diff` 確保改動純淨精準。

## 6. 資料庫同步分頁與數據保護 (Supabase Pagination & Local Protection)
- **Supabase PostgREST 1000 筆上限**：單一查詢若超過 1000 筆，必須使用 `.range(offset, offset + batchSize - 1)` 進行全量分頁拉取，絕不可使用 `.limit(5000)`（會被截斷在 1000 筆導致 570+ 筆歷史組數遭誤判為孤兒刪除）。
- **本地待同步保護**：本地新增或狀態為 `pending` 之組數，絕不可在同步時遭刪除。

## 7. PWA 快取與版本控制 (PWA Cache Control)
- **Service Worker 版本遞增**：修改 Modal 或重要 UI 後，必須在 `public/sw.js` 遞增 `CACHE_NAME`（如 `workout-pwa-v5`），並強制 `skipWaiting()` 與清理過期快取，確保客戶端載入最新 JS。
- 推送至 `origin master` 自動觸發 Vercel 生產部署，並以 HTTP 請求確認線上回傳 200。

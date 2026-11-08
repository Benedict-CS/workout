# Workout 力量訓練記錄系統 (Workout Tracker)

專為力量訓練與健力/健美設計的現代化、離線優先（Offline-First）訓練日誌 App。  
延續 **Record（記帳本）** 的核心架構設計，專注於極速錄入、組間休息低干擾、無網路環境流暢運行與漸進式超負荷數據追蹤。

---

## 🌟 核心特色 (Key Features)

1. **離線優先架構 (Offline-First via Dexie.js)**
   * 健身房地下室或訊號死角**完全不受影響**，本機 IndexedDB 秒存 0 延遲。
   * 連上網路後自動與 Supabase 雲端雙向增量同步。

2. **符合真實重訓的靈活組數型態 (Real-World Set Logging)**
   * **正式組 (Normal)**：重量 × 次數（自動計算 1RM 與總量）。
   * **熱身組 (Warmup) & 神經激發組 (Primer)**：如空槓熱身、神經激發組，不污染主力組數據。
   * **休息暫停組 (Rest-Pause)**：支援 `60Kg x4 + 休 + 55Kg x5` 或 `自身體重 x8 + 休 + 2` 複合次數解析。
   * **遞減組 (Drop Set)**：支援 `45Kg x8 + 40Kg x4 (遞減組)`。
   * **強迫輔助次數 (Forced Reps)**：支援 `40Kg x8 + 補2`。
   * **特殊設備重量模型**：槓鈴（總重）、啞鈴（單邊）、機械插銷、自重、以及輔助引體向上（重量越重越容易之反向配重）。

3. **「上次訓練」幽靈對照 (Ghost Comparison)**
   * 在訓練某動作時，系統自動列出上次（例如 3 天前）該動作的做組細節，清楚知道今天目標該突破哪一組、推進幾下。

4. **歷史資料無痛遷移 (Markdown Importer)**
   * 內建專屬解析器，已將過去半年的 Markdown 訓練日誌解析轉換為結構化資料庫種子。

5. **基本三項與進步分析 (Big Three & 1RM Progression)**
   * 即時追蹤臥推、深蹲、硬舉與體重倍數比。
   * Epley 公式自動推估各動作單次極限（Estimated 1RM）。

---

## 🛠 技術棧 (Tech Stack)

* **前端框架**：[Next.js 15/16](https://nextjs.org/) (App Router) + [React 19](https://react.dev/)
* **樣式系統**：[Tailwind CSS v4](https://tailwindcss.com/)
* **本機資料庫**：[Dexie.js](https://dexie.com/) (IndexedDB)
* **雲端資料庫與驗證**：[Supabase](https://supabase.com/) (PostgreSQL + RLS 安全政策)
* **圖表與視覺化**：[Recharts](https://recharts.org/)
* **圖標庫**：[Lucide React](https://lucide.dev/)
* **部署平台**：[Vercel](https://vercel.com/)

---

## 📁 專案架構 (Project Structure)

```text
workout/
├── src/
│   ├── app/
│   │   ├── layout.tsx         # 響應式 App 外框與手機底部導航
│   │   ├── page.tsx           # 首頁總覽 (三項 PR、月頻率、近期日誌)
│   │   ├── workout/
│   │   │   ├── new/page.tsx   # 新增訓練場次 (部位、日期)
│   │   │   └── [id]/page.tsx  # 單場訓練記組 (幽靈對比、休補/遞減)
│   │   ├── history/page.tsx   # 歷史訓練總表 (月份篩選、搜尋)
│   │   ├── exercises/page.tsx # 動作庫與 1RM 最佳紀錄
│   │   └── settings/page.tsx  # Supabase 雲端設定與 JSON 備份
│   ├── lib/
│   │   ├── types.ts           # 完整 TypeScript 型別定義
│   │   ├── parser/            # Markdown 訓練日誌自動解析核心
│   │   └── db/
│   │       ├── schema.ts      # Dexie.js 本機資料庫定義
│   │       ├── crud.ts        # 資料庫查詢與 1RM 計算
│   │       ├── seed.ts        # 初始資料自動預載機制
│   │       └── seed-data.json # 歷史日誌種子資料
├── supabase/
│   └── migrations/
│       └── 001_init.sql       # Supabase 雲端 PostgreSQL 結構與 RLS
├── scripts/
│   └── import-markdown.ts     # Markdown 日誌批次匯入腳本
└── package.json
```

---

## 🚀 快速開始 (Getting Started)

### 1. 安裝相依套件
```bash
npm install
```

### 2. 啟動開發伺服器
```bash
npm run dev
```
瀏覽器開啟 [http://localhost:3000](http://localhost:3000) 即可使用。初次啟動時，系統會自動預載過去 5 個月的歷史訓練資料。

### 3. 重新解析與匯入 Markdown 日誌
若有新的 Markdown 格式日誌，可執行：
```bash
npm run import-data
```

---

## ☁️ 雲端配置與部署 (Supabase & Vercel)

### 1. Supabase 資料庫設定
1. 在 [Supabase](https://supabase.com/) 建立新專案（免費版支援 2 個獨立專案）。
2. 在 **SQL Editor** 貼上並執行 `supabase/migrations/001_init.sql`。
3. 取得 **Project URL** 與 **anon public key**，填入專案的 `.env.local` 或在網頁「設定」中填入。

### 2. Vercel 部署
```bash
# 登入 Vercel CLI (若未登入)
npx vercel login

# 一鍵部署生產版本
npm run deploy
```

---

## 📄 License
MIT License.

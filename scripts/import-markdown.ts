import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseWorkoutMarkdown } from "../src/lib/parser/markdown-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultSourcePath = "C:\\Users\\king\\Downloads\\Text document.md";
const targetJsonPath = path.resolve(__dirname, "../src/lib/db/seed-data.json");

async function main() {
  const sourcePath = process.argv[2] || defaultSourcePath;
  console.log(`Reading workout markdown from: ${sourcePath}`);

  if (!fs.existsSync(sourcePath)) {
    console.error(`File not found: ${sourcePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(sourcePath, "utf-8");
  const parsed = parseWorkoutMarkdown(content, 2026);

  console.log("=== 解析統計 ===");
  console.log(`三項數據: 臥推 ${parsed.bigThree?.bench_press_kg}Kg, 深蹲 ${parsed.bigThree?.squat_kg}Kg, 硬舉 ${parsed.bigThree?.deadlift_kg}Kg (總和 ${parsed.bigThree?.total_kg}Kg)`);
  console.log(`訓練次數 (Sessions): ${parsed.sessions.length} 場`);
  console.log(`動作種類 (Exercises): ${parsed.exercises.length} 種`);
  console.log(`組數紀錄 (Sets): ${parsed.sets.length} 組`);

  // 確保輸出目錄存在
  fs.mkdirSync(path.dirname(targetJsonPath), { recursive: true });
  fs.writeFileSync(targetJsonPath, JSON.stringify(parsed, null, 2), "utf-8");
  console.log(`\n已成功產生預載種子資料庫檔案: ${targetJsonPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

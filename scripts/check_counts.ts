import seedData from "../src/lib/db/seed-data.json";

const counts: Record<string, number> = { 胸: 0, 背: 0, 腿: 0, 肩: 0, 游泳: 0 };
for (const s of seedData.sessions as any[]) {
  if (s.target_muscle.includes("胸")) counts["胸"]++;
  else if (s.target_muscle.includes("背")) counts["背"]++;
  else if (s.target_muscle.includes("腿")) counts["腿"]++;
  else if (s.target_muscle.includes("肩")) counts["肩"]++;
  else if (s.target_muscle.includes("泳")) counts["游泳"]++;
}

console.log("Counts in seedData:", counts);
console.log("Total in seedData:", seedData.sessions.length);

import seedData from "../src/lib/db/seed-data.json";

const swimSessions = (seedData.sessions as any[]).filter(s => s.target_muscle.includes("泳"));
for (const s of swimSessions) {
  console.log(s.id, s.date, s.display_title, s.monthly_index);
}

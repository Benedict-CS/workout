import { db } from "./schema";
import seedData from "./seed-data.json";

export async function ensureDatabaseSeeded(): Promise<void> {
  const sessionCount = await db.sessions.count();
  if (sessionCount > 0) {
    return; // 已經有資料，不覆蓋
  }

  console.log("Seeding workout database from initial markdown records...");

  await db.transaction("rw", [db.sessions, db.exercises, db.sets, db.big_three], async () => {
    if (seedData.bigThree) {
      await db.big_three.put(seedData.bigThree as any);
    }
    if (seedData.exercises?.length) {
      await db.exercises.bulkPut(seedData.exercises as any);
    }
    if (seedData.sessions?.length) {
      await db.sessions.bulkPut(seedData.sessions as any);
    }
    if (seedData.sets?.length) {
      await db.sets.bulkPut(seedData.sets as any);
    }
  });

  console.log("Database seeded successfully!");
}

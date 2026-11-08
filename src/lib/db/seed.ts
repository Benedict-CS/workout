import { db } from "./schema";
import seedData from "./seed-data.json";

export async function ensureDatabaseSeeded(): Promise<void> {
  const existingExercises = await db.exercises.toArray();
  const hasLegacyEx = existingExercises.some(
    (e) => e.id.startsWith("ex-1") || e.name === "早上游泳" || e.name === "超級組"
  );

  const sessionCount = await db.sessions.count();

  // 若尚未初始化，或含有舊版雜亂動作庫，則自動更新為精煉的固定核心動作庫
  if (sessionCount === 0 || hasLegacyEx) {
    console.log("Seeding / Migrating to curated staple exercises...");

    await db.transaction("rw", [db.sessions, db.exercises, db.sets, db.big_three], async () => {
      // 保留使用者手動新增的自訂動作 (id 不是 ex- 開頭的)
      const userCustomExercises = existingExercises.filter(
        (e) => !e.id.startsWith("ex-")
      );

      await db.exercises.clear();
      await db.exercises.bulkPut(seedData.exercises as any);
      if (userCustomExercises.length > 0) {
        await db.exercises.bulkPut(userCustomExercises);
      }

      if (sessionCount === 0 || hasLegacyEx) {
        await db.sets.clear();
        await db.sessions.clear();
        await db.big_three.clear();

        if (seedData.bigThree) {
          await db.big_three.put(seedData.bigThree as any);
        }
        if (seedData.sessions?.length) {
          await db.sessions.bulkPut(seedData.sessions as any);
        }
        if (seedData.sets?.length) {
          await db.sets.bulkPut(seedData.sets as any);
        }
      }
    });

    console.log("Database curated successfully!");
  }
}

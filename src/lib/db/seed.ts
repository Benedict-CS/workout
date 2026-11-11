import { db } from "./schema";
import seedData from "./seed-data.json";
import { runFullSync } from "./sync";

export async function ensureDatabaseSeeded(): Promise<void> {
  const existingExercises = await db.exercises.toArray();
  const sessionCount = await db.sessions.count();
  const hasSwimSession = (await db.sessions.where("target_muscle").equals("游泳").count()) > 0;

  // 若尚未初始化，或尚未包含游泳 sessions / 未達 88 場，則自動更新為精煉資料
  if (sessionCount === 0 || sessionCount < seedData.sessions.length || !hasSwimSession) {
    console.log("Seeding / Migrating to curated staple exercises & sessions...");

    await db.transaction("rw", [db.sessions, db.exercises, db.sets, db.big_three], async () => {
      const userCustomExercises = existingExercises.filter(
        (e) => !e.id.startsWith("ex-")
      );

      await db.exercises.clear();
      await db.exercises.bulkPut(seedData.exercises as any);
      if (userCustomExercises.length > 0) {
        await db.exercises.bulkPut(userCustomExercises);
      }

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
    });

    console.log("Database curated successfully!");
  }

  // 嘗試在背景與 Supabase 雙向同步 (確保手機與電腦資料一致)
  if (typeof window !== "undefined") {
    runFullSync().catch((err) => console.log("Background sync info:", err));
  }
}

import { db } from "./schema";
import seedData from "./seed-data.json";
import bwData from "./bodyweight-data.json";
import inbodyData from "./inbody-data.json";
import { runFullSync } from "./sync";

export async function ensureDatabaseSeeded(): Promise<void> {
  const existingExercises = await db.exercises.toArray();
  const sessionCount = await db.sessions.count();
  const hasSwimSession = (await db.sessions.where("target_muscle").equals("游泳").count()) > 0;

  // 檢查並清理歷史舊版 session-swim-* 幽靈資料與重複訓練
  const legacySwims = await db.sessions.filter((s) => s.id.startsWith("session-swim-")).toArray();
  if (legacySwims.length > 0) {
    const legIds = legacySwims.map((s) => s.id);
    await db.sessions.bulkDelete(legIds);
    const legSets = await db.sets.filter((st) => legIds.includes(st.session_id)).toArray();
    if (legSets.length > 0) {
      await db.sets.bulkDelete(legSets.map((s) => s.id));
    }
  }

  const updatedSessionCount = await db.sessions.count();

  // 若尚未初始化，或尚未包含完整場次 (共 102 場) / 缺游泳，則自動更新為精煉資料
  if (updatedSessionCount === 0 || updatedSessionCount < seedData.sessions.length || !hasSwimSession) {
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

  // 檢查並載入歷史體重數據 (OKOK 93 筆晨起空腹未穿衣量測)
  const bwCount = await db.body_weight.count();
  if (bwCount < bwData.length) {
    const formattedBw = bwData.map((b: any) => ({
      ...b,
      created_at: b.created_at || `${b.date}T08:00:00.000Z`,
      updated_at: b.updated_at || `${b.date}T08:00:00.000Z`,
      sync_status: "synced" as const,
    }));
    await db.body_weight.bulkPut(formattedBw as any);
  }

  // 檢查並載入 InBody 里程碑身體組成檢測 (17 次多頻電極實測)
  const inbodyCount = await db.inbody_records.count();
  if (inbodyCount < inbodyData.length) {
    const formattedInbody = inbodyData.map((ib: any) => ({
      ...ib,
      created_at: ib.created_at || `${ib.date}T${ib.time || "12:00"}:00.000Z`,
      updated_at: ib.updated_at || `${ib.date}T${ib.time || "12:00"}:00.000Z`,
      sync_status: "synced" as const,
    }));
    await db.inbody_records.bulkPut(formattedInbody as any);
  }

  // 嘗試在背景與 Supabase 雙向同步 (確保手機與電腦資料一致)
  if (typeof window !== "undefined") {
    runFullSync().catch((err) => console.log("Background sync info:", err));
  }
}

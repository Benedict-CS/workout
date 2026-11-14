import { createClient } from "@supabase/supabase-js";
import seedData from "../src/lib/db/seed-data.json";

const DEFAULT_SUPABASE_URL = "https://sbvcbkvnvhwalypmzbvt.supabase.co";
const DEFAULT_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidmNia3Zudmh3YWx5cG16YnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNTkzODksImV4cCI6MjEwOTgzNTM4OX0.flhfWoAIdfpp-5cQ98R_H1Hs6y5xTnCKD16eG6-VP_8";

const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);

async function main() {
  const { data: supaSessions } = await supabase
    .from("workout_sessions")
    .select("id, date, display_title, target_muscle");

  if (!supaSessions) return;

  const supaMap = new Map(supaSessions.map(s => [s.id, s]));
  const seedMap = new Map((seedData.sessions as any[]).map(s => [s.id, s]));

  const inSeedNotSupa = [];
  for (const s of seedData.sessions as any[]) {
    if (!supaMap.has(s.id)) inSeedNotSupa.push(s);
  }

  const inSupaNotSeed = [];
  for (const s of supaSessions) {
    if (!seedMap.has(s.id)) inSupaNotSeed.push(s);
  }

  console.log("In seedData but not Supabase:", inSeedNotSupa.map(s => `${s.id} (${s.date} ${s.display_title})`));
  console.log("In Supabase but not seedData:", inSupaNotSeed.map(s => `${s.id} (${s.date} ${s.display_title})`));
}

main();

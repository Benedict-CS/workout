import { createClient } from "@supabase/supabase-js";
import seedData from "../src/lib/db/seed-data.json";

const DEFAULT_SUPABASE_URL = "https://sbvcbkvnvhwalypmzbvt.supabase.co";
const DEFAULT_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidmNia3Zudmh3YWx5cG16YnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNTkzODksImV4cCI6MjEwOTgzNTM4OX0.flhfWoAIdfpp-5cQ98R_H1Hs6y5xTnCKD16eG6-VP_8";

const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);

async function main() {
  const seedSwim = seedData.sessions.filter(
    (s: any) => (s.target_muscle && s.target_muscle.includes("泳")) || (s.display_title && s.display_title.includes("泳"))
  );
  console.log("Total seedData sessions:", seedData.sessions.length);
  console.log("Swim in seedData:", seedSwim.length);
  console.log("Seed swim dates:", seedSwim.map((s: any) => `${s.date} (${s.id})`));

  const { data: supaSessions, error } = await supabase
    .from("workout_sessions")
    .select("id, date, display_title, target_muscle")
    .order("date");

  if (supaSessions) {
    const supaSwim = supaSessions.filter(
      (s: any) => (s.target_muscle && s.target_muscle.includes("泳")) || (s.display_title && s.display_title.includes("泳"))
    );
    console.log("Total Supabase sessions:", supaSessions.length);
    console.log("Swim in Supabase:", supaSwim.length);
    console.log("Supabase swim dates:", supaSwim.map((s: any) => `${s.date} (${s.id})`));
  }
}

main();

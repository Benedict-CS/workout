import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://sbvcbkvnvhwalypmzbvt.supabase.co";
const DEFAULT_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidmNia3Zudmh3YWx5cG16YnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNTkzODksImV4cCI6MjEwOTgzNTM4OX0.flhfWoAIdfpp-5cQ98R_H1Hs6y5xTnCKD16eG6-VP_8";

const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);

async function main() {
  const { data: supaSessions } = await supabase
    .from("workout_sessions")
    .select("id, date, display_title, target_muscle")
    .order("date");

  if (!supaSessions) return;

  const counts: Record<string, number> = { 胸: 0, 背: 0, 腿: 0, 肩: 0, 游泳: 0, other: 0 };
  const otherSessions: any[] = [];
  for (const s of supaSessions) {
    if (s.target_muscle.includes("胸")) counts["胸"]++;
    else if (s.target_muscle.includes("背")) counts["背"]++;
    else if (s.target_muscle.includes("腿")) counts["腿"]++;
    else if (s.target_muscle.includes("肩")) counts["肩"]++;
    else if (s.target_muscle.includes("泳")) counts["游泳"]++;
    else {
      counts["other"]++;
      otherSessions.push(s);
    }
  }

  console.log("Supabase counts:", counts);
  console.log("Total in Supabase:", supaSessions.length);
  if (otherSessions.length > 0) {
    console.log("Other sessions in Supabase:", otherSessions);
  }
}

main();

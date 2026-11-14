import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://sbvcbkvnvhwalypmzbvt.supabase.co";
const DEFAULT_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidmNia3Zudmh3YWx5cG16YnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNTkzODksImV4cCI6MjEwOTgzNTM4OX0.flhfWoAIdfpp-5cQ98R_H1Hs6y5xTnCKD16eG6-VP_8";

const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);

function getCleanTitle(title: string, targetMuscle: string): string {
  let pm = "胸";
  if (targetMuscle.includes("胸") || title.includes("胸")) pm = "胸";
  else if (targetMuscle.includes("背") || title.includes("背")) pm = "背";
  else if (targetMuscle.includes("腿") || title.includes("腿")) pm = "腿";
  else if (targetMuscle.includes("肩") || title.includes("肩")) pm = "肩";
  else if (targetMuscle.includes("泳") || title.includes("泳")) pm = "游泳";

  return title.replace(/\(([^)]+)\)/, `(${pm})`);
}

async function main() {
  const { data: sessions, error } = await supabase
    .from("workout_sessions")
    .select("id, date, display_title, target_muscle")
    .eq("month_key", "2026-11")
    .order("date");

  if (error || !sessions) {
    console.error("Error fetching sessions:", error);
    return;
  }

  console.log("Found November sessions:", sessions.length);

  for (const s of sessions) {
    let cleanTarget = "胸";
    if (s.target_muscle.includes("胸") || s.display_title.includes("胸")) cleanTarget = "胸";
    else if (s.target_muscle.includes("背") || s.display_title.includes("背")) cleanTarget = "背";
    else if (s.target_muscle.includes("腿") || s.display_title.includes("腿")) cleanTarget = "腿";
    else if (s.target_muscle.includes("肩") || s.display_title.includes("肩")) cleanTarget = "肩";
    else if (s.target_muscle.includes("泳") || s.display_title.includes("泳")) cleanTarget = "游泳";

    const cleanTitle = getCleanTitle(s.display_title, cleanTarget);

    if (cleanTitle !== s.display_title || cleanTarget !== s.target_muscle) {
      console.log(`Updating ${s.id}:`);
      console.log(`  Title:  "${s.display_title}" -> "${cleanTitle}"`);
      console.log(`  Target: "${s.target_muscle}" -> "${cleanTarget}"`);

      await supabase
        .from("workout_sessions")
        .update({
          display_title: cleanTitle,
          target_muscle: cleanTarget,
          updated_at: new Date().toISOString(),
        })
        .eq("id", s.id);
    } else {
      console.log(`Session ${s.id} is already clean: "${s.display_title}" (${s.target_muscle})`);
    }
  }
  console.log("Done updating Supabase!");
}

main();

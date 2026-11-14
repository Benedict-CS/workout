import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://sbvcbkvnvhwalypmzbvt.supabase.co";
const DEFAULT_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidmNia3Zudmh3YWx5cG16YnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNTkzODksImV4cCI6MjEwOTgzNTM4OX0.flhfWoAIdfpp-5cQ98R_H1Hs6y5xTnCKD16eG6-VP_8";

const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);

async function check() {
  const { data: exercises } = await supabase.from("exercises").select("*");
  console.log("All exercises with 引體 in name:");
  for (const e of exercises || []) {
    if (e.name.includes("引體") || e.id.includes("pullup")) {
      console.log(e);
    }
  }

  const { data: sets } = await supabase
    .from("workout_sets")
    .select("id, session_id, exercise_id, raw_text")
    .limit(3000);

  const pullSets = sets?.filter(s => s.raw_text?.includes("引體") || s.exercise_id?.includes("pullup"));
  console.log("Total sets mentioning 引體 or pullup:", pullSets?.length);
  const byExId: Record<string, number> = {};
  for (const s of pullSets || []) {
    byExId[s.exercise_id] = (byExId[s.exercise_id] || 0) + 1;
  }
  console.log("By exercise_id in Supabase:", byExId);
}

check();

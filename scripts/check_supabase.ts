import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://sbvcbkvnvhwalypmzbvt.supabase.co";
const DEFAULT_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidmNia3Zudmh3YWx5cG16YnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNTkzODksImV4cCI6MjEwOTgzNTM4OX0.flhfWoAIdfpp-5cQ98R_H1Hs6y5xTnCKD16eG6-VP_8";

const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);

async function check() {
  const { data: sets, count, error } = await supabase
    .from("workout_sets")
    .select("id, exercise_id, raw_text", { count: "exact" });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Total sets in Supabase:", count);
  const pullupSets = sets.filter(s => s.exercise_id === 'ex-pullup' || s.exercise_id === 'ex-assisted-pullup');
  console.log("Pullup sets in Supabase:", pullupSets.length);

  const { data: exercises } = await supabase.from("exercises").select("id, name");
  console.log("Exercises in Supabase:", exercises?.length);

  const { count: sessionCount } = await supabase.from("workout_sessions").select("id", { count: "exact" });
  console.log("Sessions in Supabase:", sessionCount);
}

check();

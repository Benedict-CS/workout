import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://sbvcbkvnvhwalypmzbvt.supabase.co";
const DEFAULT_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidmNia3Zudmh3YWx5cG16YnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNTkzODksImV4cCI6MjEwOTgzNTM4OX0.flhfWoAIdfpp-5cQ98R_H1Hs6y5xTnCKD16eG6-VP_8";

const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);

async function main() {
  const { data, error } = await supabase
    .from("workout_sessions")
    .update({
      display_title: "11/14 (腿) - 交大健身房 - 第 10 次",
      target_muscle: "腿",
      updated_at: new Date().toISOString(),
    })
    .eq("id", "session-2026-11-14-1794646944321")
    .select();

  if (error) {
    console.error("Error updating Supabase:", error);
  } else {
    console.log("Successfully updated Supabase session:", data);
  }
}

main();

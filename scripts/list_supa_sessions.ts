import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://sbvcbkvnvhwalypmzbvt.supabase.co";
const DEFAULT_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidmNia3Zudmh3YWx5cG16YnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNTkzODksImV4cCI6MjEwOTgzNTM4OX0.flhfWoAIdfpp-5cQ98R_H1Hs6y5xTnCKD16eG6-VP_8";

const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);

async function list() {
  const { data: supaSessions } = await supabase
    .from("workout_sessions")
    .select("id, date, monthly_index, display_title")
    .order("date", { ascending: true });

  console.log("Total in Supabase:", supaSessions?.length);
  for (const s of (supaSessions || []).slice(0, 15)) {
    console.log(s.id, "-->", s.display_title);
  }
}

list();

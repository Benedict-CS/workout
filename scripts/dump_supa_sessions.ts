import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const DEFAULT_SUPABASE_URL = "https://sbvcbkvnvhwalypmzbvt.supabase.co";
const DEFAULT_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidmNia3Zudmh3YWx5cG16YnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNTkzODksImV4cCI6MjEwOTgzNTM4OX0.flhfWoAIdfpp-5cQ98R_H1Hs6y5xTnCKD16eG6-VP_8";

const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);

async function dumpSupaSessions() {
  const { data } = await supabase.from("workout_sessions").select("id, date, monthly_index, display_title, target_muscle").order("date");
  fs.writeFileSync("scripts/supa_sessions.json", JSON.stringify(data, null, 2), "utf-8");
  console.log(`Saved ${data?.length} sessions to scripts/supa_sessions.json`);
}

dumpSupaSessions();

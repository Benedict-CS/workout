import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const DEFAULT_SUPABASE_URL = "https://sbvcbkvnvhwalypmzbvt.supabase.co";
const DEFAULT_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidmNia3Zudmh3YWx5cG16YnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNTkzODksImV4cCI6MjEwOTgzNTM4OX0.flhfWoAIdfpp-5cQ98R_H1Hs6y5xTnCKD16eG6-VP_8";

const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);

async function check() {
  const { data: supaSessions } = await supabase.from("workout_sessions").select("id, date, display_title");
  console.log("Supabase sessions count:", supaSessions?.length);
  console.log("Sample Supabase session IDs:", supaSessions?.slice(0, 5));

  const seed = JSON.parse(fs.readFileSync("src/lib/db/seed-data.json", "utf-8"));
  console.log("Seed sessions count:", seed.sessions.length);
  console.log("Sample Seed session IDs:", seed.sessions.slice(0, 5).map((s: any) => s.id));
}

check();

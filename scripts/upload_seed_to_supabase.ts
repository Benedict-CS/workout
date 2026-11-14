import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const DEFAULT_SUPABASE_URL = "https://sbvcbkvnvhwalypmzbvt.supabase.co";
const DEFAULT_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidmNia3Zudmh3YWx5cG16YnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNTkzODksImV4cCI6MjEwOTgzNTM4OX0.flhfWoAIdfpp-5cQ98R_H1Hs6y5xTnCKD16eG6-VP_8";

const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);

async function syncAllToSupabase() {
  const seed = JSON.parse(fs.readFileSync("src/lib/db/seed-data.json", "utf-8"));
  console.log(`Uploading ${seed.exercises.length} exercises, ${seed.sessions.length} sessions, ${seed.sets.length} sets to Supabase...`);

  // 1. Exercises
  const { error: exErr } = await supabase.from("exercises").upsert(
    seed.exercises.map((e: any) => ({
      id: e.id,
      name: e.name,
      muscle_group: e.muscle_group,
      weight_type: e.weight_type,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "id" }
  );
  if (exErr) console.error("Exercises err:", exErr);
  else console.log("Exercises upserted successfully!");

  // 2. Sessions
  const { error: sessErr } = await supabase.from("workout_sessions").upsert(
    seed.sessions.map((s: any) => ({
      id: s.id,
      date: s.date,
      month_key: s.month_key,
      display_title: s.display_title,
      target_muscle: s.target_muscle,
      monthly_index: s.monthly_index,
      location: s.location || null,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "id" }
  );
  if (sessErr) console.error("Sessions err:", sessErr);
  else console.log("Sessions upserted successfully!");

  // 3. Sets in chunks of 150
  const sets = seed.sets;
  for (let i = 0; i < sets.length; i += 150) {
    const chunk = sets.slice(i, i + 150);
    const payload = chunk.map((st: any) => ({
      id: st.id,
      session_id: st.session_id,
      exercise_id: st.exercise_id,
      set_order: st.set_order,
      set_type: st.set_type || "normal",
      weight_kg: st.weight_kg ?? 0,
      reps: st.reps ?? 0,
      raw_text: st.raw_text || null,
      rest_pause_detail: st.rest_pause_detail || null,
      forced_reps: st.forced_reps || null,
      is_failure: !!st.is_failure,
      feedback: "completed",
      created_at: st.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error: setErr } = await supabase.from("workout_sets").upsert(payload, { onConflict: "id" });
    if (setErr) {
      console.error(`Error in chunk ${i}-${i + 150}:`, setErr);
    }
  }
  console.log("All sets upserted to Supabase successfully!");

  // Check count
  const { count } = await supabase.from("workout_sets").select("id", { count: "exact" });
  console.log("Total sets now in Supabase:", count);

  const { data: pullupSets } = await supabase
    .from("workout_sets")
    .select("id, session_id, exercise_id")
    .in("exercise_id", ["ex-pullup", "ex-assisted-pullup"]);
  console.log("Total pullup sets in Supabase:", pullupSets?.length);
}

syncAllToSupabase();

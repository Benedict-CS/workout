import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const DEFAULT_SUPABASE_URL = "https://sbvcbkvnvhwalypmzbvt.supabase.co";
const DEFAULT_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidmNia3Zudmh3YWx5cG16YnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNTkzODksImV4cCI6MjEwOTgzNTM4OX0.flhfWoAIdfpp-5cQ98R_H1Hs6y5xTnCKD16eG6-VP_8";

const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);

async function uploadToSupabase() {
  const seed = JSON.parse(fs.readFileSync("src/lib/db/seed-data.json", "utf-8"));
  console.log(`Uploading ${seed.sets.length} sets to Supabase...`);

  const sets = seed.sets;
  let successCount = 0;
  for (let i = 0; i < sets.length; i += 100) {
    const chunk = sets.slice(i, i + 100);
    const payload = chunk.map((st: any) => ({
      id: st.id,
      session_id: st.session_id,
      exercise_id: st.exercise_id,
      set_order: st.set_order,
      set_type: st.set_type || "normal",
      weight_kg: st.weight_kg ?? 0,
      reps: Math.round(st.reps ?? 0),
      raw_text: st.raw_text || null,
      rest_pause_detail: st.rest_pause_detail || null,
      forced_reps: st.forced_reps || null,
      is_failure: !!st.is_failure,
      feedback: "completed",
      created_at: st.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("workout_sets").upsert(payload, { onConflict: "id" });
    if (error) {
      console.error(`Error in chunk ${i}-${i + 100}:`, error);
    } else {
      successCount += chunk.length;
    }
  }

  console.log(`Successfully uploaded ${successCount} sets to Supabase!`);

  const { data: pullupSets } = await supabase
    .from("workout_sets")
    .select("id, session_id, exercise_id")
    .in("exercise_id", ["ex-pullup", "ex-assisted-pullup"]);
  console.log("Total pullup sets in Supabase now:", pullupSets?.length);
}

uploadToSupabase();

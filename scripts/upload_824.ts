import { createClient } from "@supabase/supabase-js";
import seedData from "../src/lib/db/seed-data.json";

const DEFAULT_SUPABASE_URL = "https://sbvcbkvnvhwalypmzbvt.supabase.co";
const DEFAULT_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidmNia3Zudmh3YWx5cG16YnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNTkzODksImV4cCI6MjEwOTgzNTM4OX0.flhfWoAIdfpp-5cQ98R_H1Hs6y5xTnCKD16eG6-VP_8";

const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);

async function main() {
  const sess = (seedData.sessions as any[]).find(s => s.id === "session-2026-08-24-1");
  if (sess) {
    const { error } = await supabase.from("workout_sessions").upsert({
      id: sess.id,
      date: sess.date,
      month_key: sess.month_key,
      display_title: "8/24 (胸) - 交大健身房",
      target_muscle: "胸",
      monthly_index: sess.monthly_index || 1,
      notes: JSON.stringify({ note: "", location: sess.location || "交大健身房" }),
      created_at: sess.created_at,
      updated_at: sess.updated_at,
    });
    console.log("Upsert 8/24 error:", error);
  }

  // Also check sets for session-2026-08-24-1
  const sets = (seedData.sets as any[]).filter(st => st.session_id === "session-2026-08-24-1");
  console.log("Sets for 8/24 in seedData:", sets.length);
  if (sets.length > 0) {
    const { error: setsErr } = await supabase.from("workout_sets").upsert(
      sets.map(st => ({
        id: st.id,
        session_id: st.session_id,
        exercise_id: st.exercise_id,
        set_order: st.set_order,
        set_type: st.set_type || "normal",
        weight_kg: st.weight_kg,
        reps: st.reps,
        raw_text: st.raw_text,
        notes: st.notes,
        feedback: st.feedback,
        created_at: st.created_at,
        updated_at: st.updated_at,
      }))
    );
    console.log("Upsert 8/24 sets error:", setsErr);
  }
}

main();

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const seedPath = path.resolve(__dirname, '../src/lib/db/seed-data.json');
const rawSeed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

// 1. Curate Exercises
const muscleMap = {
  '胸部': '胸',
  '背部': '背',
  '腿部': '腿',
  '胸': '胸',
  '背': '背',
  '腿': '腿',
  '游泳': '游泳',
};

const exercises = rawSeed.exercises
  .filter(e => !e.name.includes('繩索夾胸'))
  .map(e => ({
    ...e,
    muscle_group: muscleMap[e.muscle_group] || (e.name.includes('胸') ? '胸' : e.name.includes('背') || e.name.includes('拉') || e.name.includes('划船') ? '背' : '腿'),
  }));

if (!exercises.some(e => e.id === 'ex-swim')) {
  exercises.push({
    id: 'ex-swim',
    name: '游泳',
    muscle_group: '游泳',
    weight_type: 'bodyweight',
    is_favorite: true,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    sync_status: 'synced',
  });
}

// 2. Curate existing Sessions
const sessions = rawSeed.sessions.map(s => {
  let target = '胸';
  if (s.target_muscle.includes('胸')) target = '胸';
  else if (s.target_muscle.includes('背')) target = '背';
  else if (s.target_muscle.includes('腿')) target = '腿';
  else if (s.target_muscle.includes('泳')) target = '游泳';

  let location = '三健客';
  if (s.id.includes('2026-08-29') || s.date === '2026-08-29') {
    location = '永和國民運動中心';
  } else if (s.id.includes('2026-08-30') || s.date === '2026-08-30') {
    location = '四號公園';
  } else if (s.date <= '2026-08-31') {
    location = '交大健身房';
  } else {
    // 9月及9月後如果沒有特別標記交大健身房，全部都是三健客
    location = '三健客';
  }

  const parts = s.date.split('-');
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);

  const display_title = `${m}/${d} (${target}) - ${location} - 第 ${s.monthly_index} 次`;

  return {
    ...s,
    target_muscle: target,
    location: location,
    display_title: display_title,
    notes: s.notes || undefined,
  };
});

// 3. Swimming entries to add
const swimEntries = [
  { date: '2026-07-21', loc: '交大游泳池', time: '下午游', note: '游泳' },
  { date: '2026-07-23', loc: '交大游泳池', time: '下午游', note: '游泳' },
  { date: '2026-07-24', loc: 'zyx家游泳池', time: '下午游', note: '潤榮 游泳' },
  { date: '2026-07-27', loc: '交大游泳池', time: '下午游', note: '游泳下午' },
  { date: '2026-07-27', loc: '交大游泳池', time: '晚上游', note: '游泳晚上' },
  { date: '2026-07-29', loc: '交大游泳池', time: '下午游', note: '游泳' },
  { date: '2026-08-06', loc: '交大游泳池', time: '下午游', note: '游泳' },
  { date: '2026-08-07', loc: '交大游泳池', time: '下午游', note: '游泳' },
  { date: '2026-08-11', loc: '交大游泳池', time: '下午游', note: '游泳' },
  { date: '2026-08-12', loc: '交大游泳池', time: '下午游', note: '游泳' },
  { date: '2026-08-16', loc: '清大游泳池', time: '下午游', note: '游泳 清大 alvaro 請' },
  { date: '2026-08-18', loc: '交大游泳池', time: '下午游', note: '游泳' },
  { date: '2026-08-20', loc: '交大游泳池', time: '下午游', note: '游泳' },
  { date: '2026-08-22', loc: '交大游泳池', time: '下午游', note: '游泳' },
  { date: '2026-09-05', loc: '交大游泳池', time: '下午游', note: '游泳' },
  { date: '2026-09-12', loc: '交大游泳池', time: '下午游', note: '游泳' },
];

const newSwimSets = [];

swimEntries.forEach((sw, idx) => {
  const parts = sw.date.split('-');
  const monthKey = `${parts[0]}-${parts[1]}`;
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  const sessId = `session-swim-${sw.date}-${idx + 1}`;

  // count monthly index for this month
  const monthSessions = sessions.filter(s => s.month_key === monthKey);
  const monthlyIndex = monthSessions.length + 1;

  const display_title = `${m}/${d} (游泳) - ${sw.loc} - 第 ${monthlyIndex} 次`;

  sessions.push({
    id: sessId,
    date: sw.date,
    month_key: monthKey,
    display_title: display_title,
    target_muscle: '游泳',
    monthly_index: monthlyIndex,
    location: sw.loc,
    notes: sw.note,
    created_at: `${sw.date}T10:00:00.000Z`,
    updated_at: `${sw.date}T10:00:00.000Z`,
    sync_status: 'synced',
  });

  newSwimSets.push({
    id: `set-${sessId}-1`,
    session_id: sessId,
    exercise_id: 'ex-swim',
    set_order: 1,
    set_type: 'normal',
    weight_kg: 0,
    reps: 1,
    raw_text: `${sw.time} (${sw.loc})`,
    notes: sw.time,
    created_at: `${sw.date}T10:00:00.000Z`,
    updated_at: `${sw.date}T10:00:00.000Z`,
    sync_status: 'synced',
  });
});

// Sort sessions by date
sessions.sort((a, b) => a.date.localeCompare(b.date));

// Re-calculate monthly_index cleanly per month
const monthCounts = {};
for (const s of sessions) {
  if (!monthCounts[s.month_key]) monthCounts[s.month_key] = 0;
  monthCounts[s.month_key]++;
  s.monthly_index = monthCounts[s.month_key];
  const parts = s.date.split('-');
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  s.display_title = `${m}/${d} (${s.target_muscle}) - ${s.location} - 第 ${s.monthly_index} 次`;
}

// 4. Curate Sets
function parseSubFields(raw) {
  if (!raw) return undefined;
  const subs = [];

  // 1. Drop set: e.g. "45Kg x8 + 40Kg x4 (遞減組)"
  const dropMatch = raw.match(/\+\s*(\d+(?:\.\d+)?)\s*Kg\s*x(\d+)\s*(?:\(遞減組\)|\+?\s*遞減)/i);
  if (dropMatch) {
    subs.push({
      mode: '遞減',
      weight_kg: parseFloat(dropMatch[1]),
      reps: parseInt(dropMatch[2], 10),
    });
  }

  // 2. Rest-Pause: e.g. "+ 休 + 57.5Kg x4" or "+ 3下 (休息)" or "+ 休 2"
  const restKgMatch = raw.match(/(?:休|\+?\s*休\s*\+?)\s*(\d+(?:\.\d+)?)\s*Kg\s*x(\d+)/i);
  if (restKgMatch) {
    subs.push({
      mode: '休',
      weight_kg: parseFloat(restKgMatch[1]),
      reps: parseInt(restKgMatch[2], 10),
    });
  } else {
    const restRepsMatch = raw.match(/\+\s*(\d+)\s*下?\s*(?:\(休息\)|\+?\s*休)/);
    if (restRepsMatch) {
      subs.push({
        mode: '休',
        reps: parseInt(restRepsMatch[1], 10),
      });
    }
  }

  // 3. Forced reps: e.g. "+ 補2" or "+ 補4"
  const forcedMatch = raw.match(/[+＋]?\s*補\s*(\d+)/);
  if (forcedMatch) {
    subs.push({
      mode: '補',
      reps: parseInt(forcedMatch[1], 10),
    });
  }

  return subs.length > 0 ? subs : undefined;
}

const sets = rawSeed.sets.map(s => {
  let setType = s.set_type;
  let raw = s.raw_text || '';

  if (setType === 'primer' || raw.includes('神經激發')) {
    setType = 'warmup';
    raw = raw.replace('神經激發', '熱身').trim();
  }

  if (raw.includes('遞減')) {
    setType = 'drop';
  } else if (raw.includes('熱身')) {
    setType = 'warmup';
  } else {
    setType = 'normal';
  }

  const subFields = parseSubFields(raw);

  return {
    ...s,
    set_type: setType,
    raw_text: raw,
    sub_fields: subFields,
  };
}).concat(newSwimSets);

const curated = {
  bigThree: rawSeed.bigThree,
  sessions,
  exercises,
  sets,
};

fs.writeFileSync(seedPath, JSON.stringify(curated, null, 2), 'utf-8');
console.log('✅ Curated seed-data.json saved!');
console.log(`- Sessions: ${sessions.length}`);
console.log(`- Exercises: ${exercises.length}`);
console.log(`- Sets: ${sets.length}`);

// 5. Upload to Supabase
async function uploadToSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sbvcbkvnvhwalypmzbvt.supabase.co';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidmNia3Zudmh3YWx5cG16YnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNTkzODksImV4cCI6MjEwOTgzNTM4OX0.flhfWoAIdfpp-5cQ98R_H1Hs6y5xTnCKD16eG6-VP_8';

  const client = createClient(url, key);

  console.log('\nUploading curated data to Supabase...');

  // 1. Exercises
  const { error: exErr } = await client.from('exercises').upsert(
    exercises.map(e => ({
      id: e.id,
      name: e.name,
      muscle_group: e.muscle_group,
      weight_type: e.weight_type,
      default_notes: e.default_notes || null,
      is_favorite: !!e.is_favorite,
      created_at: e.created_at,
      updated_at: e.updated_at,
    })),
    { onConflict: 'id' }
  );
  if (exErr) console.error('Exercise upload error:', exErr.message);
  else console.log(`✅ Uploaded ${exercises.length} exercises to Supabase`);

  // 2. Big Three
  if (curated.bigThree) {
    const b = curated.bigThree;
    const { error: bErr } = await client.from('big_three_records').upsert({
      id: b.id,
      bench_press_kg: b.bench_press_kg,
      squat_kg: b.squat_kg,
      deadlift_kg: b.deadlift_kg,
      total_kg: b.total_kg,
      body_weight_kg: b.body_weight_kg || null,
      bench_ratio: b.bench_ratio || null,
      squat_ratio: b.squat_ratio || null,
      deadlift_ratio: b.deadlift_ratio || null,
      updated_at: b.updated_at,
    }, { onConflict: 'id' });
    if (bErr) console.error('Big three upload error:', bErr.message);
    else console.log('✅ Uploaded big_three_records to Supabase');
  }

  // 3. Sessions
  const sessionPayload = sessions.map(s => ({
    id: s.id,
    date: s.date,
    month_key: s.month_key,
    display_title: s.display_title,
    target_muscle: s.target_muscle,
    monthly_index: s.monthly_index,
    notes: JSON.stringify({ note: s.notes || '', location: s.location || '' }),
    created_at: s.created_at,
    updated_at: s.updated_at,
  }));

  const { error: sErr } = await client.from('workout_sessions').upsert(sessionPayload, { onConflict: 'id' });
  if (sErr) console.error('Sessions upload error:', sErr.message);
  else console.log(`✅ Uploaded ${sessions.length} sessions to Supabase`);

  // 4. Sets in chunks
  const chunkSize = 150;
  let totalSetsUploaded = 0;
  for (let i = 0; i < sets.length; i += chunkSize) {
    const chunk = sets.slice(i, i + chunkSize);
    const setsPayload = chunk.map(st => ({
      id: st.id,
      session_id: st.session_id,
      exercise_id: st.exercise_id,
      set_order: st.set_order,
      set_type: st.set_type,
      weight_kg: st.weight_kg,
      reps: st.reps,
      raw_text: st.raw_text || null,
      rest_pause_detail: st.sub_fields ? JSON.stringify(st.sub_fields) : (st.rest_pause_detail || null),
      forced_reps: st.forced_reps || null,
      is_failure: !!st.is_failure,
      feedback: st.feedback || null,
      notes: st.notes || null,
      created_at: st.created_at,
      updated_at: st.updated_at,
    }));

    const { error: setErr } = await client.from('workout_sets').upsert(setsPayload, { onConflict: 'id' });
    if (setErr) {
      console.error(`Sets chunk ${i} upload error:`, setErr.message);
    } else {
      totalSetsUploaded += chunk.length;
    }
  }
  console.log(`✅ Uploaded ${totalSetsUploaded} / ${sets.length} sets to Supabase!`);
  console.log('\n🎉 All data synchronized with Supabase cloud successfully!');
}

uploadToSupabase().catch(console.error);

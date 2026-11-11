const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Read Markdown
const mdPath = path.resolve(__dirname, '../data/workout_journal.md');
if (!fs.existsSync(mdPath)) {
  console.error('File not found:', mdPath);
  process.exit(1);
}
const content = fs.readFileSync(mdPath, 'utf-8');

// 2. Canonical Exercises
const exercises = [
  // 胸 (13)
  { id: 'ex-bench-press', name: '槓鈴臥推', muscle_group: '胸', weight_type: 'barbell_total', is_favorite: true },
  { id: 'ex-incline-dumbbell', name: '啞鈴上斜臥推', muscle_group: '胸', weight_type: 'dumbbell_single', is_favorite: true },
  { id: 'ex-flat-dumbbell', name: '啞鈴平臥推', muscle_group: '胸', weight_type: 'dumbbell_single', is_favorite: true },
  { id: 'ex-incline-bench', name: '上斜槓鈴臥推', muscle_group: '胸', weight_type: 'barbell_total' },
  { id: 'ex-decline-bench', name: '下斜槓鈴臥推', muscle_group: '胸', weight_type: 'barbell_total' },
  { id: 'ex-smith-bench', name: '史密斯槓鈴臥推', muscle_group: '胸', weight_type: 'barbell_total' },
  { id: 'ex-pec-deck', name: '蝴蝶機夾胸', muscle_group: '胸', weight_type: 'machine_stack', is_favorite: true },
  { id: 'ex-machine-incline-press', name: '上斜機器臥推', muscle_group: '胸', weight_type: 'dumbbell_single' },
  { id: 'ex-chest-press', name: '坐姿胸推機器', muscle_group: '胸', weight_type: 'machine_stack' },
  { id: 'ex-chest-press-machine', name: '胸部推舉機', muscle_group: '胸', weight_type: 'machine_stack' },
  { id: 'ex-assisted-dip', name: '輔助雙槓臂屈伸機', muscle_group: '胸', weight_type: 'assisted_inverse' },
  { id: 'ex-tricep-press-chest', name: '三頭下壓機 寬 (主攻下胸)', muscle_group: '胸', weight_type: 'machine_stack' },
  { id: 'ex-flat-dumbbell-press', name: '平板啞鈴臥推', muscle_group: '胸', weight_type: 'dumbbell_single' },
  { id: 'ex-cable-crossover', name: '繩索夾胸', muscle_group: '胸', weight_type: 'machine_stack', deleted_at: '2026-10-31T00:00:00.000Z' },

  // 背 (11)
  { id: 'ex-deadlift', name: '槓鈴硬舉', muscle_group: '背', weight_type: 'barbell_total', is_favorite: true },
  { id: 'ex-hex-deadlift', name: '六角槓硬舉', muscle_group: '背', weight_type: 'barbell_total' },
  { id: 'ex-pullup', name: '自重引體向上', muscle_group: '背', weight_type: 'bodyweight', is_favorite: true },
  { id: 'ex-assisted-pullup', name: '輔助引體向上', muscle_group: '背', weight_type: 'assisted_inverse' },
  { id: 'ex-lat-row-machine', name: '高拉背部划船機', muscle_group: '背', weight_type: 'machine_single', is_favorite: true },
  { id: 'ex-seated-row-machine', name: '坐姿划船機', muscle_group: '背', weight_type: 'machine_single', is_favorite: true },
  { id: 'ex-seated-back-row-machine', name: '坐式背部划船機', muscle_group: '背', weight_type: 'machine_stack' },
  { id: 'ex-lat-pulldown', name: '雙軌滑輪下拉', muscle_group: '背', weight_type: 'machine_stack' },
  { id: 'ex-underhand-pulldown', name: '高位反手下拉', muscle_group: '背', weight_type: 'machine_single' },
  { id: 'ex-barbell-row', name: '槓鈴划船', muscle_group: '背', weight_type: 'barbell_total' },
  { id: 'ex-one-arm-dumbbell-row', name: '單手啞鈴划船', muscle_group: '背', weight_type: 'dumbbell_single' },

  // 腿 (6)
  { id: 'ex-squat', name: '槓鈴深蹲', muscle_group: '腿', weight_type: 'barbell_total', is_favorite: true },
  { id: 'ex-leg-press', name: '大腿推蹬機', muscle_group: '腿', weight_type: 'machine_stack', is_favorite: true },
  { id: 'ex-lying-leg-curl', name: '臥式腿部彎舉機', muscle_group: '腿', weight_type: 'machine_stack', is_favorite: true },
  { id: 'ex-leg-extension', name: '腿部伸張機', muscle_group: '腿', weight_type: 'machine_stack' },
  { id: 'ex-bulgarian-split-squat', name: '保加利亞分腿蹲', muscle_group: '腿', weight_type: 'dumbbell_single' },
  { id: 'ex-hack-squat', name: '哈克深蹲', muscle_group: '腿', weight_type: 'machine_stack' },

  // 肩 (1)
  { id: 'ex-dumbbell-shoulder-press', name: '啞鈴肩推', muscle_group: '腿', weight_type: 'dumbbell_single' },

  // 游泳 (1)
  { id: 'ex-swim', name: '游泳', muscle_group: '游泳', weight_type: 'bodyweight', is_favorite: true },
].map(e => ({
  ...e,
  created_at: '2026-06-01T00:00:00.000Z',
  updated_at: '2026-06-01T00:00:00.000Z',
  sync_status: 'synced',
}));

function matchExerciseId(raw) {
  if (raw.includes('上斜槓鈴臥推')) return 'ex-incline-bench';
  if (raw.includes('下斜槓鈴臥推')) return 'ex-decline-bench';
  if (raw.includes('史密斯槓鈴臥推')) return 'ex-smith-bench';
  if (raw.includes('槓鈴臥推') || raw.includes('槓鈴平胸臥推')) return 'ex-bench-press';
  if (raw.includes('啞鈴上斜臥推')) return 'ex-incline-dumbbell';
  if (raw.includes('啞鈴平臥推') || raw.includes('啞鈴臥推')) return 'ex-flat-dumbbell';
  if (raw.includes('平板啞鈴臥推')) return 'ex-flat-dumbbell-press';
  if (raw.includes('蝴蝶機夾胸')) return 'ex-pec-deck';
  if (raw.includes('繩索夾胸')) return 'ex-cable-crossover';
  if (raw.includes('上斜機器臥推')) return 'ex-machine-incline-press';
  if (raw.includes('胸部推舉機')) return 'ex-chest-press-machine';
  if (raw.includes('坐姿胸推機器')) return 'ex-chest-press';
  if (raw.includes('三頭下壓機')) return 'ex-tricep-press-chest';
  if (raw.includes('雙槓臂屈伸機') || raw.includes('Dip')) return 'ex-assisted-dip';
  if (raw.includes('六角槓硬舉')) return 'ex-hex-deadlift';
  if (raw.includes('槓鈴硬舉')) return 'ex-deadlift';
  if (raw.includes('輔助引體向上')) return 'ex-assisted-pullup';
  if (raw.includes('引體向上')) return 'ex-pullup';
  if (raw.includes('高拉背部划船機')) return 'ex-lat-row-machine';
  if (raw.includes('坐式背部划船機')) return 'ex-seated-back-row-machine';
  if (raw.includes('坐姿划船機')) return 'ex-seated-row-machine';
  if (raw.includes('高位反手下拉')) return 'ex-underhand-pulldown';
  if (raw.includes('雙軌滑輪下拉')) return 'ex-lat-pulldown';
  if (raw.includes('單手啞鈴划船')) return 'ex-one-arm-dumbbell-row';
  if (raw.includes('槓鈴划船')) return 'ex-barbell-row';
  if (raw.includes('大腿推蹬機')) return 'ex-leg-press';
  if (raw.includes('臥式腿部彎舉機')) return 'ex-lying-leg-curl';
  if (raw.includes('腿部伸張機') || raw.includes('坐姿腿伸展') || raw.includes('前踢機')) return 'ex-leg-extension';
  if (raw.includes('保加利亞分腿蹲')) return 'ex-bulgarian-split-squat';
  if (raw.includes('哈克深蹲')) return 'ex-hack-squat';
  if (raw.includes('槓鈴深蹲')) return 'ex-squat';
  if (raw.includes('啞鈴肩推')) return 'ex-dumbbell-shoulder-press';
  if (raw.includes('超級組')) return 'ex-pullup';
  if (raw.includes('額外加碼測試')) return 'ex-flat-dumbbell-press';
  return 'ex-bench-press';
}

// 3. Parse Sessions & Sets
const detailsBlocks = content.match(/<details>[\s\S]*?<\/details>/g) || [];
console.log(`Processing ${detailsBlocks.length} session blocks...`);

const sessions = [];
const sets = [];

detailsBlocks.forEach((block, bIdx) => {
  const summaryMatch = block.match(/<summary><b>(.*?)<\/b><\/summary>/);
  if (!summaryMatch) return;
  const rawTitle = summaryMatch[1].trim();

  // Parse Date
  const dateMatch = rawTitle.match(/(\d{1,2})\/(\d{1,2})/);
  if (!dateMatch) return;
  const m = parseInt(dateMatch[1], 10);
  const d = parseInt(dateMatch[2], 10);
  const mStr = m.toString().padStart(2, '0');
  const dStr = d.toString().padStart(2, '0');
  const dateStr = `2026-${mStr}-${dStr}`;
  const monthKey = `2026-${mStr}`;

  // Parse Target Muscle
  let target = '胸';
  if (rawTitle.includes('胸')) target = '胸';
  else if (rawTitle.includes('背')) target = '背';
  else if (rawTitle.includes('腿')) target = '腿';
  else if (rawTitle.includes('游泳')) target = '游泳';

  // Determine Location
  let loc = '三健客';
  if (rawTitle.includes('永和國民運動中心') || dateStr === '2026-08-29') {
    loc = '永和國民運動中心';
  } else if (rawTitle.includes('四號公園') || dateStr === '2026-08-30') {
    loc = '四號公園';
  } else if (rawTitle.includes('清大') || (target === '游泳' && dateStr === '2026-08-16')) {
    loc = '清大游泳池';
  } else if (rawTitle.includes('zyx') || (target === '游泳' && dateStr === '2026-07-24')) {
    loc = 'zyx家游泳池';
  } else if (target === '游泳') {
    loc = '交大游泳池';
  } else if (dateStr <= '2026-08-31') {
    loc = '交大健身房';
  } else {
    // 9月及之後
    if (rawTitle.includes('交大健身房') || rawTitle.includes('學校健身房')) {
      loc = '交大健身房';
    } else {
      loc = '三健客';
    }
  }

  // Monthly Index
  const idxMatch = rawTitle.match(/第\s*(\d+)\s*次/);
  const monthlyIndex = idxMatch ? parseInt(idxMatch[1], 10) : 1;

  const sessionId = `session-${dateStr}-${monthlyIndex}`;

  const session = {
    id: sessionId,
    date: dateStr,
    month_key: monthKey,
    display_title: rawTitle,
    target_muscle: target,
    monthly_index: monthlyIndex,
    location: loc,
    created_at: `${dateStr}T12:00:00.000Z`,
    updated_at: `${dateStr}T12:00:00.000Z`,
    sync_status: 'synced',
  };
  sessions.push(session);

  // Parse Sets within block
  const lines = block.split('\n');
  let currentExId = target === '游泳' ? 'ex-swim' : null;
  let setOrder = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.startsWith('<') || rawLine.startsWith('</')) continue;

    // Check if this is an exercise heading
    const exMatch = rawLine.match(/^-\s*([^-\n]+?)(?:[:：]|\s*$)/);
    if (exMatch && !rawLine.startsWith('- set') && !rawLine.includes('Kg') && !rawLine.includes('熱身') && !rawLine.includes('游泳') && !rawLine.includes('onboard')) {
      currentExId = matchExerciseId(exMatch[1]);
      continue;
    }

    // Swimming set
    if (target === '游泳' && rawLine.includes('游泳')) {
      setOrder++;
      const swimText = rawLine.replace(/^[-\s*]+/, '').trim();
      sets.push({
        id: `set-${sessionId}-${setOrder}`,
        session_id: sessionId,
        exercise_id: 'ex-swim',
        set_order: setOrder,
        set_type: 'normal',
        weight_kg: 0,
        reps: 1,
        raw_text: swimText,
        notes: swimText,
        created_at: session.created_at,
        updated_at: session.updated_at,
        sync_status: 'synced',
      });
      continue;
    }

    // Normal set line
    if (currentExId && (rawLine.startsWith('- set') || (rawLine.startsWith('-') && (rawLine.includes('Kg') || rawLine.includes('熱身') || rawLine.includes('自身體重'))))) {
      setOrder++;
      const clean = rawLine.replace(/^[-\s*]+/, '').trim();

      let setType = 'normal';
      if (clean.includes('熱身') || clean.includes('激發')) setType = 'warmup';
      else if (clean.includes('遞減') && !clean.includes('+')) setType = 'drop';

      let weight = 0;
      let reps = 0;
      const sub_fields = [];

      // Match main weight & reps before '+'
      const mainPart = clean.split('+')[0];
      const bwMatch = mainPart.match(/自身體重\s*x(\d+)/i);
      const wtMatch = mainPart.match(/(\d+(?:\.\d+)?)\s*Kg(?:\([^\)]+\))?\s*x(\d+)/i);

      if (wtMatch) {
        weight = parseFloat(wtMatch[1]);
        reps = parseInt(wtMatch[2], 10);
      } else if (bwMatch) {
        weight = 0;
        reps = parseInt(bwMatch[1], 10);
      } else {
        const altRepMatch = mainPart.match(/x\s*(\d+)/i);
        if (altRepMatch) reps = parseInt(altRepMatch[1], 10);
      }

      // Parse sub-fields after '+'
      const plusParts = clean.split('+').slice(1);
      plusParts.forEach(p => {
        const pt = p.trim();
        let mode = '休';
        if (pt.includes('補') || pt.includes('輔助') || pt.includes('輔')) mode = '補';
        else if (pt.includes('遞減') || pt.includes('降重')) mode = '遞減';
        else if (pt.includes('休')) mode = '休';

        const subWt = pt.match(/(\d+(?:\.\d+)?)\s*Kg\s*x(\d+)/i);
        const subRep = pt.match(/x\s*(\d+)/i) || pt.match(/(\d+)\s*下/) || pt.match(/(\d+)/);

        if (subWt) {
          sub_fields.push({
            mode: mode,
            weight_kg: parseFloat(subWt[1]),
            reps: parseInt(subWt[2], 10),
          });
        } else if (subRep) {
          sub_fields.push({
            mode: mode,
            reps: parseInt(subRep[1], 10),
          });
        }
      });

      // Feedback / Notes in parentheses
      let notes = undefined;
      const notesMatch = clean.match(/\((.*?)\)/);
      if (notesMatch) notes = notesMatch[1];

      sets.push({
        id: `set-${sessionId}-${setOrder}`,
        session_id: sessionId,
        exercise_id: currentExId,
        set_order: setOrder,
        set_type: setType,
        weight_kg: weight,
        reps: reps,
        raw_text: clean,
        notes: notes,
        sub_fields: sub_fields.length > 0 ? sub_fields : undefined,
        is_failure: clean.includes('力竭'),
        created_at: session.created_at,
        updated_at: session.updated_at,
        sync_status: 'synced',
      });
    }
  }
});

// Big Three
const bigThree = {
  id: 'big-three-global',
  bench_press_kg: 60,
  squat_kg: 85,
  deadlift_kg: 90,
  total_kg: 235,
  body_weight_kg: 60,
  bench_ratio: 1.0,
  squat_ratio: 1.42,
  deadlift_ratio: 1.5,
  updated_at: new Date().toISOString(),
  sync_status: 'synced',
};

console.log(`\n=== 整理統計 ===`);
console.log(`Sessions: ${sessions.length}`);
console.log(`Exercises: ${exercises.length}`);
console.log(`Sets: ${sets.length}`);

// Save to seed-data.json
const seedOutput = {
  bigThree,
  sessions,
  exercises,
  sets,
};

const targetJsonPath = path.resolve(__dirname, '../src/lib/db/seed-data.json');
fs.writeFileSync(targetJsonPath, JSON.stringify(seedOutput, null, 2), 'utf-8');
console.log(`Successfully written to: ${targetJsonPath}`);

// 4. Upload to Supabase
async function uploadToSupabase() {
  const envPath = path.resolve(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) {
    console.log('No .env.local found, skipping Supabase upload');
    return;
  }
  const envContent = fs.readFileSync(envPath, 'utf-8');
  let url = '';
  let key = '';
  envContent.split('\n').forEach(l => {
    const trimmed = l.trim();
    if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
      url = trimmed.replace('NEXT_PUBLIC_SUPABASE_URL=', '').trim().replace(/^["']|["']$/g, '');
    }
    if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
      key = trimmed.replace('NEXT_PUBLIC_SUPABASE_ANON_KEY=', '').trim().replace(/^["']|["']$/g, '');
    }
  });

  if (!url || !key) {
    console.log('Missing Supabase credentials in .env.local');
    return;
  }

  const supabase = createClient(url, key);
  console.log('Connecting to Supabase at:', url);

  // Upload exercises
  const exRows = exercises.map(e => ({
    id: e.id,
    name: e.name,
    muscle_group: e.muscle_group,
    weight_type: e.weight_type,
    is_favorite: e.is_favorite || false,
    created_at: e.created_at,
    updated_at: e.updated_at,
    deleted_at: e.deleted_at || null,
  }));
  const { error: exErr } = await supabase.from('exercises').upsert(exRows, { onConflict: 'id' });
  if (exErr) console.error('Exercises error:', exErr);
  else console.log(`✓ Upserted ${exRows.length} exercises to Supabase`);

  // Upload sessions
  const sessRows = sessions.map(s => ({
    id: s.id,
    date: s.date,
    month_key: s.month_key,
    display_title: s.display_title,
    target_muscle: s.target_muscle,
    monthly_index: s.monthly_index,
    notes: JSON.stringify({ location: s.location, raw: s.display_title }),
    created_at: s.created_at,
    updated_at: s.updated_at,
  }));

  for (let i = 0; i < sessRows.length; i += 50) {
    const chunk = sessRows.slice(i, i + 50);
    const { error: sessErr } = await supabase.from('workout_sessions').upsert(chunk, { onConflict: 'id' });
    if (sessErr) console.error('Sessions chunk error:', sessErr);
  }
  console.log(`✓ Upserted ${sessRows.length} sessions to Supabase`);

  // Upload sets
  const setRows = sets.map(s => ({
    id: s.id,
    session_id: s.session_id,
    exercise_id: s.exercise_id,
    set_order: s.set_order,
    set_type: s.set_type,
    weight_kg: s.weight_kg,
    reps: s.reps,
    raw_text: s.raw_text,
    notes: s.sub_fields ? JSON.stringify(s.sub_fields) : s.notes || null,
    is_failure: s.is_failure || false,
    created_at: s.created_at,
    updated_at: s.updated_at,
  }));

  for (let i = 0; i < setRows.length; i += 200) {
    const chunk = setRows.slice(i, i + 200);
    const { error: setErr } = await supabase.from('workout_sets').upsert(chunk, { onConflict: 'id' });
    if (setErr) console.error('Sets chunk error:', setErr);
  }
  console.log(`✓ Upserted ${setRows.length} sets to Supabase`);

  // Upload Big Three
  const { error: b3Err } = await supabase.from('big_three_records').upsert([{
    id: 'big-three-global',
    bench_press_kg: bigThree.bench_press_kg,
    squat_kg: bigThree.squat_kg,
    deadlift_kg: bigThree.deadlift_kg,
    total_kg: bigThree.total_kg,
    body_weight_kg: bigThree.body_weight_kg,
    bench_ratio: bigThree.bench_ratio,
    squat_ratio: bigThree.squat_ratio,
    deadlift_ratio: bigThree.deadlift_ratio,
    updated_at: bigThree.updated_at,
  }], { onConflict: 'id' });
  if (b3Err) console.error('Big Three error:', b3Err);
  else console.log('✓ Upserted Big Three record to Supabase');

  console.log('\n🌟 Complete cloud synchronization finished successfully!');
}

uploadToSupabase().catch(console.error);

import json
import re

with open('scripts/supa_sessions.json', 'r', encoding='utf-8') as f:
    supa_sessions = json.load(f)

print(f"Loaded {len(supa_sessions)} sessions from scripts/supa_sessions.json")

# Create lookup map by (date, title) or date
supa_by_date = {}
used_supa_ids = set()

for s in supa_sessions:
    d = s['date']
    if d not in supa_by_date:
        supa_by_date[d] = []
    supa_by_date[d].append(s)

# Read raw journal markdown
with open('scripts/raw_journal.md', 'r', encoding='utf-8') as f:
    text = f.read()

# Canonical exercise definitions
CANONICAL_EXERCISES = {
    # 胸
    "槓鈴臥推": {"id": "ex-bench", "name": "槓鈴臥推", "muscle_group": "胸", "weight_type": "barbell_total"},
    "上斜槓鈴臥推": {"id": "ex-incline-bench", "name": "上斜槓鈴臥推", "muscle_group": "胸", "weight_type": "barbell_total"},
    "下斜槓鈴臥推": {"id": "ex-decline-bench", "name": "下斜槓鈴臥推", "muscle_group": "胸", "weight_type": "barbell_total"},
    "史密斯槓鈴臥推": {"id": "ex-smith-bench", "name": "史密斯槓鈴臥推", "muscle_group": "胸", "weight_type": "barbell_total"},
    "啞鈴平臥推": {"id": "ex-db-bench", "name": "啞鈴平臥推", "muscle_group": "胸", "weight_type": "dumbbell_single"},
    "啞鈴上斜臥推": {"id": "ex-db-incline-bench", "name": "啞鈴上斜臥推", "muscle_group": "胸", "weight_type": "dumbbell_single"},
    "蝴蝶機夾胸": {"id": "ex-pec-fly", "name": "蝴蝶機夾胸", "muscle_group": "胸", "weight_type": "machine_stack"},
    "胸部推舉機": {"id": "ex-chest-press-machine", "name": "胸部推舉機", "muscle_group": "胸", "weight_type": "machine_stack"},
    "坐姿胸推機器": {"id": "ex-chest-press-seated", "name": "坐姿胸推機器", "muscle_group": "胸", "weight_type": "machine_stack"},
    "上斜機器臥推": {"id": "ex-incline-machine-bench", "name": "上斜機器臥推", "muscle_group": "胸", "weight_type": "machine_single"},
    "三頭下壓機 寬 (主攻下胸)": {"id": "ex-dip-pushdown-machine", "name": "三頭下壓機 寬 (主攻下胸)", "muscle_group": "胸", "weight_type": "machine_stack"},
    "繩索三頭下壓": {"id": "ex-rope-tricep", "name": "繩索三頭下壓", "muscle_group": "胸", "weight_type": "machine_stack"},
    "繩索夾胸": {"id": "ex-cable-crossover", "name": "繩索夾胸", "muscle_group": "胸", "weight_type": "machine_stack"},
    "輔助雙槓臂屈伸機": {"id": "ex-assisted-dip", "name": "輔助雙槓臂屈伸機", "muscle_group": "胸", "weight_type": "assisted_inverse"},

    # 腿
    "槓鈴深蹲": {"id": "ex-squat", "name": "槓鈴深蹲", "muscle_group": "腿", "weight_type": "barbell_total"},
    "大腿推蹬機": {"id": "ex-leg-press", "name": "大腿推蹬機", "muscle_group": "腿", "weight_type": "machine_stack"},
    "臥式腿部彎舉機": {"id": "ex-leg-curl", "name": "臥式腿部彎舉機", "muscle_group": "腿", "weight_type": "machine_stack"},
    "保加利亞分腿蹲": {"id": "ex-bulgarian-squat", "name": "保加利亞分腿蹲", "muscle_group": "腿", "weight_type": "dumbbell_single"},
    "腿部伸張機": {"id": "ex-leg-extension", "name": "腿部伸張機", "muscle_group": "腿", "weight_type": "machine_stack"},
    "哈克深蹲": {"id": "ex-hack-squat", "name": "哈克深蹲", "muscle_group": "腿", "weight_type": "machine_single"},

    # 背
    "槓鈴硬舉": {"id": "ex-deadlift", "name": "槓鈴硬舉", "muscle_group": "背", "weight_type": "barbell_total"},
    "六角槓硬舉": {"id": "ex-trap-bar-deadlift", "name": "六角槓硬舉", "muscle_group": "背", "weight_type": "barbell_total"},
    "自重引體向上": {"id": "ex-pullup", "name": "自重引體向上", "muscle_group": "背", "weight_type": "bodyweight"},
    "輔助引體向上": {"id": "ex-assisted-pullup", "name": "輔助引體向上", "muscle_group": "背", "weight_type": "assisted_inverse"},
    "雙軌滑輪下拉": {"id": "ex-lat-pulldown", "name": "雙軌滑輪下拉", "muscle_group": "背", "weight_type": "machine_stack"},
    "高拉背部划船機": {"id": "ex-high-row", "name": "高拉背部划船機", "muscle_group": "背", "weight_type": "machine_single"},
    "高位反手下拉": {"id": "ex-underhand-pulldown", "name": "高位反手下拉", "muscle_group": "背", "weight_type": "machine_single"},
    "坐姿划船機": {"id": "ex-seated-row", "name": "坐姿划船機", "muscle_group": "背", "weight_type": "machine_single"},
    "坐式背部划船機": {"id": "ex-seated-cable-row", "name": "坐式背部划船機", "muscle_group": "背", "weight_type": "machine_stack"},
    "槓鈴划船": {"id": "ex-barbell-row", "name": "槓鈴划船", "muscle_group": "背", "weight_type": "barbell_total"},
    "單手啞鈴划船": {"id": "ex-db-single-row", "name": "單手啞鈴划船", "muscle_group": "背", "weight_type": "dumbbell_single"},
    "啞鈴槌式彎舉": {"id": "ex-db-hammer-curl", "name": "啞鈴槌式彎舉", "muscle_group": "背", "weight_type": "dumbbell_single"},
    "上斜啞鈴彎舉": {"id": "ex-incline-db-curl", "name": "上斜啞鈴彎舉", "muscle_group": "背", "weight_type": "dumbbell_single"},

    # 肩
    "啞鈴肩推": {"id": "ex-db-shoulder-press", "name": "啞鈴肩推", "muscle_group": "肩", "weight_type": "dumbbell_single"},
    "單臂滑輪側平舉": {"id": "ex-cable-lateral-raise", "name": "單臂滑輪側平舉", "muscle_group": "肩", "weight_type": "machine_stack"},
    "繩索面拉": {"id": "ex-cable-face-pull", "name": "繩索面拉", "muscle_group": "肩", "weight_type": "machine_stack"},
    "反向蝴蝶機 (後三角)": {"id": "ex-reverse-pec-fly", "name": "反向蝴蝶機 (後三角)", "muscle_group": "肩", "weight_type": "machine_stack"},

    # 游泳
    "游泳": {"id": "ex-swim", "name": "游泳", "muscle_group": "游泳", "weight_type": "bodyweight"},
}

def map_exercise_name(raw_name: str) -> str:
    clean = raw_name.replace('- ', '').split('：')[0].split(':')[0].strip()
    clean = re.sub(r'\(.*?\)', '', clean).strip()
    clean = re.sub(r'（.*?）', '', clean).strip()

    if "槓鈴臥推" in clean or "平胸臥推" in clean:
        if "上斜" in clean:
            return "上斜槓鈴臥推"
        if "下斜" in clean:
            return "下斜槓鈴臥推"
        if "史密斯" in clean:
            return "史密斯槓鈴臥推"
        return "槓鈴臥推"

    if "啞鈴" in clean and ("臥推" in clean or "平推" in clean):
        if "上斜" in clean:
            return "啞鈴上斜臥推"
        return "啞鈴平臥推"

    if "蝴蝶機" in clean or "反向蝴蝶機" in clean:
        if "後三角" in clean or "反向" in clean:
            return "反向蝴蝶機 (後三角)"
        return "蝴蝶機夾胸"

    if "引體" in clean:
        if "輔助" in clean:
            return "輔助引體向上"
        return "自重引體向上"

    if "胸推" in clean:
        if "推舉機" in clean:
            return "胸部推舉機"
        return "坐姿胸推機器"

    if "雙槓" in clean:
        return "輔助雙槓臂屈伸機"

    if "深蹲" in clean:
        if "哈克" in clean:
            return "哈克深蹲"
        if "分腿" in clean:
            return "保加利亞分腿蹲"
        return "槓鈴深蹲"

    if "腿推" in clean or "推蹬" in clean:
        return "大腿推蹬機"

    if "腿部彎舉" in clean or "腿後" in clean:
        return "臥式腿部彎舉機"

    if "腿部伸張" in clean or "伸展" in clean:
        return "腿部伸張機"

    if "硬舉" in clean:
        if "六角" in clean:
            return "六角槓硬舉"
        return "槓鈴硬舉"

    if "滑輪下拉" in clean:
        if "反手" in clean or "高位" in clean:
            return "高位反手下拉"
        return "雙軌滑輪下拉"

    if "反手下拉" in clean:
        return "高位反手下拉"

    if "高拉" in clean and "划船" in clean:
        return "高拉背部划船機"

    if "划船" in clean:
        if "槓鈴" in clean:
            return "槓鈴划船"
        if "單手" in clean or "啞鈴" in clean:
            return "單手啞鈴划船"
        if "背部划船機" in clean or "坐式" in clean:
            return "坐式背部划船機"
        return "坐姿划船機"

    if "肩推" in clean:
        return "啞鈴肩推"

    if "側平舉" in clean or "側揚" in clean:
        return "單臂滑輪側平舉"

    if "面拉" in clean:
        return "繩索面拉"

    if "彎舉" in clean:
        if "上斜" in clean:
            return "上斜啞鈴彎舉"
        return "啞鈴槌式彎舉"

    if "下壓" in clean:
        if "三頭下壓機" in clean:
            return "三頭下壓機 寬 (主攻下胸)"
        return "繩索三頭下壓"

    if "夾胸" in clean:
        return "繩索夾胸"

    if "游泳" in clean:
        return "游泳"

    return clean

def parse_set_line(line: str):
    is_warmup = '熱身' in line
    is_drop = '遞減' in line
    is_failure = '力竭' in line or 'FAIL' in line or 'fail' in line
    set_type = "warmup" if is_warmup else ("dropset" if is_drop else "normal")

    w_match = re.search(r'(\d+(?:\.\d+)?)\s*Kg', line, re.IGNORECASE)
    weight_kg = float(w_match.group(1)) if w_match else 0.0

    r_match = re.search(r'x\s*(\d+(?:\.\d+)?)', line, re.IGNORECASE)
    reps = float(r_match.group(1)) if r_match else 0.0
    if reps.is_integer():
        reps = int(reps)

    f_match = re.search(r'補\s*(\d+)', line)
    forced_reps = int(f_match.group(1)) if f_match else None

    # rest pause
    rest_detail = None
    rp_matches = re.findall(r'休\s*(\d*)', line)
    if rp_matches:
        rest_detail = line.strip()

    feedback = None
    if '動作不標準' in line:
        feedback = '動作不標準'
    elif '強迫次數' in line:
        feedback = '強迫次數'
    elif '吃力' in line:
        feedback = '吃力'
    elif '微力竭' in line:
        feedback = '微力竭'
    elif '完全力竭' in line:
        feedback = '完全力竭'

    raw_clean = line.replace('- ', '').strip()

    return {
        "set_type": set_type,
        "weight_kg": weight_kg,
        "reps": reps,
        "forced_reps": forced_reps,
        "rest_pause_detail": rest_detail,
        "is_failure": is_failure,
        "feedback": feedback,
        "raw_text": raw_clean
    }

# Split details
blocks = re.findall(r'<details>(.*?)</details>', text, re.DOTALL)
print(f"Total markdown blocks: {len(blocks)}")

parsed_sessions = []
parsed_sets = []

for b in blocks:
    sum_m = re.search(r'<summary><b>(.*?)</b></summary>', b)
    if not sum_m:
        continue
    summary_text = sum_m.group(1).strip()

    # parse date, target, location, index
    m_part = re.search(r'(\d{1,2})\/(\d{1,2})(?:\s*\((.*?)\))?', summary_text)
    if not m_part:
        continue
    m = int(m_part.group(1))
    d = int(m_part.group(2))
    raw_target = m_part.group(3) or "胸"
    target_muscle = "胸"
    if "胸" in raw_target: target_muscle = "胸"
    elif "背" in raw_target: target_muscle = "背"
    elif "腿" in raw_target: target_muscle = "腿"
    elif "肩" in raw_target: target_muscle = "肩"
    elif "泳" in raw_target or "游泳" in summary_text: target_muscle = "游泳"

    current_year = 2026
    date_str = f"{current_year}-{m:02d}-{d:02d}"
    month_key = f"{current_year}-{m:02d}"

    idx_m = re.search(r'第\s*(\d+)\s*次', summary_text)
    monthly_idx = int(idx_m.group(1)) if idx_m else 1

    location = "三健客" if m >= 9 else "交大健身房"
    if "游泳" in summary_text or target_muscle == "游泳":
        location = "交大游泳池"
    if "zyx家游泳池" in summary_text: location = "zyx家游泳池"
    if "清大游泳池" in summary_text: location = "清大游泳池"
    if "永和國民運動中心" in summary_text: location = "永和國民運動中心"
    if "四號公園" in summary_text: location = "四號公園"
    if "三健客" in summary_text: location = "三健客"
    if "交大健身房" in summary_text: location = "交大健身房"

    # Match with Supabase session ID!
    matched_supa_id = None
    if date_str in supa_by_date:
        candidates = [c for c in supa_by_date[date_str] if c['id'] not in used_supa_ids]
        if len(candidates) == 1:
            matched_supa_id = candidates[0]['id']
        elif len(candidates) > 1:
            # check monthly_index match
            for c in candidates:
                if c.get('monthly_index') == monthly_idx:
                    matched_supa_id = c['id']
                    break
            if not matched_supa_id:
                # check target_muscle match
                for c in candidates:
                    if target_muscle in c.get('target_muscle', ''):
                        matched_supa_id = c['id']
                        break
            if not matched_supa_id:
                matched_supa_id = candidates[0]['id']

    if not matched_supa_id:
        matched_supa_id = f"session-{date_str}-{monthly_idx}"

    used_supa_ids.add(matched_supa_id)

    sess_obj = {
        "id": matched_supa_id,
        "date": date_str,
        "month_key": month_key,
        "display_title": summary_text,
        "target_muscle": target_muscle,
        "monthly_index": monthly_idx,
        "location": location,
        "created_at": f"{date_str}T08:00:00.000Z",
        "updated_at": f"{date_str}T08:00:00.000Z",
        "sync_status": "synced"
    }
    parsed_sessions.append(sess_obj)
    sid = matched_supa_id

    # Parse sets
    lines = [l.strip() for l in b.split('\n') if l.strip()]
    if target_muscle == "游泳":
        parsed_sets.append({
            "id": f"set-{sid}-1",
            "session_id": sid,
            "exercise_id": "ex-swim",
            "set_order": 1,
            "set_type": "normal",
            "weight_kg": 0,
            "reps": 1,
            "is_completed": True,
            "raw_text": summary_text,
            "created_at": sess_obj["created_at"],
            "updated_at": sess_obj["updated_at"],
            "sync_status": "synced"
        })
        continue

    current_ex_name = None
    set_order = 0

    for line in lines:
        if line.startswith('<'):
            continue

        is_ex_header = (
            line.startswith('- ')
            and ('：' in line or ':' in line)
            and not line.startswith('- set')
            and not 'Kg' in line.split('：')[0].split(':')[0]
            and not '新機器 set' in line
            and not '舊機器 set' in line
        )

        if is_ex_header:
            raw_ex = line.replace('- ', '').split('：')[0].split(':')[0].strip()
            if "額外加碼測試" in raw_ex:
                current_ex_name = "啞鈴平臥推"
                continue
            if "超級組" in raw_ex:
                current_ex_name = "自重引體向上"
                continue

            current_ex_name = map_exercise_name(raw_ex)
            continue

        is_set_line = (
            line.startswith('- set')
            or 'set ' in line
            or 'Kg x' in line
            or '自身體重 x' in line
            or '0Kg x' in line
            or re.search(r'^\s*-\s*\d+(?:\.\d+)?Kg', line)
            or '平板啞鈴臥推:' in line
            or '自身體重' in line
        )

        if is_set_line and current_ex_name:
            set_info = parse_set_line(line)

            if "引體" in line and "槓鈴划船" in line:
                set_order += 1
                parsed_sets.append({
                    "id": f"set-{sid}-{set_order}",
                    "session_id": sid,
                    "exercise_id": "ex-pullup",
                    "set_order": set_order,
                    "set_type": "normal",
                    "weight_kg": 0,
                    "reps": 4,
                    "is_completed": True,
                    "raw_text": "自身體重 x4 + 休2",
                    "created_at": sess_obj["created_at"],
                    "updated_at": sess_obj["updated_at"],
                    "sync_status": "synced"
                })
                set_order += 1
                parsed_sets.append({
                    "id": f"set-{sid}-{set_order}",
                    "session_id": sid,
                    "exercise_id": "ex-barbell-row",
                    "set_order": set_order,
                    "set_type": "normal",
                    "weight_kg": 30 if "30Kg" in line else 35,
                    "reps": 10,
                    "is_completed": True,
                    "raw_text": "槓鈴划船 x10",
                    "created_at": sess_obj["created_at"],
                    "updated_at": sess_obj["updated_at"],
                    "sync_status": "synced"
                })
                continue

            target_ex = current_ex_name
            if "平板啞鈴臥推" in line or "啞鈴臥推" in line:
                target_ex = "啞鈴平臥推"

            ex_def = CANONICAL_EXERCISES.get(target_ex)
            ex_id = ex_def["id"] if ex_def else f"ex-{target_ex}"

            set_order += 1
            parsed_sets.append({
                "id": f"set-{sid}-{set_order}",
                "session_id": sid,
                "exercise_id": ex_id,
                "set_order": set_order,
                "set_type": set_info["set_type"],
                "weight_kg": set_info["weight_kg"],
                "reps": set_info["reps"],
                "forced_reps": set_info["forced_reps"],
                "rest_pause_detail": set_info["rest_pause_detail"],
                "is_failure": set_info["is_failure"],
                "is_completed": True,
                "feedback": set_info["feedback"],
                "raw_text": set_info["raw_text"],
                "created_at": sess_obj["created_at"],
                "updated_at": sess_obj["updated_at"],
                "sync_status": "synced"
            })

# Add any Supabase session that was missing from raw markdown (e.g. 7/22 second swim, 7/27 second swim)
for s in supa_sessions:
    if s['id'] not in used_supa_ids:
        print(f"Adding extra Supabase session: {s['id']} {s['display_title']}")
        parsed_sessions.append({
            "id": s['id'],
            "date": s['date'],
            "month_key": s['date'][:7],
            "display_title": s['display_title'],
            "target_muscle": s['target_muscle'],
            "monthly_index": s['monthly_index'],
            "location": "交大游泳池",
            "created_at": f"{s['date']}T18:00:00.000Z",
            "updated_at": f"{s['date']}T18:00:00.000Z",
            "sync_status": "synced"
        })
        parsed_sets.append({
            "id": f"set-{s['id']}-1",
            "session_id": s['id'],
            "exercise_id": "ex-swim",
            "set_order": 1,
            "set_type": "normal",
            "weight_kg": 0,
            "reps": 1,
            "is_completed": True,
            "raw_text": s['display_title'],
            "created_at": f"{s['date']}T18:00:00.000Z",
            "updated_at": f"{s['date']}T18:00:00.000Z",
            "sync_status": "synced"
        })

# Sort sessions by date
parsed_sessions.sort(key=lambda s: s['date'])

print(f"Generated {len(parsed_sessions)} sessions, {len(parsed_sets)} sets with exact Supabase IDs!")
pullup_sets = [s for s in parsed_sets if s['exercise_id'] in ('ex-pullup', 'ex-assisted-pullup')]
print(f"Total pullup sets: {len(pullup_sets)}")

formatted_exercises = []
for name, data in CANONICAL_EXERCISES.items():
    formatted_exercises.append({
        "id": data["id"],
        "name": data["name"],
        "muscle_group": data["muscle_group"],
        "weight_type": data["weight_type"],
        "created_at": "2026-06-01T00:00:00.000Z",
        "updated_at": "2026-11-14T00:00:00.000Z",
        "sync_status": "synced"
    })

big_three = {
    "id": "big-three-latest",
    "bench_press_kg": 60,
    "squat_kg": 85,
    "deadlift_kg": 90,
    "total_kg": 235,
    "body_weight_kg": 63.6,
    "bench_ratio": 0.94,
    "squat_ratio": 1.34,
    "deadlift_ratio": 1.42,
    "updated_at": "2026-11-14T00:00:00.000Z",
    "sync_status": "synced"
}

output_data = {
    "bigThree": big_three,
    "exercises": formatted_exercises,
    "sessions": parsed_sessions,
    "sets": parsed_sets
}

with open('src/lib/db/seed-data.json', 'w', encoding='utf-8') as f:
    json.dump(output_data, f, ensure_ascii=False, indent=2)

print("Saved seed-data.json with 100% exact IDs!")

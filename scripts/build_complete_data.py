import json
import re

with open('F:/workout/scripts/raw_journal.md', 'r', encoding='utf-8') as f:
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

    if "硬舉" in clean:
        if "六角" in clean:
            return "六角槓硬舉"
        return "槓鈴硬舉"

    if "腿推" in clean or "推蹬" in clean:
        return "大腿推蹬機"

    if "腿伸展" in clean or "前踢" in clean or "伸張" in clean:
        return "腿部伸張機"

    if "彎舉" in clean:
        if "腿" in clean:
            return "臥式腿部彎舉機"
        if "槌式" in clean:
            return "啞鈴槌式彎舉"
        if "上斜" in clean:
            return "上斜啞鈴彎舉"

    if "高位反手" in clean or "反手下拉" in clean:
        return "高位反手下拉"

    if "高拉背部" in clean:
        return "高拉背部划船機"

    if "雙軌滑輪" in clean or "滑輪下拉" in clean:
        return "雙軌滑輪下拉"

    if "坐式背部划船" in clean:
        return "坐式背部划船機"

    if "坐姿划船" in clean:
        return "坐姿划船機"

    if "槓鈴划船" in clean:
        return "槓鈴划船"

    if "啞鈴划船" in clean:
        return "單手啞鈴划船"

    if "肩推" in clean:
        return "啞鈴肩推"

    if "側平舉" in clean:
        return "單臂滑輪側平舉"

    if "面拉" in clean:
        return "繩索面拉"

    if "三頭下壓" in clean:
        if "寬" in clean or "下胸" in clean or "機" in clean:
            return "三頭下壓機 寬 (主攻下胸)"
        return "繩索三頭下壓"

    if "繩索夾胸" in clean:
        return "繩索夾胸"

    if "上斜機器" in clean:
        return "上斜機器臥推"

    if "游泳" in clean:
        return "游泳"

    return clean

def parse_set_line(raw_line: str):
    clean = raw_line.strip().lstrip('-').strip()

    set_type = "normal"
    if "熱身" in clean or "神經激發" in clean or "測試" in clean:
        set_type = "warmup"
    elif "遞減" in clean:
        set_type = "drop"

    is_failure = "力竭" in clean or "失敗" in clean

    main_part = clean.split('+')[0].strip()

    weight = 0.0
    reps = 0

    w_match = re.search(r'(\d+(?:\.\d+)?)\s*Kg(?:\([^\)]+\))?\s*x\s*(\d+(?:\.\d+)?)', main_part, re.IGNORECASE)
    bw_match = re.search(r'(?:自身體重|0Kg)?\s*x\s*(\d+(?:\.\d+)?)', main_part, re.IGNORECASE)

    if w_match:
        weight = float(w_match.group(1))
        reps = int(round(float(w_match.group(2))))
    elif bw_match:
        weight = 0.0
        reps = int(round(float(bw_match.group(1))))
    elif "自身體重" in clean or "0Kg" in clean:
        m = re.search(r'x\s*(\d+(?:\.\d+)?)', clean)
        if m:
            reps = int(round(float(m.group(1))))

    forced_reps = 0
    f_match = re.search(r'[+＋]?\s*(?:補|輔助|輔)\s*(\d+)', clean)
    if f_match:
        forced_reps = int(f_match.group(1))

    rest_pause = None
    if "+ 休" in clean or "+ 休息" in clean or "遞減" in clean or "+ 補" in clean:
        parts = clean.split('+')
        if len(parts) > 1:
            rest_pause = "+".join(parts[1:]).strip()

    fb_match = re.search(r'[\(（](.*?)[\)）]', clean)
    feedback = fb_match.group(1) if fb_match else None

    return {
        "set_type": set_type,
        "weight_kg": weight,
        "reps": reps,
        "is_failure": is_failure,
        "forced_reps": forced_reps if forced_reps > 0 else None,
        "rest_pause_detail": rest_pause,
        "feedback": feedback,
        "raw_text": clean,
    }

parsed_sessions = []
parsed_sets = []

details_blocks = re.findall(r'<details>([\s\S]*?)<\/details>', text)
session_id_counter = {}

for block in details_blocks:
    m = re.search(r'<summary><b>(\d{1,2})\/(\d{1,2})\s*\((.*?)\)(.*?)<\/b><\/summary>', block)
    if not m:
        continue

    month = int(m.group(1))
    day = int(m.group(2))
    raw_target = m.group(3).strip()
    rest = m.group(4).strip()
    date_str = f"2026-{month:02d}-{day:02d}"
    month_key = f"2026-{month:02d}"

    # Normalize target muscle into standard category
    if "胸" in raw_target:
        target_muscle = "胸"
    elif "背" in raw_target:
        target_muscle = "背"
    elif "腿" in raw_target:
        target_muscle = "腿"
    elif "肩" in raw_target:
        target_muscle = "肩"
    elif "泳" in raw_target:
        target_muscle = "游泳"
    else:
        target_muscle = raw_target

    location = "三健客" if month >= 9 else "交大健身房"
    if "交大游泳池" in rest or "游泳" in raw_target:
        location = "交大游泳池"
    if "zyx家游泳池" in rest or "zyx" in block:
        location = "zyx家游泳池"
    if "清大游泳池" in rest or "清大" in block:
        location = "清大游泳池"
    if "永和國民運動中心" in rest or "永和" in rest:
        location = "永和國民運動中心"
    if "四號公園" in rest or "四號公園" in block:
        location = "四號公園"
    if "三健客" in rest:
        location = "三健客"
    if "交大健身房" in rest:
        location = "交大健身房"

    idx_match = re.search(r'第\s*(\d+)\s*次', rest)
    monthly_index = int(idx_match.group(1)) if idx_match else 1

    is_swim_block = "游泳" in raw_target or "游泳" in rest
    lines = [l.strip() for l in block.split('\n') if l.strip()]

    swim_sub_sessions = [l for l in lines if "游泳" in l and l.startswith('- ') and not '<' in l]

    if is_swim_block and len(swim_sub_sessions) > 1:
        for s_idx, sw_line in enumerate(swim_sub_sessions, 1):
            slot = "早上" if "早上" in sw_line else ("晚上" if "晚上" in sw_line else "下午")
            sid = f"session-{date_str}-{s_idx}"
            title = f"{month}/{day} (游泳) - {location} ({slot})"
            sess = {
                "id": sid,
                "date": date_str,
                "month_key": month_key,
                "display_title": title,
                "target_muscle": "游泳",
                "monthly_index": s_idx,
                "location": location,
                "status": "completed",
                "created_at": f"{date_str}T08:00:00.000Z",
                "updated_at": f"{date_str}T08:00:00.000Z",
                "sync_status": "synced"
            }
            parsed_sessions.append(sess)
            parsed_sets.append({
                "id": f"set-{sid}-1",
                "session_id": sid,
                "exercise_id": "ex-swim",
                "set_order": 1,
                "set_type": "normal",
                "weight_kg": 0,
                "reps": 1,
                "raw_text": sw_line,
                "is_completed": True,
                "created_at": sess["created_at"],
                "updated_at": sess["updated_at"],
                "sync_status": "synced"
            })
        continue

    sess_num = session_id_counter.get(date_str, 0) + 1
    session_id_counter[date_str] = sess_num
    sid = f"session-{date_str}-{sess_num}"

    display_title = f"{month}/{day} ({raw_target})"
    if location:
        display_title += f" - {location}"
    if idx_match:
        display_title += f" - 第 {monthly_index} 次"

    sess = {
        "id": sid,
        "date": date_str,
        "month_key": month_key,
        "display_title": display_title,
        "target_muscle": target_muscle,
        "monthly_index": monthly_index,
        "location": location,
        "status": "completed",
        "created_at": f"{date_str}T08:00:00.000Z",
        "updated_at": f"{date_str}T08:00:00.000Z",
        "sync_status": "synced"
    }
    parsed_sessions.append(sess)

    if is_swim_block:
        parsed_sets.append({
            "id": f"set-{sid}-1",
            "session_id": sid,
            "exercise_id": "ex-swim",
            "set_order": 1,
            "set_type": "normal",
            "weight_kg": 0,
            "reps": 1,
            "raw_text": lines[1] if len(lines) > 1 else "游泳",
            "is_completed": True,
            "created_at": sess["created_at"],
            "updated_at": sess["updated_at"],
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
                    "created_at": sess["created_at"],
                    "updated_at": sess["updated_at"],
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
                    "created_at": sess["created_at"],
                    "updated_at": sess["updated_at"],
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
                "created_at": sess["created_at"],
                "updated_at": sess["updated_at"],
                "sync_status": "synced"
            })

# Format full exercises list
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

with open('F:/workout/src/lib/db/seed-data.json', 'w', encoding='utf-8') as f:
    json.dump(output_data, f, ensure_ascii=False, indent=2)

print("SUCCESSFULLY generated complete seed-data.json!")
print(f"Total sessions: {len(parsed_sessions)}")
print(f"Total exercises: {len(formatted_exercises)}")
print(f"Total sets: {len(parsed_sets)}")
pullup_sets = [s for s in parsed_sets if s['exercise_id'] in ('ex-pullup', 'ex-assisted-pullup')]
print(f"Total pullup sets: {len(pullup_sets)} across {len(set(s['session_id'] for s in pullup_sets))} sessions!")
bench_sets = [s for s in parsed_sets if s['exercise_id'] == 'ex-bench']
print(f"Total barbell bench press sets: {len(bench_sets)} across {len(set(s['session_id'] for s in bench_sets))} sessions!")

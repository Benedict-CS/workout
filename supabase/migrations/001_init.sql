-- ==========================================
-- 001_init.sql: 力量訓練 (Workout Tracker) 初始化資料表
-- ==========================================

-- 1. 訓練日誌 (Workout Sessions)
create table if not exists public.workout_sessions (
    id text primary key,
    user_id uuid references auth.users(id) on delete cascade default auth.uid(),
    date date not null,
    month_key text not null,
    display_title text not null,
    target_muscle text not null,
    monthly_index int not null default 1,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

-- 2. 動作庫 (Exercises)
create table if not exists public.exercises (
    id text primary key,
    user_id uuid references auth.users(id) on delete cascade default auth.uid(),
    name text not null,
    muscle_group text not null,
    weight_type text not null default 'barbell_total',
    default_notes text,
    is_favorite boolean default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

-- 3. 組數紀錄 (Workout Sets)
create table if not exists public.workout_sets (
    id text primary key,
    user_id uuid references auth.users(id) on delete cascade default auth.uid(),
    session_id text not null references public.workout_sessions(id) on delete cascade,
    exercise_id text not null references public.exercises(id) on delete cascade,
    set_order int not null,
    set_type text not null default 'normal',
    weight_kg numeric not null default 0,
    reps int not null default 0,
    raw_text text,
    rest_pause_detail text,
    forced_reps int,
    is_failure boolean default false,
    feedback text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

-- 4. 三項最高紀錄 (Big Three Records)
create table if not exists public.big_three_records (
    id text primary key,
    user_id uuid references auth.users(id) on delete cascade default auth.uid(),
    bench_press_kg numeric not null default 0,
    squat_kg numeric not null default 0,
    deadlift_kg numeric not null default 0,
    total_kg numeric not null default 0,
    body_weight_kg numeric,
    bench_ratio numeric,
    squat_ratio numeric,
    deadlift_ratio numeric,
    updated_at timestamptz not null default now()
);

-- 索引優化
create index if not exists idx_sessions_user_date on public.workout_sessions (user_id, date desc);
create index if not exists idx_sets_session on public.workout_sets (session_id, set_order);
create index if not exists idx_sets_exercise on public.workout_sets (exercise_id);
create index if not exists idx_exercises_user on public.exercises (user_id, muscle_group);

-- 啟用 RLS
alter table public.workout_sessions enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.big_three_records enable row level security;

-- RLS 政策 (每個使用者只能存取與修改自己的資料)
create policy "Users can manage their own workout sessions"
    on public.workout_sessions for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can manage their own exercises"
    on public.exercises for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can manage their own workout sets"
    on public.workout_sets for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can manage their own big three records"
    on public.big_three_records for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

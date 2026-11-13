-- ========================================================
-- 002_body_composition.sql: 身體成分與體重追蹤表 (Body Weights)
-- ========================================================

create table if not exists public.body_weights (
    id text primary key,
    user_id uuid references auth.users(id) on delete cascade default auth.uid(),
    date date not null unique,
    weight_kg numeric not null,
    body_fat_pct numeric,          -- 體脂率 (%)
    skeletal_muscle_kg numeric,    -- 骨骼肌重 (kg)
    note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_body_weights_date on public.body_weights (date desc);

-- 啟用 RLS
alter table public.body_weights enable row level security;

-- RLS 政策 (允許匿名或授權使用者讀寫)
create policy "Allow public manage body_weights"
    on public.body_weights for all
    using (true)
    with check (true);

-- ============================================================
-- FitPack v3 — Migration (run AFTER v2 schema is in place)
-- ============================================================

-- New columns on existing tables
alter table check_ins add column if not exists mood         text    default null; -- 'dead','tired','meh','good','fire'
alter table check_ins add column if not exists shoutout_to  uuid    references users(id) on delete set null default null;
alter table check_ins add column if not exists shoutout_msg text    default null;

alter table users     add column if not exists junk_streak      integer default 0;
alter table users     add column if not exists best_week_xp     integer default 0;
alter table users     add column if not exists avatar_style      text    default 'letter'; -- 'letter' | emoji key
alter table users     add column if not exists theme             text    default 'dark';
alter table users     add column if not exists is_admin          boolean default false;
alter table users     add column if not exists onboarded         boolean default false;
alter table users     add column if not exists public_goal       text    default null;
alter table users     add column if not exists public_goal_date  date    default null;

-- Squad milestones (collective)
create table if not exists squad_milestones (
  id           uuid default gen_random_uuid() primary key,
  slug         text unique not null,
  label        text not null,
  description  text,
  icon         text,
  threshold    integer not null,
  metric       text not null,  -- 'workouts','checkins','xp'
  achieved_at  timestamptz,
  achieved     boolean default false
);

-- Squad posts / pinned announcements
create table if not exists squad_posts (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references users(id) on delete cascade,
  content     text not null check (char_length(content) <= 500),
  pinned      boolean default false,
  created_at  timestamptz default now()
);

-- Weekly goals (public)
create table if not exists weekly_goals (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references users(id) on delete cascade,
  week_id     date not null,   -- Monday ISO of that week
  goal        text not null check (char_length(goal) <= 200),
  achieved    boolean default false,
  created_at  timestamptz default now(),
  unique(user_id, week_id)
);

-- Weekly crown (who was #1 each week)
create table if not exists weekly_crown (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references users(id) on delete cascade,
  week_id     date not null unique,   -- Monday ISO
  xp          integer not null
);

-- Daily spin results
create table if not exists spin_results (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references users(id) on delete cascade,
  date         date not null default current_date,
  challenge    text not null,
  xp_bonus     integer not null,
  completed    boolean default false,
  unique(user_id, date)
);

-- Invite links
create table if not exists invite_links (
  id          uuid default gen_random_uuid() primary key,
  code        text unique not null,
  created_by  uuid references users(id) on delete cascade,
  used_by     uuid references users(id) on delete set null default null,
  used_at     timestamptz,
  expires_at  timestamptz default (now() + interval '7 days'),
  created_at  timestamptz default now()
);

-- Comeback bonus log (so we only award once per comeback)
create table if not exists comeback_log (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references users(id) on delete cascade,
  date        date not null,
  unique(user_id, date)
);

-- Milestone XP bonus log
create table if not exists milestone_log (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references users(id) on delete cascade,
  milestone   integer not null,  -- e.g. 1000, 2500, 5000
  awarded_at  timestamptz default now(),
  unique(user_id, milestone)
);

-- RLS for new tables
do $$ declare t text; begin
  for t in select unnest(array[
    'squad_milestones','squad_posts','weekly_goals','weekly_crown',
    'spin_results','invite_links','comeback_log','milestone_log'
  ]) loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "open" on %I', t);
    execute format('create policy "open" on %I for all using (true) with check (true)', t);
  end loop;
end $$;

-- Seed squad milestones
insert into squad_milestones (slug, label, description, icon, threshold, metric) values
  ('checkins_100',   '100 Check-ins',       'Squad logs 100 total check-ins',         '💯', 100,   'checkins'),
  ('checkins_500',   '500 Check-ins',       'Squad logs 500 total check-ins',         '🔥', 500,   'checkins'),
  ('checkins_1000',  '1000 Check-ins',      'Squad logs 1000 total check-ins',        '🚀', 1000,  'checkins'),
  ('workouts_100',   '100 Workouts',        'Squad logs 100 total workouts',          '💪', 100,   'workouts'),
  ('workouts_500',   '500 Workouts',        'Squad logs 500 total workouts',          '🏋️', 500,   'workouts'),
  ('xp_10000',       '10K Squad XP',        'Squad earns 10,000 total XP',            '⚡', 10000, 'xp'),
  ('xp_100000',      '100K Squad XP',       'Squad earns 100,000 total XP',           '👑', 100000,'xp')
on conflict (slug) do nothing;

-- Seed new badges for v3 features
insert into badges (slug, name, description, icon, xp_reward) values
  ('junk_streak_7',    'Clean Week',       '7 consecutive no-junk days',             '🥗', 100),
  ('junk_streak_30',   'Clean Month',      '30 consecutive no-junk days',            '🥑', 400),
  ('mood_tracker',     'Feelings Logger',  'Log your mood 10 times',                 '😊', 75),
  ('comeback_kid',     'Comeback Kid',     'Return after 7+ days away with a perfect day', '⚡', 150),
  ('crown_holder',     'Crown Holder',     'Finish #1 on the weekly leaderboard',    '👑', 250),
  ('milestone_1k',     '1K Club',          'Reach 1,000 total XP',                   '🎯', 50),
  ('milestone_2500',   'Rising Star',      'Reach 2,500 total XP',                   '🌟', 100),
  ('milestone_5k',     '5K Legend',        'Reach 5,000 total XP',                   '💎', 200),
  ('spin_master',      'Spin Master',      'Complete 10 daily spin challenges',      '🎰', 150),
  ('goal_setter',      'Goal Setter',      'Set and achieve 3 weekly public goals',  '🎯', 100),
  ('squad_post',       'Announcer',        'Make your first squad announcement',     '📣', 50),
  ('shoutout_king',    'Hype Machine',     'Give 10 shoutouts to teammates',         '🙌', 100)
on conflict (slug) do nothing;

-- Make first user admin (run manually if needed, or set via app)
-- UPDATE users SET is_admin = true WHERE username = 'your_username';

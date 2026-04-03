-- Daily streak support
alter table streaks add column if not exists current_day_streak integer default 0;
alter table streaks add column if not exists longest_day_streak integer default 0;
alter table streaks add column if not exists last_checkin_date date;

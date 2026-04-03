-- Enforce one-to-one buddy mapping
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_accountability_buddy_not_self'
  ) then
    alter table users
      add constraint users_accountability_buddy_not_self
      check (accountability_buddy_id is null or accountability_buddy_id <> id);
  end if;
end $$;

create unique index if not exists users_accountability_buddy_unique_idx
  on users (accountability_buddy_id)
  where accountability_buddy_id is not null;

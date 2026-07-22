-- Схема базы данных для «Мой договор».
-- Одна таблица ключ→значение на пользователя. Выполнить в Supabase → SQL Editor.

create table if not exists public.kv (
  user_id uuid not null references auth.users(id) on delete cascade,
  k text not null,
  v jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, k)
);

-- Включаем защиту на уровне строк: каждый видит и меняет ТОЛЬКО свои данные.
alter table public.kv enable row level security;

drop policy if exists "kv_select_own" on public.kv;
create policy "kv_select_own" on public.kv
  for select using (auth.uid() = user_id);

drop policy if exists "kv_insert_own" on public.kv;
create policy "kv_insert_own" on public.kv
  for insert with check (auth.uid() = user_id);

drop policy if exists "kv_update_own" on public.kv;
create policy "kv_update_own" on public.kv
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "kv_delete_own" on public.kv;
create policy "kv_delete_own" on public.kv
  for delete using (auth.uid() = user_id);

-- Автообновление времени изменения.
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists kv_touch on public.kv;
create trigger kv_touch before update on public.kv
  for each row execute function public.touch_updated_at();

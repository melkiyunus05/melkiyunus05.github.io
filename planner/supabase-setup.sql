-- Elio Planner: pengaturan Supabase
-- Jalankan SEKALI di Supabase > SQL Editor > New query > tempel semua isi file ini > Run.
-- Aman dijalankan ulang.

-- 1. Tabel data yang disinkronkan (tugas, kategori, matkul, lomba, sesi timer, data file, dll.)
create table if not exists public.planner_records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection text not null,
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, id)
);

create index if not exists planner_records_sync_idx on public.planner_records (user_id, updated_at);

-- updated_at selalu diisi oleh server, bukan oleh perangkat, supaya urutan sinkron konsisten
create or replace function public.planner_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists planner_touch on public.planner_records;
create trigger planner_touch before insert or update on public.planner_records
  for each row execute function public.planner_touch();

-- Keamanan: setiap akun hanya bisa membaca dan mengubah datanya sendiri
alter table public.planner_records enable row level security;

drop policy if exists "planner: pemilik saja" on public.planner_records;
create policy "planner: pemilik saja" on public.planner_records
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. Penyimpanan file (privat, maksimal 50 MB per file)
insert into storage.buckets (id, name, public, file_size_limit)
values ('planner-files', 'planner-files', false, 52428800)
on conflict (id) do nothing;

-- File disimpan di folder <id akun>/..., dan hanya pemilik folder yang bisa mengaksesnya
drop policy if exists "planner: baca file sendiri" on storage.objects;
create policy "planner: baca file sendiri" on storage.objects
  for select to authenticated
  using (bucket_id = 'planner-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "planner: upload file sendiri" on storage.objects;
create policy "planner: upload file sendiri" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'planner-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "planner: ubah file sendiri" on storage.objects;
create policy "planner: ubah file sendiri" on storage.objects
  for update to authenticated
  using (bucket_id = 'planner-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "planner: hapus file sendiri" on storage.objects;
create policy "planner: hapus file sendiri" on storage.objects
  for delete to authenticated
  using (bucket_id = 'planner-files' and (storage.foldername(name))[1] = auth.uid()::text);

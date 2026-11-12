-- CampusHub Supabase schema. Run this once in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.campushub_documents (
  collection_name text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection_name, id)
);

create or replace function public.campushub_role()
returns text language sql stable security definer set search_path = public
as $$
  select coalesce((select data->>'role' from public.campushub_documents
    where collection_name = 'students' and id = auth.uid()::text limit 1), 'student');
$$;

create or replace function public.campushub_can_read(c text, rid text, d jsonb)
returns boolean language plpgsql stable security definer set search_path = public
as $$
declare role_name text := public.campushub_role(); room_id text; current_course text;
begin
  if auth.uid() is null then return false; end if;
  if role_name = 'admin' then return true; end if;
  if c = 'students' then return rid = auth.uid()::text and d->>'role' = role_name; end if;
  if c = 'publicProfiles' or c = 'modules' then return true; end if;
  if c = 'moduleEnrollments' then
    return d->>'studentId' = auth.uid()::text or d->>'teacherId' = auth.uid()::text;
  end if;
  if c = 'work' then
    return d->>'teacherId' = auth.uid()::text or exists (
      select 1 from public.campushub_documents e
      where e.collection_name = 'moduleEnrollments'
        and e.data->>'moduleId' = d->>'moduleId'
        and e.data->>'studentId' = auth.uid()::text
    );
  end if;
  if c = 'timetable' then
    return d->>'teacherId' = auth.uid()::text and exists (
      select 1 from public.campushub_documents m
      where m.collection_name = 'modules' and m.id = d->>'moduleId'
        and m.data->>'teacherId' = auth.uid()::text
    );
  end if;
  if c = 'results' then
    return d->>'teacherId' = auth.uid()::text
      or (d->>'studentId' = auth.uid()::text and d->>'status' = 'published');
  end if;
  if c = 'timetable' then
    return d->>'teacherId' = auth.uid()::text or exists (
      select 1 from public.campushub_documents e
      where e.collection_name = 'moduleEnrollments'
        and e.data->>'moduleId' = d->>'moduleId'
        and e.data->>'studentId' = auth.uid()::text
    );
  end if;
  if c in ('forumPosts','forumComments') then return true; end if;
  if c = 'fees' then return d->>'studentId' = auth.uid()::text; end if;
  if c = 'notes' then
    return d->>'teacherId' = auth.uid()::text or exists (
      select 1 from public.campushub_documents e
      where e.collection_name = 'moduleEnrollments'
        and e.data->>'moduleId' = d->>'moduleId'
        and e.data->>'studentId' = auth.uid()::text
    );
  end if;
  if c like 'chatRooms/%' then
    room_id := split_part(c, '/', 2);
    if room_id = 'general' then return true; end if;
    if room_id like 'course_%' then
      select data->>'course' into current_course from public.campushub_documents where collection_name = 'students' and id = auth.uid()::text;
      return room_id = 'course_' || trim(both '_' from lower(regexp_replace(coalesce(current_course,''), '[^a-z0-9]+', '_', 'g')));
    end if;
    return exists (select 1 from public.campushub_documents r where r.collection_name = 'chatRooms' and r.id = room_id and r.data->'participants' ? auth.uid()::text);
  end if;
  if c = 'chatRooms' then
    return d->>'type' in ('course','general') or d->'participants' ? auth.uid()::text;
  end if;
  return false;
end;
$$;

create or replace function public.campushub_can_write(c text, rid text, d jsonb)
returns boolean language plpgsql stable security definer set search_path = public
as $$
declare role_name text := public.campushub_role(); room_id text; current_course text;
begin
  if auth.uid() is null then return false; end if;
  if role_name = 'admin' then return true; end if;
  if c = 'students' then return rid = auth.uid()::text and d->>'role' = role_name; end if;
  if c = 'publicProfiles' then return rid = auth.uid()::text; end if;
  if c = 'modules' then return d->>'teacherId' = auth.uid()::text; end if;
  if c = 'moduleEnrollments' then
    return (d->>'studentId' = auth.uid()::text or d->>'teacherId' = auth.uid()::text)
      and exists (select 1 from public.campushub_documents m where m.collection_name = 'modules' and m.id = d->>'moduleId' and m.data->>'teacherId' = d->>'teacherId');
  end if;
  if c = 'results' then
    return d->>'teacherId' = auth.uid()::text
      and d->>'status' in ('submitted','returned')
      and exists (
        select 1 from public.campushub_documents m
        where m.collection_name = 'modules' and m.id = d->>'moduleId'
          and m.data->>'teacherId' = auth.uid()::text
      )
      and exists (
        select 1 from public.campushub_documents e
        where e.collection_name = 'moduleEnrollments'
          and e.data->>'moduleId' = d->>'moduleId'
          and e.data->>'studentId' = d->>'studentId'
      );
  end if;
  if c = 'forumPosts' then return d->>'authorId' = auth.uid()::text; end if;
  if c = 'forumComments' then
    return exists (
      select 1 from public.campushub_documents p
      where p.collection_name = 'forumPosts' and p.id = d->>'postId'
        and (d->>'authorId' = auth.uid()::text or p.data->>'authorId' = auth.uid()::text)
    );
  end if;
  if c = 'work' or c = 'notes' then return d->>'teacherId' = auth.uid()::text and exists (select 1 from public.campushub_documents m where m.collection_name = 'modules' and m.id = d->>'moduleId' and m.data->>'teacherId' = auth.uid()::text); end if;
  if c like 'chatRooms/%' then
    room_id := split_part(c, '/', 2);
    if d->>'senderId' <> auth.uid()::text then return false; end if;
    if room_id = 'general' then return true; end if;
    if room_id like 'course_%' then
      select data->>'course' into current_course from public.campushub_documents where collection_name = 'students' and id = auth.uid()::text;
      return room_id = 'course_' || trim(both '_' from lower(regexp_replace(coalesce(current_course,''), '[^a-z0-9]+', '_', 'g')));
    end if;
    return exists (select 1 from public.campushub_documents r where r.collection_name = 'chatRooms' and r.id = room_id and r.data->'participants' ? auth.uid()::text);
  end if;
  if c = 'chatRooms' then
    return d->>'type' in ('course','general') or d->'participants' ? auth.uid()::text;
  end if;
  return false;
end;
$$;

-- Supabase table privileges (RLS policies still enforce row-level access).
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.campushub_documents to authenticated;
grant execute on function public.campushub_role() to authenticated;
grant execute on function public.campushub_can_read(text, text, jsonb) to authenticated;
grant execute on function public.campushub_can_write(text, text, jsonb) to authenticated;

alter table public.campushub_documents enable row level security;
drop policy if exists "CampusHub read access" on public.campushub_documents;
drop policy if exists "CampusHub insert access" on public.campushub_documents;
drop policy if exists "CampusHub update access" on public.campushub_documents;
drop policy if exists "CampusHub delete access" on public.campushub_documents;
create policy "CampusHub read access" on public.campushub_documents
for select to authenticated using (public.campushub_can_read(collection_name,id,data));
create policy "CampusHub insert access" on public.campushub_documents
for insert to authenticated with check (public.campushub_can_write(collection_name,id,data));
create policy "CampusHub update access" on public.campushub_documents
for update to authenticated using (public.campushub_can_read(collection_name,id,data))
with check (public.campushub_can_write(collection_name,id,data));
create policy "CampusHub delete access" on public.campushub_documents
for delete to authenticated using (public.campushub_can_write(collection_name,id,data));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('campushub-notes','campushub-notes',false,20971520,array['application/pdf'])
on conflict (id) do update set public=false, file_size_limit=20971520, allowed_mime_types=array['application/pdf'];

drop policy if exists "CampusHub notes read" on storage.objects;
drop policy if exists "CampusHub notes upload" on storage.objects;
drop policy if exists "CampusHub notes delete" on storage.objects;
do $campushub$ begin
  alter publication supabase_realtime add table public.campushub_documents;
exception when duplicate_object then null;
end $campushub$;

create policy "CampusHub notes read" on storage.objects for select to authenticated
using (bucket_id = 'campushub-notes' and (
  (storage.foldername(name))[1] = 'moduleNotes'
  and (
    public.campushub_role() = 'admin'
    or exists (select 1 from public.campushub_documents n
      where n.collection_name = 'notes' and n.data->>'storagePath' = name
      and public.campushub_can_read('notes',n.id,n.data))
  )
));
create policy "CampusHub notes upload" on storage.objects for insert to authenticated
with check (bucket_id = 'campushub-notes' and (storage.foldername(name))[1] = 'moduleNotes' and (public.campushub_role() = 'admin' or exists (select 1 from public.campushub_documents m where m.collection_name = 'modules' and m.id = (storage.foldername(name))[2] and m.data->>'teacherId' = auth.uid()::text)));
create policy "CampusHub notes delete" on storage.objects for delete to authenticated
using (bucket_id = 'campushub-notes' and (
  public.campushub_role() = 'admin'
  or exists (select 1 from public.campushub_documents n
    where n.collection_name = 'notes' and n.data->>'storagePath' = name
    and n.data->>'teacherId' = auth.uid()::text)
));


-- Create student profiles automatically at Auth signup.
-- This runs inside Postgres, so profiles are created even when email
-- confirmation means the browser has no authenticated session yet.
create or replace function public.campushub_create_student_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if nullif(trim(meta->>'fullName'), '') is not null
     and nullif(trim(meta->>'regNo'), '') is not null
     and nullif(trim(meta->>'course'), '') is not null
     and nullif(trim(meta->>'year'), '') is not null then
    insert into public.campushub_documents (collection_name, id, data)
    values (
      'students',
      new.id::text,
      jsonb_build_object(
        'fullName', trim(meta->>'fullName'),
        'phone', coalesce(meta->>'phone', ''),
        'regNo', trim(meta->>'regNo'),
        'course', trim(meta->>'course'),
        'year', trim(meta->>'year'),
        'gender', coalesce(meta->>'gender', ''),
        'email', coalesce(new.email, ''),
        'role', 'student',
        'createdAt', now()
      )
    )
    on conflict (collection_name, id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists campushub_create_student_profile on auth.users;
create trigger campushub_create_student_profile
after insert on auth.users
for each row execute function public.campushub_create_student_profile();

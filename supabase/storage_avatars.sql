-- =========================================================
--  Storage bucket: avatars
--  Bucket publico para fotos de perfil. Los archivos se suben
--  bajo la carpeta del usuario: "<auth.uid>/<filename>".
-- =========================================================

-- Crear el bucket si no existe (publico para lectura).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

-- Limpiar policies previas (idempotente).
drop policy if exists "Avatars are publicly readable" on storage.objects;
drop policy if exists "Users can upload their own avatar" on storage.objects;
drop policy if exists "Users can update their own avatar" on storage.objects;
drop policy if exists "Users can delete their own avatar" on storage.objects;

-- Lectura publica: cualquiera puede ver los avatares.
create policy "Avatars are publicly readable"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

-- Subida: solo el propietario puede subir a su carpeta (<uid>/...).
create policy "Users can upload their own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Update (overwrite) del propio avatar.
create policy "Users can update their own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Borrado del propio avatar.
create policy "Users can delete their own avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- =========================================================
--  00_extensions.sql
--  Extensiones PostgreSQL usadas por el resto de scripts.
--  Ejecutar este script PRIMERO.
-- =========================================================

create extension if not exists pgcrypto;     -- gen_random_uuid()
create extension if not exists pg_trgm;      -- busqueda fuzzy en profiles
create extension if not exists citext;       -- email case-insensitive

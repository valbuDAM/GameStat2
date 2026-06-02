-- =========================================================
--  _shared.sql
--  Funciones utilitarias reutilizadas (triggers genericos).
--  Ejecutar despues de 00_extensions.sql y antes del resto.
-- =========================================================

-- Trigger generico que mantiene una columna updated_at fresca.
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

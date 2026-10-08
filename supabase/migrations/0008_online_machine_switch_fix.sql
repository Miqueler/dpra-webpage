-- Fix the online machine's on/off switch.
-- Supabase refuses any UPDATE that has no WHERE clause ("UPDATE requires a
-- WHERE clause"), even on a table that can only ever hold one row, so the
-- switch on the admin page failed. Same function as in 0007, with the row
-- named explicitly.
create or replace function public.set_online_machine(enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Only the Commissariat may operate the machine.';
  end if;

  if enabled is null then
    raise exception 'The machine is either on or off.';
  end if;

  update public.atzar_settings
  set online_enabled = enabled, updated_at = now(), updated_by = auth.uid()
  where id;
end;
$$;

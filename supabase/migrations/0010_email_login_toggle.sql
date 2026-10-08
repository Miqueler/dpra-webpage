-- Email + password login switch.
-- The Commissariat can hide the email/password form from the login page —
-- it is not currently reliable and admins need to be able to pull it without
-- a deploy. Same shape as atzar_settings: a one-row settings table and a
-- security-definer function to flip it. Unlike atzar_settings, the flag must
-- be readable by signed-out visitors too, since the login page itself reads
-- it before anyone has identified themselves.

create table if not exists public.auth_settings (
  -- Always true, so the table can never hold a second row.
  id boolean primary key default true check (id),
  email_login_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

insert into public.auth_settings default values
on conflict (id) do nothing;

alter table public.auth_settings enable row level security;

create policy "anyone sees whether email login is enabled"
  on public.auth_settings for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies: changed only through set_email_login().

create or replace function public.set_email_login(enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Only the Commissariat may operate the login form.';
  end if;

  if enabled is null then
    raise exception 'Email login is either on or off.';
  end if;

  update public.auth_settings
  set email_login_enabled = enabled, updated_at = now(), updated_by = auth.uid()
  where id;
end;
$$;

revoke execute on function public.set_email_login(boolean) from public, anon;
grant execute on function public.set_email_login(boolean) to authenticated;

-- Provision a private KINGMAKER profile for every new Supabase Auth account.
-- The trigger runs with its owner's privileges; clients cannot invoke the function
-- directly or choose another user's profile identifier.
create or replace function public.handle_kingmaker_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $$
begin
  insert into public.kingmaker_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_kingmaker_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_kingmaker_auth_user_created on auth.users;
create trigger on_kingmaker_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_kingmaker_new_auth_user();

comment on function public.handle_kingmaker_new_auth_user()
  is 'Creates the member profile when Supabase Auth creates an account; callable only by its trigger.';

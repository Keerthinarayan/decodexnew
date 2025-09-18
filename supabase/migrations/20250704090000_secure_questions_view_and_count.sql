-- Secure questions: remove public exposure and add safe total count RPC
begin;

-- If a public view exists that exposes questions, revoke access
do $$
begin
  if exists (
    select 1 from information_schema.views 
    where table_schema = 'public' and table_name = 'public_questions_secure'
  ) then
    revoke select on table public.public_questions_secure from anon, authenticated;
  end if;
exception when others then
  -- ignore; migration should be idempotent
  null;
end$$;

-- Create a secure RPC to return total number of playable questions
-- Avoids revealing question content
create or replace function public.get_total_questions()
returns integer
language sql
stable
security definer
as $$
  select count(*)::int from public.questions q
  where coalesce(q.is_active, true) = true;
$$;

-- Grant execute to anon/authenticated so clients can read the count
grant execute on function public.get_total_questions() to anon, authenticated;

commit;

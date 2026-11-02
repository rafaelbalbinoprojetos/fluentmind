-- Run with a database administrator through `supabase db query --linked --file`.
-- Requires two existing users. All fixture rows and usage changes are rolled back.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  users uuid[];
begin
  select array_agg(id) into users from (select id from auth.users order by created_at, id limit 2) u;
  if coalesce(array_length(users, 1), 0) < 2 then
    raise exception 'Validation requires two existing users; nothing was changed.';
  end if;
  perform set_config('fluentmind.test_user_a', users[1]::text, true);
  perform set_config('fluentmind.test_user_b', users[2]::text, true);
end;
$$;

insert into public.ultra_access_grants(email, user_id, status, plan)
values
 ('fluentmind-validation-a@validation.invalid', current_setting('fluentmind.test_user_a')::uuid, 'active', 'premium'),
 ('fluentmind-validation-b@validation.invalid', current_setting('fluentmind.test_user_b')::uuid, 'active', 'premium');
insert into public.insights(user_id, summary)
values
 (current_setting('fluentmind.test_user_a')::uuid, 'fluentmind-migration-validation'),
 (current_setting('fluentmind.test_user_b')::uuid, 'fluentmind-migration-validation');

-- Create controlled usage fixtures inside this transaction only.
insert into public.ai_usage(user_id, month, ai_chat)
values (current_setting('fluentmind.test_user_a')::uuid, date_trunc('month', now() at time zone 'UTC')::date, 0)
on conflict(user_id) do update set month = excluded.month, ai_chat = 0;

set local role service_role;
do $$
declare
  test_user_id uuid := current_setting('fluentmind.test_user_a')::uuid;
  result jsonb;
  first_trial jsonb;
  repeated_trial jsonb;
  expired_at timestamptz;
  blocked boolean := false;
begin
  result := public.consume_ai_usage(test_user_id, 2, 2);
  if (result->>'ai_chat')::integer <> 2 then raise exception 'Quota increment failed'; end if;
  begin
    perform public.consume_ai_usage(test_user_id, 1, 2);
  exception when raise_exception then
    if sqlerrm <> 'ai_limit_reached' then raise; end if;
    blocked := true;
  end;
  if not blocked then raise exception 'Quota limit did not block'; end if;
  update public.ai_usage set month = '2000-01-01', ai_chat = 300 where ai_usage.user_id = test_user_id;
  result := public.consume_ai_usage(test_user_id, 1, 300);
  if (result->>'ai_chat')::integer <> 1 then raise exception 'Monthly reset failed'; end if;

  first_trial := public.start_ai_trial(test_user_id);
  repeated_trial := public.start_ai_trial(test_user_id);
  if first_trial <> repeated_trial then raise exception 'Repeated activation changed trial dates'; end if;
  expired_at := now() - interval '3 days';
  update public.ai_trials set started_at = now() - interval '10 days', expires_at = expired_at where ai_trials.user_id = test_user_id;
  repeated_trial := public.start_ai_trial(test_user_id);
  if repeated_trial->>'trial_status' <> 'expired' or (repeated_trial->>'trial_expires_at')::timestamptz <> expired_at then
    raise exception 'Expired trial was extended';
  end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', current_setting('fluentmind.test_user_a'), true),
  set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('fluentmind.test_user_a'), 'role', 'authenticated', 'email', 'validation-user@example.invalid')::text, true);
set local role authenticated;
do $$
declare
  visible integer;
  changed integer;
  blocked boolean := false;
begin
  select count(*) into visible from public.ultra_access_grants where email in ('fluentmind-validation-a@validation.invalid', 'fluentmind-validation-b@validation.invalid');
  if visible <> 1 then raise exception 'Ultra grants leak between accounts: %', visible; end if;
  update public.ultra_access_grants set revoked_at = now() where email = 'fluentmind-validation-b@validation.invalid';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Non-master changed another account grant'; end if;
  select count(*) into visible from public.insights where summary = 'fluentmind-migration-validation';
  if visible <> 1 then raise exception 'Insights leak between accounts'; end if;
  begin
    insert into public.insights(user_id, summary) values (current_setting('fluentmind.test_user_b')::uuid, 'fluentmind-invalid-cross-account-insert');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Cross-account insight insert was allowed'; end if;
  blocked := false;
  begin
    perform public.consume_ai_usage(current_setting('fluentmind.test_user_a')::uuid, 1, 300);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Authenticated user called the quota RPC directly'; end if;
  blocked := false;
  begin perform 1 from public.ai_usage;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Authenticated user read the server-only usage table'; end if;
end;
$$;
reset role;

set local role anon;
do $$
declare blocked boolean := false;
begin
  begin perform public.start_ai_trial(current_setting('fluentmind.test_user_a')::uuid);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Anonymous user activated a trial directly'; end if;
  blocked := false;
  begin perform 1 from public.ai_trials;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Anonymous user read the server-only trial table'; end if;
end;
$$;
reset role;

select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('fluentmind.test_user_a'), 'role', 'authenticated', 'email', 'balbino10@hotmail.com')::text, true);
set local role authenticated;
do $$
declare visible integer;
begin
  select count(*) into visible from public.ultra_access_grants where email in ('fluentmind-validation-a@validation.invalid', 'fluentmind-validation-b@validation.invalid');
  if visible <> 2 then raise exception 'Master cannot read all grants'; end if;
  update public.ultra_access_grants set revoked_at = now() where email = 'fluentmind-validation-b@validation.invalid';
  get diagnostics visible = row_count;
  if visible <> 1 then raise exception 'Master cannot manage grants'; end if;
end;
$$;
reset role;
rollback;
select 'PASS: quota, monthly reset, immutable trial dates, expired trials, account RLS, RPC/table privileges and master management; fixtures rolled back' as validation_result;

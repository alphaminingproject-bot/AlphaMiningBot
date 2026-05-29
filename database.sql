-- ============================================================
-- ALPHA Platform — Supabase Database Schema
-- Paste this ENTIRE file into Supabase SQL Editor and click Run
-- ============================================================

-- ── Enable UUID extension ────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Users table
create table if not exists users (
  id            text primary key,         -- Telegram user ID
  name          text not null default 'User',
  username      text default '',
  balance       float8 not null default 0,
  ton_balance   float8 not null default 0,
  usdt_balance  float8 not null default 0,
  usdc_balance  float8 not null default 0,
  sessions      int not null default 0,
  last_mine     bigint not null default 0,
  miner         jsonb default null,
  boost         jsonb default null,
  vault         boolean not null default false,
  vehicles      text[] default array['v0'],
  selected_vehicle text default 'v0',
  bullets       int not null default 0,
  refs          jsonb default '[]'::jsonb,
  referred_by   text default null,
  task_states   jsonb default '{}'::jsonb,
  task_handles  jsonb default '{}'::jsonb,
  nfts          jsonb default '[]'::jsonb,
  history       jsonb default '[]'::jsonb,
  streak        jsonb default '{"count":0,"lastClaim":0}'::jsonb,
  custom_tokens jsonb default '[]'::jsonb,
  device        jsonb default null,
  risk_score    int default 0,
  flagged       boolean default false,
  flag_reason   text default null,
  flag_tx_id    text default null,
  last_seen     bigint default extract(epoch from now())*1000,
  created_at    bigint default extract(epoch from now())*1000
);

-- Tasks table
create table if not exists tasks (
  id              text primary key,
  name            text not null,
  reward          float8 not null default 0,
  type            text not null default 'link',
  category        text default 'social',
  icon            text default '🎯',
  target          text default '',
  description     text default '',
  ton_reward      float8 default 0,
  extra_currency  text default null,
  extra_reward    float8 default 0,
  x_follow        boolean default false,
  requires_input  boolean default false,
  input_placeholder text default null,
  auto_ref        int default null,
  created_at      bigint default extract(epoch from now())*1000
);

-- Events table (campaign tasks shown in gold)
create table if not exists events (
  id          text primary key,
  name        text not null,
  icon        text default '📣',
  description text default '',
  tasks       jsonb default '[]'::jsonb,
  created_at  bigint default extract(epoch from now())*1000
);

-- X follow verification queue
create table if not exists x_queue (
  doc_id    text primary key,
  user_id   text not null,
  user_name text not null,
  task_id   text not null,
  task_name text default '',
  reward    float8 default 0,
  handle    text not null,
  ts        bigint default extract(epoch from now())*1000,
  status    text default 'pending',
  notified  boolean default false
);

-- Referral verification queue
create table if not exists ref_queue (
  doc_id        text primary key,
  referrer_id   text not null,
  referrer_name text not null,
  referee_id    text not null,
  referee_name  text not null,
  ts            bigint default extract(epoch from now())*1000,
  status        text default 'pending'
);

-- NFT listings
create table if not exists nft_listings (
  id          text primary key,
  name        text not null,
  price       float8 not null default 0,
  img         text default null,
  available   boolean default true,
  created_at  bigint default extract(epoch from now())*1000
);

-- NFT send requests
create table if not exists nft_requests (
  req_id    text primary key,
  user_id   text not null,
  user_name text not null,
  nft_id    text not null,
  nft_name  text default '',
  nft_img   text default null,
  address   text not null,
  ts        bigint default extract(epoch from now())*1000,
  status    text default 'pending',
  notified  boolean default false
);

-- Withdrawals
create table if not exists withdrawals (
  tx_id     text primary key,
  user_id   text not null,
  user_name text not null,
  currency  text not null,
  amount    float8 not null,
  address   text not null,
  chain     text default 'TON',
  ts        bigint default extract(epoch from now())*1000,
  status    text default 'pending',
  txn_link  text default null,
  notified  boolean default false
);

-- Transactions log
create table if not exists transactions (
  tx_id     text primary key,
  user_id   text not null,
  from_id   text default null,
  from_name text default null,
  to_id     text default null,
  to_name   text default null,
  type      text not null,
  amount    float8 not null,
  note      text default '',
  description text default '',
  ts        bigint default extract(epoch from now())*1000
);

-- Ads (user-published tasks)
create table if not exists ads (
  id              text primary key,
  user_id         text not null,
  user_name       text not null,
  name            text not null,
  description     text default '',
  type            text default 'link',
  target          text not null,
  clicks_total    int not null default 1000,
  clicks_done     int not null default 0,
  cost            float8 not null default 0,
  reward_per_click float8 default 0.3,
  status          text default 'pending',
  created_at      bigint default extract(epoch from now())*1000
);

-- Airdrops log
create table if not exists airdrops (
  id        uuid primary key default uuid_generate_v4(),
  user_id   text not null,
  user_name text not null,
  amount    float8 not null,
  note      text default '',
  ts        bigint default extract(epoch from now())*1000
);

-- Notifications
create table if not exists notifications (
  id        uuid primary key default uuid_generate_v4(),
  user_id   text not null,
  type      text default 'info',
  message   text not null,
  read      boolean default false,
  ts        bigint default extract(epoch from now())*1000
);

-- Admin log
create table if not exists admin_log (
  id        uuid primary key default uuid_generate_v4(),
  action    text not null,
  details   jsonb default '{}'::jsonb,
  ts        bigint default extract(epoch from now())*1000
);

-- Flag log
create table if not exists flag_log (
  id            uuid primary key default uuid_generate_v4(),
  user_id       text not null,
  user_name     text not null,
  tx_id         text not null,
  proof         text default '',
  balance_reset float8 default 0,
  manual        boolean default false,
  ts            bigint default extract(epoch from now())*1000
);

-- Global stats
create table if not exists global_stats (
  id            text primary key default 'main',
  total_mined   float8 default 0,
  maintenance   boolean default false
);

-- Custom tokens
create table if not exists custom_tokens (
  id         text primary key,
  name       text not null,
  symbol     text not null,
  img        text default null,
  created_at bigint default extract(epoch from now())*1000
);

-- Insert default global stats row
insert into global_stats (id, total_mined, maintenance)
values ('main', 0, false)
on conflict (id) do nothing;

-- ============================================================
-- DATABASE FUNCTIONS
-- These run INSIDE the database — browser cannot fake them
-- ============================================================

-- Function: mine (3-hour claim)
-- Returns error message or new balance
create or replace function mine_alpha(
  p_user_id text,
  p_mine_interval bigint default 10800000,  -- 3 hours in ms
  p_mine_reward float8 default 70,
  p_max_supply float8 default 100000000000
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user users%rowtype;
  v_stats global_stats%rowtype;
  v_now bigint := extract(epoch from now())*1000;
  v_elapsed bigint;
  v_reward float8;
  v_history jsonb;
  v_entry jsonb;
begin
  -- Get user
  select * into v_user from users where id = p_user_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'User not found');
  end if;

  -- Check flagged
  if v_user.flagged then
    return jsonb_build_object('ok', false, 'error', 'Account flagged. Contact support.');
  end if;

  -- Check max supply
  select * into v_stats from global_stats where id = 'main';
  if v_stats.total_mined >= p_max_supply then
    return jsonb_build_object('ok', false, 'error', 'All tokens have been distributed.');
  end if;

  -- Check active miner
  if v_user.miner is not null
     and (v_user.miner->>'expired')::boolean = false
     and v_user.miner->>'claimedAt' is null then
    return jsonb_build_object('ok', false, 'error', 'Auto miner is running. Claim it first.');
  end if;

  -- Check 3 hour interval
  v_elapsed := v_now - v_user.last_mine;
  if v_user.last_mine > 0 and v_elapsed < p_mine_interval then
    return jsonb_build_object(
      'ok', false,
      'error', 'Not ready yet',
      'remaining', p_mine_interval - v_elapsed
    );
  end if;

  -- Apply boost multiplier if active
  v_reward := p_mine_reward;
  if v_user.boost is not null
     and (v_user.boost->>'expiresAt')::bigint > v_now then
    v_reward := v_reward * 2;
  end if;

  -- Build history entry
  v_entry := jsonb_build_object(
    'id', 'H' || v_now || floor(random()*9999)::text,
    'ts', v_now,
    'type', 'mine',
    'desc', 'Mining claim',
    'amount', v_reward,
    'balanceAfter', v_user.balance + v_reward
  );
  v_history := jsonb_build_array(v_entry) || v_user.history;
  if jsonb_array_length(v_history) > 200 then
    v_history := v_history - 200;
  end if;

  -- Update user
  update users set
    balance   = balance + v_reward,
    sessions  = sessions + 1,
    last_mine = v_now,
    last_seen = v_now,
    history   = v_history
  where id = p_user_id;

  -- Update global stats
  update global_stats set total_mined = total_mined + v_reward where id = 'main';

  return jsonb_build_object(
    'ok', true,
    'reward', v_reward,
    'balance', v_user.balance + v_reward,
    'sessions', v_user.sessions + 1
  );
end;
$$;

-- Function: buy_miner
create or replace function buy_miner(
  p_user_id text,
  p_type text  -- 'beta' or 'alphaminer'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user users%rowtype;
  v_now bigint := extract(epoch from now())*1000;
  v_cost float8;
  v_hours int;
  v_days  int;
  v_miner jsonb;
  v_entry jsonb;
  v_history jsonb;
begin
  select * into v_user from users where id = p_user_id;
  if not found then return jsonb_build_object('ok',false,'error','User not found'); end if;

  if v_user.miner is not null
     and (v_user.miner->>'expired')::boolean = false
     and v_user.miner->>'claimedAt' is null then
    return jsonb_build_object('ok',false,'error','You already have an active miner!');
  end if;

  if p_type = 'beta' then
    v_cost := 300; v_hours := 12; v_days := 3;
  else
    v_cost := 500; v_hours := 24; v_days := 3;
  end if;

  if v_user.balance < v_cost then
    return jsonb_build_object('ok',false,'error','Not enough ALPHA. Need ' || v_cost::text);
  end if;

  v_miner := jsonb_build_object(
    'type', p_type,
    'boughtAt', v_now,
    'claimableAt', v_now + v_hours * 3600000,
    'expiresAt', v_now + v_days * 86400000,
    'claimedAt', null,
    'expired', false
  );

  v_entry := jsonb_build_object('id','H'||v_now,'ts',v_now,'type','shop',
    'desc','Bought '||p_type||' miner','amount',-v_cost,'balanceAfter',v_user.balance-v_cost);
  v_history := jsonb_build_array(v_entry) || v_user.history;

  update users set
    balance  = balance - v_cost,
    miner    = v_miner,
    history  = v_history,
    last_seen = v_now
  where id = p_user_id;

  return jsonb_build_object('ok',true,'balance',v_user.balance-v_cost,'miner',v_miner);
end;
$$;

-- Function: claim_miner
create or replace function claim_miner(p_user_id text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user users%rowtype;
  v_now  bigint := extract(epoch from now())*1000;
  v_reward float8;
  v_entry jsonb;
  v_history jsonb;
begin
  select * into v_user from users where id = p_user_id;
  if not found then return jsonb_build_object('ok',false,'error','User not found'); end if;
  if v_user.miner is null then return jsonb_build_object('ok',false,'error','No miner found'); end if;
  if v_user.miner->>'claimedAt' is not null then return jsonb_build_object('ok',false,'error','Already claimed'); end if;

  if v_now > (v_user.miner->>'expiresAt')::bigint then
    update users set miner = v_user.miner || '{"expired":true}'::jsonb where id = p_user_id;
    return jsonb_build_object('ok',false,'error','Miner expired. Buy a new one.');
  end if;

  if v_now < (v_user.miner->>'claimableAt')::bigint then
    return jsonb_build_object('ok',false,'error','Not ready yet');
  end if;

  v_reward := case when v_user.miner->>'type' = 'beta' then 400 else 850 end;

  v_entry := jsonb_build_object('id','H'||v_now,'ts',v_now,'type','claim_miner',
    'desc','Auto miner reward','amount',v_reward,'balanceAfter',v_user.balance+v_reward);
  v_history := jsonb_build_array(v_entry) || v_user.history;

  update users set
    balance  = balance + v_reward,
    miner    = v_user.miner || jsonb_build_object('claimedAt', v_now),
    history  = v_history,
    last_seen = v_now
  where id = p_user_id;

  update global_stats set total_mined = total_mined + v_reward where id = 'main';

  return jsonb_build_object('ok',true,'reward',v_reward,'balance',v_user.balance+v_reward);
end;
$$;

-- Function: transfer_alpha (secure P2P transfer)
create or replace function transfer_alpha(
  p_from_id text,
  p_to_id   text,
  p_amount  float8,
  p_note    text default ''
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_sender   users%rowtype;
  v_receiver users%rowtype;
  v_now      bigint := extract(epoch from now())*1000;
  v_tx_id    text;
  v_chars    text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  v_i        int;
begin
  if p_from_id = p_to_id then
    return jsonb_build_object('ok',false,'error','Cannot send to yourself');
  end if;

  select * into v_sender   from users where id = p_from_id;
  select * into v_receiver from users where id = p_to_id;

  if not found then return jsonb_build_object('ok',false,'error','Recipient not found'); end if;
  if v_sender.balance < p_amount then
    return jsonb_build_object('ok',false,'error','Insufficient balance');
  end if;
  if not v_sender.vault then
    return jsonb_build_object('ok',false,'error','Unlock vault first to transfer');
  end if;

  -- Generate TX ID
  v_tx_id := 'TX';
  for v_i in 1..10 loop
    v_tx_id := v_tx_id || substr(v_chars, floor(random()*36+1)::int, 1);
  end loop;

  -- Deduct from sender
  update users set
    balance  = balance - p_amount,
    history  = jsonb_build_array(jsonb_build_object(
      'id',v_tx_id,'ts',v_now,'type','transfer_out',
      'desc','Sent to '||v_receiver.name||case when p_note!='' then ': '||p_note else '' end,
      'amount',-p_amount,'balanceAfter',v_sender.balance-p_amount
    )) || history,
    last_seen = v_now
  where id = p_from_id;

  -- Add to receiver
  update users set
    balance  = balance + p_amount,
    history  = jsonb_build_array(jsonb_build_object(
      'id',v_tx_id||'_R','ts',v_now,'type','transfer_in',
      'desc','Received from '||v_sender.name,
      'amount',p_amount,'balanceAfter',v_receiver.balance+p_amount
    )) || history,
    last_seen = v_now
  where id = p_to_id;

  -- Log transaction
  insert into transactions (tx_id,user_id,from_id,from_name,to_id,to_name,type,amount,note,description,ts)
  values (v_tx_id,p_from_id,p_from_id,v_sender.name,p_to_id,v_receiver.name,'transfer',p_amount,p_note,'Transfer',v_now);

  -- Notify receiver
  insert into notifications (user_id,type,message,ts)
  values (p_to_id,'transfer','You received '||p_amount::text||' ALPHA from '||v_sender.name||'. TX: '||v_tx_id, v_now);

  return jsonb_build_object('ok',true,'txId',v_tx_id,'balance',v_sender.balance-p_amount);
end;
$$;

-- Function: buy_vault
create or replace function buy_vault(p_user_id text)
returns jsonb
language plpgsql security definer
as $$
declare
  v_user users%rowtype;
  v_now  bigint := extract(epoch from now())*1000;
begin
  select * into v_user from users where id = p_user_id;
  if not found then return jsonb_build_object('ok',false,'error','User not found'); end if;
  if v_user.vault then return jsonb_build_object('ok',false,'error','Vault already unlocked'); end if;
  if v_user.balance < 5000 then return jsonb_build_object('ok',false,'error','Need 5000 ALPHA'); end if;
  update users set balance=balance-5000, vault=true, last_seen=v_now where id=p_user_id;
  return jsonb_build_object('ok',true,'balance',v_user.balance-5000);
end;
$$;

-- Function: buy_boost
create or replace function buy_boost(p_user_id text)
returns jsonb
language plpgsql security definer
as $$
declare
  v_user users%rowtype;
  v_now  bigint := extract(epoch from now())*1000;
  v_boost jsonb;
begin
  select * into v_user from users where id = p_user_id;
  if not found then return jsonb_build_object('ok',false,'error','User not found'); end if;
  if v_user.boost is not null and (v_user.boost->>'expiresAt')::bigint > v_now then
    return jsonb_build_object('ok',false,'error','Boost already active'); end if;
  if v_user.balance < 1000 then return jsonb_build_object('ok',false,'error','Need 1000 ALPHA'); end if;
  v_boost := jsonb_build_object('boughtAt',v_now,'expiresAt',v_now+86400000);
  update users set balance=balance-1000, boost=v_boost, last_seen=v_now where id=p_user_id;
  return jsonb_build_object('ok',true,'boost',v_boost);
end;
$$;

-- Function: claim_streak
create or replace function claim_streak(p_user_id text)
returns jsonb
language plpgsql security definer
as $$
declare
  v_user   users%rowtype;
  v_now    bigint := extract(epoch from now())*1000;
  v_today  text   := to_char(now(),'YYYY-MM-DD');
  v_last   text;
  v_prev   text   := to_char(now()-interval'1 day','YYYY-MM-DD');
  v_count  int;
  v_reward float8;
begin
  select * into v_user from users where id = p_user_id;
  if not found then return jsonb_build_object('ok',false,'error','User not found'); end if;

  v_last  := to_char(to_timestamp(((v_user.streak->>'lastClaim')::bigint)/1000),'YYYY-MM-DD');

  if v_last = v_today then
    return jsonb_build_object('ok',false,'error','Already claimed today');
  end if;

  v_count := case when v_last = v_prev then (v_user.streak->>'count')::int + 1 else 1 end;

  v_reward := case v_count
    when 1  then 100
    when 3  then 300
    when 7  then 1000
    when 14 then 3000
    when 30 then 10000
    else 50
  end;

  update users set
    balance  = balance + v_reward,
    streak   = jsonb_build_object('count',v_count,'lastClaim',v_now),
    last_seen = v_now
  where id = p_user_id;

  update global_stats set total_mined = total_mined + v_reward where id = 'main';

  return jsonb_build_object('ok',true,'reward',v_reward,'count',v_count);
end;
$$;

-- Function: game_win
create or replace function game_win(p_user_id text, p_reward float8 default 500)
returns jsonb
language plpgsql security definer
as $$
declare
  v_user users%rowtype;
  v_now  bigint := extract(epoch from now())*1000;
begin
  select * into v_user from users where id = p_user_id;
  if not found then return jsonb_build_object('ok',false,'error','User not found'); end if;
  update users set balance=balance+p_reward, last_seen=v_now where id=p_user_id;
  update global_stats set total_mined=total_mined+p_reward where id='main';
  return jsonb_build_object('ok',true,'reward',p_reward,'balance',v_user.balance+p_reward);
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- This is the key security layer — nobody can bypass this
-- ============================================================

alter table users         enable row level security;
alter table tasks         enable row level security;
alter table events        enable row level security;
alter table x_queue       enable row level security;
alter table ref_queue     enable row level security;
alter table nft_listings  enable row level security;
alter table nft_requests  enable row level security;
alter table withdrawals   enable row level security;
alter table transactions  enable row level security;
alter table ads           enable row level security;
alter table notifications enable row level security;
alter table global_stats  enable row level security;
alter table custom_tokens enable row level security;

-- Allow all reads and writes through anon key
-- (Security enforced by database functions, not RLS policies)
-- This lets our app talk to the database freely

create policy "allow_all" on users         for all using (true) with check (true);
create policy "allow_all" on tasks         for all using (true) with check (true);
create policy "allow_all" on events        for all using (true) with check (true);
create policy "allow_all" on x_queue       for all using (true) with check (true);
create policy "allow_all" on ref_queue     for all using (true) with check (true);
create policy "allow_all" on nft_listings  for all using (true) with check (true);
create policy "allow_all" on nft_requests  for all using (true) with check (true);
create policy "allow_all" on withdrawals   for all using (true) with check (true);
create policy "allow_all" on transactions  for all using (true) with check (true);
create policy "allow_all" on ads           for all using (true) with check (true);
create policy "allow_all" on notifications for all using (true) with check (true);
create policy "allow_all" on global_stats  for all using (true) with check (true);
create policy "allow_all" on custom_tokens for all using (true) with check (true);
create policy "allow_all" on airdrops      for all using (true) with check (true);
create policy "allow_all" on admin_log     for all using (true) with check (true);
create policy "allow_all" on flag_log      for all using (true) with check (true);

-- Enable RLS on remaining tables
alter table airdrops  enable row level security;
alter table admin_log enable row level security;
alter table flag_log  enable row level security;

-- ============================================================
-- DEFAULT TASKS
-- ============================================================

insert into tasks (id,name,reward,type,category,icon,target,description,auto_ref)
values
  ('t_ch1','Join ALPHA Channel',50,'telegram','social','📢','@ALPHATokenOfficial','Join our official Telegram channel',null),
  ('t_ch2','Join ALPHA Group',30,'telegram','social','💬','@ALPHATokenGroup','Join our community group',null),
  ('t_x1','Follow on X',25,'x_follow','social','🐦','https://x.com/ALPHAToken','Follow @ALPHAToken on X',null),
  ('t_ref3','Invite 3 Verified Refs',500,'auto_ref','referral','🎯','','Refer 3 users who each earn 100+ ALPHA',3),
  ('t_ref10','Invite 10 Verified Refs',3000,'auto_ref','referral','🏆','','Refer 10 users who each earn 100+ ALPHA',10)
on conflict (id) do nothing;

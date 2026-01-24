-- Vocab Highlighter: user_vocab table schema
-- Apply this in Supabase SQL Editor or via migration

-- 1. Create the table
create table if not exists public.user_vocab (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  word text not null,
  status text not null default 'known',
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false,

  -- Unique constraint: one entry per user per word
  constraint user_vocab_user_word_unique unique (user_id, word)
);

-- 2. Enable Row Level Security
alter table public.user_vocab enable row level security;

-- 3. RLS Policies: users can only access their own rows
create policy "Users can select own vocab"
  on public.user_vocab for select
  using (auth.uid() = user_id);

create policy "Users can insert own vocab"
  on public.user_vocab for insert
  with check (auth.uid() = user_id);

create policy "Users can update own vocab"
  on public.user_vocab for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. Context column (stores the sentence where the word was encountered)
alter table public.user_vocab add column if not exists context text;

-- 5. Index for faster queries by user
create index if not exists idx_user_vocab_user_id on public.user_vocab(user_id);

-- 5. Auto-update updated_at on row change
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_vocab_updated_at
  before update on public.user_vocab
  for each row
  execute function public.update_updated_at();

-- ==================== daily_sentences ====================

-- 6. Daily sentences table (AI-generated example sentences)
create table if not exists public.daily_sentences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  word text not null,
  sentence text not null,
  translation text not null,
  created_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- 7. Enable RLS
alter table public.daily_sentences enable row level security;

-- 8. RLS Policies
create policy "Users can select own sentences"
  on public.daily_sentences for select
  using (auth.uid() = user_id);

create policy "Service role can insert sentences"
  on public.daily_sentences for insert
  with check (true);

-- 9. Index for efficient queries
create index if not exists idx_daily_sentences_user_date
  on public.daily_sentences(user_id, created_date);

-- ==================== browsing_records ====================

-- 10. Browsing records table (tracks page visits with duration)
create table if not exists public.browsing_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  url text not null,
  title text,
  visit_time timestamptz not null,
  duration_seconds integer default 0,
  domain text,
  created_at timestamptz default now()
);

-- 11. RLS
alter table public.browsing_records enable row level security;

create policy "Users can select own browsing records"
  on public.browsing_records for select
  using (auth.uid() = user_id);

create policy "Users can insert own browsing records"
  on public.browsing_records for insert
  with check (auth.uid() = user_id);

-- 12. Indexes
create index if not exists idx_browsing_records_user_visit
  on public.browsing_records(user_id, visit_time desc);

create index if not exists idx_browsing_records_domain
  on public.browsing_records(user_id, domain);

-- ==================== daily_browsing_summaries ====================

-- 13. Daily browsing summaries (AI-generated)
create table if not exists public.daily_browsing_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  summary_date date not null,
  total_records integer,
  total_duration_minutes integer,
  top_domains jsonb,
  time_distribution jsonb,
  ai_summary text,
  created_at timestamptz default now(),
  unique(user_id, summary_date)
);

-- 14. RLS
alter table public.daily_browsing_summaries enable row level security;

create policy "Users can select own summaries"
  on public.daily_browsing_summaries for select
  using (auth.uid() = user_id);

create policy "Service role can manage summaries"
  on public.daily_browsing_summaries for all
  using (true)
  with check (true);

-- 15. Index
create index if not exists idx_browsing_summaries_user_date
  on public.daily_browsing_summaries(user_id, summary_date desc);

-- ==================== vocab_levels ====================

-- 16. Vocabulary levels table (CEFR word lists, publicly readable)
create table if not exists public.vocab_levels (
  level text primary key,
  words jsonb not null default '[]'::jsonb
);

-- 17. RLS - anyone can read
alter table public.vocab_levels enable row level security;

create policy "Anyone can read vocab levels"
  on public.vocab_levels for select
  using (true);

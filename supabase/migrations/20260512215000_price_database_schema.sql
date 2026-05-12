-- Price reference database schema and public read layer.
-- Refs #200
--
-- This migration intentionally defines schema/RLS only. App runtime integration,
-- sync jobs and Supabase client setup belong to later PRs in the #200 sequence.

create schema if not exists extensions;
set search_path = public, extensions, pg_catalog;
create extension if not exists pgcrypto;

create table if not exists public.price_sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('sinapi', 'tcpo', 'supplier_quote', 'manual', 'historical', 'web_reference')),
  title text not null,
  supplier text not null,
  state text not null,
  city text,
  reference_month date not null,
  regime text not null check (regime in ('onerado', 'nao_desonerado', 'desonerado', 'unknown')),
  version text not null,
  status text not null check (status in ('staging', 'active', 'archived', 'failed')),
  source_hash text,
  imported_at timestamptz not null default now(),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.price_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.price_sources(id) on delete cascade,
  item_type text not null check (item_type in ('composition', 'input')),
  code text not null,
  description text not null,
  unit text not null,
  category text not null,
  construction_method text not null,
  state text not null,
  city text,
  reference_month date not null,
  regime text not null check (regime in ('onerado', 'nao_desonerado', 'desonerado', 'unknown')),
  material_cost_brl numeric(14, 4) not null default 0 check (material_cost_brl >= 0),
  labor_cost_brl numeric(14, 4) not null default 0 check (labor_cost_brl >= 0),
  equipment_cost_brl numeric(14, 4) not null default 0 check (equipment_cost_brl >= 0),
  third_party_cost_brl numeric(14, 4) not null default 0 check (third_party_cost_brl >= 0),
  other_cost_brl numeric(14, 4) not null default 0 check (other_cost_brl >= 0),
  direct_unit_cost_brl numeric(14, 4) not null default 0 check (direct_unit_cost_brl >= 0),
  total_labor_hours_per_unit numeric(14, 4) not null default 0 check (total_labor_hours_per_unit >= 0),
  price_status text not null check (price_status in ('valid', 'zeroed', 'missing', 'requires_review', 'invalid_unit', 'out_of_region', 'invalid')),
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  requires_review boolean not null default true,
  pending_reason text not null default '',
  tags text[] not null default '{}',
  search_text text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.composition_inputs (
  id uuid primary key default gen_random_uuid(),
  composition_item_id uuid not null references public.price_items(id) on delete cascade,
  input_code text,
  kind text not null check (kind in ('material', 'labor', 'equipment', 'third_party', 'other')),
  description text not null,
  quantity numeric(14, 6) not null default 0 check (quantity >= 0),
  unit text not null,
  unit_price_brl numeric(14, 4) not null default 0 check (unit_price_brl >= 0),
  total_brl numeric(14, 4) not null default 0 check (total_brl >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.waste_rules (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.price_sources(id) on delete cascade,
  label text not null,
  applies_to text[] not null default '{}',
  percent numeric(8, 4) not null default 0 check (percent >= 0),
  category text,
  construction_method text,
  requires_review boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.price_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  reference_month date not null,
  state text not null,
  regime text not null check (regime in ('onerado', 'nao_desonerado', 'desonerado', 'unknown')),
  status text not null check (status in ('started', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  imported_rows integer not null default 0 check (imported_rows >= 0),
  review_rows integer not null default 0 check (review_rows >= 0),
  status_counts jsonb not null default '{}'::jsonb,
  error_message text
);

create index if not exists price_sources_status_reference_idx on public.price_sources (source_type, status, state, reference_month, regime);
create unique index if not exists price_sources_active_unique_idx on public.price_sources (source_type, state, reference_month, regime) where status = 'active';
create index if not exists price_items_source_status_idx on public.price_items (source_id, price_status);
create index if not exists price_items_state_reference_regime_idx on public.price_items (state, reference_month, regime);
create index if not exists price_items_unit_category_method_idx on public.price_items (unit, category, construction_method);
create index if not exists price_items_search_text_idx on public.price_items using gin (to_tsvector('portuguese', search_text));
create index if not exists composition_inputs_composition_idx on public.composition_inputs (composition_item_id);
create index if not exists waste_rules_source_idx on public.waste_rules (source_id);
create index if not exists price_sync_runs_reference_idx on public.price_sync_runs (source_type, state, reference_month, regime, started_at desc);

alter table public.price_sources enable row level security;
alter table public.price_items enable row level security;
alter table public.composition_inputs enable row level security;
alter table public.waste_rules enable row level security;
alter table public.price_sync_runs enable row level security;

create policy price_sources_public_read_active
  on public.price_sources
  for select
  to anon, authenticated
  using (status = 'active');

create policy price_items_public_read_active_source
  on public.price_items
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.price_sources source
      where source.id = price_items.source_id
        and source.status = 'active'
    )
  );

create policy composition_inputs_public_read_active_composition
  on public.composition_inputs
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.price_items item
      join public.price_sources source on source.id = item.source_id
      where item.id = composition_inputs.composition_item_id
        and item.item_type = 'composition'
        and source.status = 'active'
    )
  );

create policy waste_rules_public_read_active_source
  on public.waste_rules
  for select
  to anon, authenticated
  using (
    source_id is null
    or exists (
      select 1
      from public.price_sources source
      where source.id = waste_rules.source_id
        and source.status = 'active'
    )
  );

revoke all on table public.price_sources from anon, authenticated;
revoke all on table public.price_items from anon, authenticated;
revoke all on table public.composition_inputs from anon, authenticated;
revoke all on table public.waste_rules from anon, authenticated;
revoke all on table public.price_sync_runs from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on table public.price_sources to anon, authenticated;
grant select on table public.price_items to anon, authenticated;
grant select on table public.composition_inputs to anon, authenticated;
grant select on table public.waste_rules to anon, authenticated;

grant all on table public.price_sources to service_role;
grant all on table public.price_items to service_role;
grant all on table public.composition_inputs to service_role;
grant all on table public.waste_rules to service_role;
grant all on table public.price_sync_runs to service_role;

create or replace view public.current_price_items
with (security_invoker = true) as
select
  item.id,
  item.source_id,
  source.title as source_title,
  source.supplier,
  source.source_type,
  item.item_type,
  item.code,
  item.description,
  item.unit,
  item.category,
  item.construction_method,
  item.state,
  item.city,
  item.reference_month,
  item.regime,
  item.material_cost_brl,
  item.labor_cost_brl,
  item.equipment_cost_brl,
  item.third_party_cost_brl,
  item.other_cost_brl,
  item.direct_unit_cost_brl,
  item.total_labor_hours_per_unit,
  item.price_status,
  item.confidence,
  item.requires_review,
  item.pending_reason,
  item.tags,
  item.search_text
from public.price_items item
join public.price_sources source on source.id = item.source_id
where source.status = 'active';

grant select on public.current_price_items to anon, authenticated;

create or replace function public.search_price_candidates(
  search_query text,
  search_state text default null,
  search_reference_month date default null,
  search_regime text default null,
  search_unit text default null,
  search_category text default null,
  search_construction_method text default null,
  search_limit integer default 20
)
returns table (
  id uuid,
  source_id uuid,
  source_title text,
  supplier text,
  source_type text,
  item_type text,
  code text,
  description text,
  unit text,
  category text,
  construction_method text,
  state text,
  city text,
  reference_month date,
  regime text,
  material_cost_brl numeric,
  labor_cost_brl numeric,
  equipment_cost_brl numeric,
  third_party_cost_brl numeric,
  other_cost_brl numeric,
  direct_unit_cost_brl numeric,
  total_labor_hours_per_unit numeric,
  price_status text,
  confidence text,
  requires_review boolean,
  pending_reason text,
  tags text[]
)
language sql
stable
security invoker
set search_path = public
as $$
  with normalized_query as (
    select nullif(trim(search_query), '') as value
  ),
  search_terms as (
    select
      value,
      websearch_to_tsquery('portuguese', value) as query
    from normalized_query
    where value is not null
  )
  select
    item.id,
    item.source_id,
    item.source_title,
    item.supplier,
    item.source_type,
    item.item_type,
    item.code,
    item.description,
    item.unit,
    item.category,
    item.construction_method,
    item.state,
    item.city,
    item.reference_month,
    item.regime,
    item.material_cost_brl,
    item.labor_cost_brl,
    item.equipment_cost_brl,
    item.third_party_cost_brl,
    item.other_cost_brl,
    item.direct_unit_cost_brl,
    item.total_labor_hours_per_unit,
    item.price_status,
    item.confidence,
    item.requires_review,
    item.pending_reason,
    item.tags
  from public.current_price_items item
  cross join normalized_query normalized
  left join search_terms terms on true
  where (
      normalized.value is null
      or item.code ilike normalized.value || '%'
      or to_tsvector('portuguese', item.search_text) @@ terms.query
    )
    and (search_state is null or item.state = search_state)
    and (search_reference_month is null or item.reference_month = search_reference_month)
    and (search_regime is null or item.regime = search_regime)
    and (search_unit is null or item.unit = search_unit)
    and (search_category is null or item.category = search_category)
    and (search_construction_method is null or item.construction_method = search_construction_method)
  order by
    case item.confidence when 'high' then 0 when 'medium' then 1 else 2 end,
    item.requires_review asc,
    item.description asc
  limit least(greatest(coalesce(search_limit, 20), 1), 50);
$$;

grant execute on function public.search_price_candidates(text, text, date, text, text, text, text, integer) to anon, authenticated;

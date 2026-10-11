-- CTS — le coaching par Nolio (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, décisions coach N1 à N5 du
-- 11/10/2026) : le moteur prépare le plan de chaque athlète coaché, le coach le relit et en envoie les
-- semaines dans Nolio. À exécuter une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run.
--
-- nolio_comptes : la liaison du compte Nolio du coach (jetons OAuth). Lue et écrite par le serveur du site
-- seulement (clé de service) : aucune règle de lecture, le navigateur n'y a jamais accès.
-- coaching : les plans des athlètes coachés, rangés dans le compte du coach, et l'athlète Nolio associé.
-- nolio_envois : les semaines envoyées dans Nolio et les séances créées (N4 : une semaine envoyée ne se
-- renvoie pas tant que ses séances existent dans Nolio).

create table public.nolio_comptes (
  compte_id uuid primary key references public.comptes (id) on delete cascade,
  jeton_acces text not null,
  jeton_renouvellement text not null,
  expire_le timestamptz not null,
  relie_le timestamptz not null default now()
);
comment on table public.nolio_comptes is
  'La liaison du compte Nolio d''un coach : jetons lus et écrits par le serveur seulement.';

create table public.coaching (
  plan_id uuid primary key references public.plans (id) on delete cascade,
  coach_id uuid not null references public.comptes (id) on delete cascade,
  athlete_nom text not null,
  nolio_athlete_id bigint,
  cree_le timestamptz not null default now()
);
comment on table public.coaching is
  'Un plan d''athlète coaché, rangé dans le compte du coach, avec son athlète Nolio.';

create table public.nolio_envois (
  plan_id uuid not null references public.plans (id) on delete cascade,
  semaine text not null,
  coach_id uuid not null references public.comptes (id) on delete cascade,
  seances jsonb not null,
  envoye_le timestamptz not null default now(),
  primary key (plan_id, semaine)
);
comment on table public.nolio_envois is
  'Une semaine envoyée dans Nolio : les séances créées (jour du plan, identifiant Nolio).';

alter table public.nolio_comptes enable row level security;
alter table public.coaching enable row level security;
alter table public.nolio_envois enable row level security;
create policy "coaching : le coach lit les siens" on public.coaching
  for select to authenticated using (coach_id = (select auth.uid()));
create policy "nolio_envois : le coach lit les siens" on public.nolio_envois
  for select to authenticated using (coach_id = (select auth.uid()));

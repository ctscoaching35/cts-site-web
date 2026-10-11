-- CTS — l'athlète coaché sur la durée (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, N8 et N9, décisions coach
-- du 11/10/2026) : une fiche par athlète, qui regroupe ses objectifs successifs (un plan par objectif principal),
-- son nom Nolio et ses valeurs (FC au seuil 1, vitesse critique, FC au seuil 2), saisies par le coach. À exécuter
-- une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run.
--
-- Les athlètes déjà ajoutés reçoivent chacun leur fiche, avec leur nom Nolio.

create table public.athletes_coaches (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.comptes (id) on delete cascade,
  nom text not null,
  nolio_athlete_id bigint,
  fc_seuil1 smallint check (fc_seuil1 between 80 and 220),
  vc_ms real check (vc_ms between 1.5 and 7.5),
  fc_seuil2 smallint check (fc_seuil2 between 80 and 230),
  cree_le timestamptz not null default now(),
  plan_origine uuid
);
comment on table public.athletes_coaches is
  'Un athlète coaché : ses objectifs (coaching.athlete_id), son nom Nolio, ses valeurs saisies par le coach.';

alter table public.coaching add column athlete_id uuid references public.athletes_coaches (id) on delete cascade;

with nouveaux as (
  insert into public.athletes_coaches (coach_id, nom, nolio_athlete_id, plan_origine)
  select coach_id, athlete_nom, nolio_athlete_id, plan_id from public.coaching where athlete_id is null
  returning id, plan_origine
)
update public.coaching c set athlete_id = n.id from nouveaux n where c.plan_id = n.plan_origine;

alter table public.athletes_coaches drop column plan_origine;

alter table public.athletes_coaches enable row level security;
create policy "athletes_coaches : le coach lit les siens" on public.athletes_coaches
  for select to authenticated using (coach_id = (select auth.uid()));

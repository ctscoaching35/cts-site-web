-- CTS — l'accord des athlètes coachés pour le suivi (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, T3, décision coach du
-- 13/10/2026) : le tableau de bord du coach ne lit dans Nolio que les athlètes qui ont accepté, par écrit, dans la
-- messagerie Nolio ; le coach coche « Accord reçu » et la date s'enregistre. Retirer l'accord efface la ligne. Rien de
-- ce que l'app lit dans Nolio n'est gardé : seulement l'identifiant Nolio de l'athlète, son nom et la date. À exécuter
-- une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run.

create table public.nolio_accords (
  coach_id uuid not null references public.comptes (id) on delete cascade,
  nolio_athlete_id text not null,
  nom text not null default '',
  accord_le timestamptz not null default now(),
  primary key (coach_id, nolio_athlete_id)
);
comment on table public.nolio_accords is
  'L''accord d''un athlète coaché pour que le tableau de bord du coach lise ses séances et son Hooper dans Nolio.';

alter table public.nolio_accords enable row level security;
create policy "nolio_accords : le coach lit les siens" on public.nolio_accords
  for select to authenticated using (coach_id = (select auth.uid()));

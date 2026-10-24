-- CTS — les points « À regarder » que le coach a réglés (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur ; décision coach
-- du 24/10/2026, « pouvoir enlever certains points quand j'ai réglé le problème »). À exécuter une fois dans le projet
-- Supabase : SQL Editor, coller ce fichier, Run. Avant de pousser le site qui s'en sert.
--
-- cle : ce point-là (son genre, l'athlète ou l'objectif, et ce qu'il désigne : la semaine, la course, le test, le mot,
-- le chrono visé) ; un point réglé ne revient jamais, un nouveau point du même genre a une autre clé et s'affiche.
-- Lue et écrite par le serveur seulement (clé de service) : aucune règle d'accès publique.

begin;

create table if not exists public.a_regarder_regles (
  coach_id uuid not null references public.comptes (id) on delete cascade,
  cle text not null,
  regle_le timestamptz not null default now(),
  primary key (coach_id, cle)
);
alter table public.a_regarder_regles enable row level security;
comment on table public.a_regarder_regles is
  'Les points « À regarder » que le coach a réglés : ce point-là ne revient jamais, un nouveau point s''affiche.';

commit;

-- CTS — les retouches du coach dans Nolio (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur ; décision coach du 26/10/2026,
-- « compter tes retouches », la boussole du carnet d'améliorations du moteur). À exécuter une fois dans le projet
-- Supabase : SQL Editor, coller ce fichier, Run. Avant de pousser le site qui s'en sert.
--
-- Une ligne par semaine écrite par le moteur d'un objectif coaché, recomptée chaque nuit tant qu'elle est la semaine en
-- cours ou la précédente : par famille de séances (ef, seuil1, seuil2, vo2max, allure, sl, mecanique, renfo), les
-- séances envoyées, modifiées (leur contenu changé dans Nolio, pas leur jour), supprimées, et pour les modifiées la durée
-- prévue et celle de Nolio, en minutes (min_avant, min_apres) ; ajoutees : les séances de course posées dans la semaine
-- que l'app n'a pas envoyées. Des comptes seulement, aucune séance.
-- Lue et écrite par le serveur seulement (clé de service) : aucune règle d'accès publique.

begin;

create table if not exists public.retouches (
  plan_id uuid not null references public.plans (id) on delete cascade,
  semaine text not null,
  coach_id uuid not null references public.comptes (id) on delete cascade,
  lundi date not null,
  familles jsonb not null default '{}'::jsonb,
  ajoutees integer not null default 0,
  compte_le timestamptz not null default now(),
  primary key (plan_id, semaine)
);
create index if not exists retouches_coach_lundi on public.retouches (coach_id, lundi);
alter table public.retouches enable row level security;
comment on table public.retouches is
  'Les retouches du coach dans Nolio, par semaine écrite et par famille de séances : des comptes, aucune séance.';

commit;

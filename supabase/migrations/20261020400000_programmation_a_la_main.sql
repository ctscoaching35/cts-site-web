-- CTS — l'athlète que le coach programme à la main (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur ; décision coach du
-- 20/10/2026, « tableau de bord complet »). À exécuter une fois dans le projet Supabase : SQL Editor, coller ce
-- fichier, Run.
--
-- programmation, sur sa fiche : « auto » (le moteur écrit ses semaines chaque dimanche) ou « main » (le coach les écrit
-- dans Nolio ; le moteur n'écrit rien, l'app reste son tableau de bord).
--
-- semaines_athlete : le résumé chiffré de chaque semaine que le moteur n'a pas écrite (à la main, entre deux objectifs,
-- avant une préparation), tiré chaque nuit de ses séances prévues et réalisées dans Nolio et de son Hooper, avec son
-- accord de lecture : la même forme que semaines_ecrites.realise. Aucune séance n'est gardée. Lue et écrite par le
-- serveur seulement (clé de service) : aucune règle d'accès publique. Effacée avec sa fiche, ou quand l'accord est
-- retiré.

begin;

alter table public.athletes_coaches add column if not exists programmation text not null default 'auto'
  check (programmation in ('auto', 'main'));
comment on column public.athletes_coaches.programmation is
  'auto : le moteur écrit ses semaines chaque dimanche ; main : le coach les écrit dans Nolio, l''app reste son tableau de bord.';

create table if not exists public.semaines_athlete (
  athlete_id uuid not null references public.athletes_coaches (id) on delete cascade,
  lundi date not null,
  realise jsonb not null,
  maj_le timestamptz not null default now(),
  primary key (athlete_id, lundi)
);
alter table public.semaines_athlete enable row level security;
comment on table public.semaines_athlete is
  'Le résumé de chaque semaine que le moteur n''a pas écrite, tiré de Nolio chaque nuit ; jamais ses séances.';

commit;

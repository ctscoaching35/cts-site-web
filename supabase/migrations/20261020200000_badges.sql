-- CTS — les badges du coureur (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, BG1 à BG3 ; décisions coach du
-- 20/10/2026). À exécuter une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run.
--
-- Une ligne par athlète Nolio (son identifiant), avec son accord de lecture : debloques, les badges débloqués et la date
-- de la séance qui les a débloqués ({"distance_20": {"date": "AAAA-MM-JJ"}, …}) ; mois, ses totaux de course et de trail
-- par mois ({"2026-10": {"km": 182.4, "dplus": 5230}, …}), pour les cumuls. Aucune séance n'est gardée. Lue et écrite
-- par le serveur seulement (clé de service) : aucune règle d'accès publique. Effacée quand l'accord est retiré.

begin;

create table public.badges (
  nolio_athlete_id text primary key,
  debloques jsonb not null default '{}'::jsonb,
  mois jsonb not null default '{}'::jsonb,
  maj_le timestamptz not null default now()
);
alter table public.badges enable row level security;
comment on table public.badges is
  'Les badges d''un coureur (BG1 à BG3) : débloqués (date de la séance) et totaux par mois ; jamais ses séances.';

commit;

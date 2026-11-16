-- CTS — l'app gratuite, lot A2 (décision du coach du 16/11/2026) : la LIMITE de l'aperçu du plan avant paiement. À exécuter
-- une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run. Sans lui, l'aperçu fonctionne quand même, sans limite
-- (le serveur écrit un avertissement dans ses journaux).
--
-- Au plus 10 aperçus par visiteur et par heure. Le visiteur n'est jamais son adresse IP : une empreinte HMAC de celle-ci avec
-- un secret du serveur. La table est purgée à chaque appel au-delà d'une heure. Aucune politique : seul le serveur (clé de
-- service) lit et écrit.

create table public.apercus_appels (
  id bigint generated always as identity primary key,
  empreinte text not null,
  appele_le timestamptz not null default now()
);
create index apercus_appels_visiteur on public.apercus_appels (empreinte, appele_le);
create index apercus_appels_heure on public.apercus_appels (appele_le);
alter table public.apercus_appels enable row level security;
comment on table public.apercus_appels is
  'Les appels de l''aperçu du plan : empreinte HMAC de l''adresse IP et heure, purgés au-delà d''une heure. Aucune politique : le serveur seul.';

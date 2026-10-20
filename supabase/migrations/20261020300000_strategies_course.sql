-- CTS — la stratégie de course gardée (décision coach du 20/10/2026 : « elle s'inscrit dans sa fiche de course »).
-- À exécuter une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run.
--
-- Sur chaque objectif (plans), une stratégie par fiche de course : « objectif » pour sa course, la date (AAAA-MM-JJ)
-- d'une course de préparation : {"objectif": {"entrees": {…}, "cartes": [{"nom": "Glucides", "valeur": "45 à 55 g",
-- "sous": "par heure"}, …], "le": "AAAA-MM-JJ"}, …}. entrees : ses réponses au calculateur de nutrition (durée, poids,
-- conditions, nuit, niveau, intestin, sueur) ; cartes : ses quatre repères. Écrite par le serveur seulement (clé de
-- service), au geste « Garder ma stratégie » de l'athlète ; effacée par lui, ou avec l'objectif.

begin;

alter table public.plans add column if not exists strategies jsonb not null default '{}'::jsonb;
comment on column public.plans.strategies is
  'La stratégie de course gardée par l''athlète, par fiche de course : ses réponses au calculateur et ses quatre repères.';

commit;

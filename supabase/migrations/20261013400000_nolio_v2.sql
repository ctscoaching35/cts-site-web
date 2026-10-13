-- CTS — le coaching par Nolio passe à l'API v2 (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, décision coach du
-- 13/10/2026 : « on n'a pas encore fini de développer l'app, c'est le moment ») : l'app parle à Nolio avec la clé
-- de l'application personnelle du coach (NOLIO_API_KEY, dans Vercel), plus de liaison OAuth. À exécuter une fois
-- dans le projet Supabase : SQL Editor, coller ce fichier, Run.
--
-- Les athlètes Nolio ont désormais un identifiant texte (« usr_… ») : les numéros de la v1 déjà enregistrés
-- deviennent du texte, et l'app les convertit d'elle-même à la première visite (GET /api/v2/migration/ids/).
-- La liaison OAuth de la v1 ne sert plus : sa table et ses jetons partent.

alter table public.athletes_coaches alter column nolio_athlete_id type text using nolio_athlete_id::text;

drop table public.nolio_comptes;

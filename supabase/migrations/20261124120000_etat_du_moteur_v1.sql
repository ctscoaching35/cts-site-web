-- CTS — l'état du moteur v1 (version 9.x), gardé par plan (écrite le 24/11/2026 ; À NE PAS APPLIQUER AVANT LA MISE EN LIGNE DU MOTEUR v1, avec
-- l'OK du coach).
--
-- Le moteur v1 ne garde rien : chaque appel de `POST /v1/semaine` rend un `etat`, que le site lui rend tel quel à l'appel suivant (CONTRAT_API_CTS.md,
-- « MOTEUR v1 »). Réécrire une semaine (une nouvelle réponse avant sa première séance) lui rend le même numéro avec l'état d'AVANT cette semaine.
-- Le site garde donc, par plan :
--   plans.etat_moteur                      l'état rendu par la dernière écriture (ou la dernière réponse tardive) ;
--   semaines_ecrites.etat_avant_moteur     l'état que le moteur a REÇU pour écrire cette semaine (rien pour la première) ;
--   semaines_ecrites.moteur                la version du moteur qui l'a écrite (« 9.0 ») : une ligne de la 8.x reste sans ;
--   semaines_ecrites.pourquoi, .branche    « Pourquoi cette semaine » (sept lignes, pour l'espace coach) et la branche de l'adaptation (1 à 5) ;
--   semaines_ecrites.questionnaire         le questionnaire du dimanche posé à la fin de cette semaine : sa version (normale, aucune séance vue,
--                                          fatigue), ses séances clés dans l'ordre posé (la réponse les dit par leur rang) et l'identifiant Nolio.
-- Les colonnes de la 8.x (plans.etat_ecriture, semaines_ecrites.etat_avant, revue, realise) ne sont ni lues ni modifiées par la 9.x : un retour à
-- la 8.474 retrouve ses états. Rien ne casse sans cette migration tant que le moteur en ligne est une 8.x : la chaîne de la 9.x n'écrit rien.
--
-- À exécuter une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run.

begin;

alter table public.plans add column if not exists etat_moteur jsonb;
comment on column public.plans.etat_moteur is
  'L''état que le moteur v1 (9.x) a rendu à sa dernière écriture ou réponse tardive, rendu tel quel à l''appel suivant (24/11/2026) ; null avant toute écriture par le moteur v1.';

alter table public.semaines_ecrites add column if not exists moteur text;
alter table public.semaines_ecrites add column if not exists etat_avant_moteur jsonb;
alter table public.semaines_ecrites add column if not exists pourquoi jsonb;
alter table public.semaines_ecrites add column if not exists branche smallint check (branche is null or branche between 1 and 5);
alter table public.semaines_ecrites add column if not exists questionnaire jsonb;
comment on column public.semaines_ecrites.moteur is
  'La version du moteur qui a écrit cette semaine (« 9.0 ») ; null pour une semaine de la 8.x.';
comment on column public.semaines_ecrites.etat_avant_moteur is
  'L''état que le moteur v1 a reçu pour écrire cette semaine, à lui rendre pour la réécrire ; null pour la première.';
comment on column public.semaines_ecrites.pourquoi is
  '« Pourquoi cette semaine » du moteur v1 : sept lignes { n, libelle, texte, manque? }, pour l''espace coach, jamais montrées à l''acheteur.';
comment on column public.semaines_ecrites.branche is 'La branche de l''adaptation (1 à 5) que le moteur v1 a suivie.';
comment on column public.semaines_ecrites.questionnaire is
  'Le questionnaire du dimanche posé à la fin de cette semaine : { version, cles: [{ id, libelle }], nolio_id, pose_le } ; sert à lire les réponses en rangs.';

commit;

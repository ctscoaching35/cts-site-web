-- CTS — « ses jours » : la dernière réponse lue au questionnaire du samedi (lot 0 du 16/11/2026, point 2 de la consigne App ;
-- le moteur 8.466 garde lui-même la dernière réponse lue, le site la garde aussi).
--
-- Une colonne de plus sur plans, écrite par le passage du dimanche, la passe du lundi et « Réessayer » à chaque réponse lue
-- (lib/app/ecriture.ts, garderSesJours) :
--   { jours : ["mardi", "jeudi", …] | null, jour_sl : "dimanche" | null, nb_seances : 4 | null, du : "2026-11-14" }
-- Un champ illisible garde la dernière valeur lue. Elle sert de dernière réponse quand Nolio n'en rend aucune (la lecture de la
-- semaine, puis des 8 semaines d'avant), jamais plus ancienne que la déclaration de l'objectif ; la page de l'athlète, côté coach,
-- l'affiche : « Ses jours : mar, jeu, sam, dim ; sortie longue dim ; 4 séances — réponse du 14/11 ».
--
-- À exécuter une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run. Sans lui, rien ne casse : rien ne se garde,
-- et la page n'affiche pas la ligne « Ses jours ».

begin;

alter table public.plans add column if not exists ses_jours jsonb;
comment on column public.plans.ses_jours is
  'Ses jours (lot 0, 16/11/2026) : la dernière réponse lue au questionnaire du samedi (jours, jour de sortie longue, nombre de séances, date de la réponse).';

commit;

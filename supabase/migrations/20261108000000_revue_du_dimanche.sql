-- CTS — la revue du dimanche, gardée au passage (l'espace coach par athlète ; maquette validée par le coach le 08/11/2026,
-- question Q4 « A »).
--
-- Le dimanche soir, après le passage, la page de chaque athlète montre « Sa semaine qui arrive » : la semaine écrite, ce
-- que le moteur change et la note « Ta semaine » (déjà gardés dans semaines_ecrites), et désormais son « Pourquoi cette
-- semaine » et « Ce qu'il a lu », que l'aperçu calculait mais que rien ne gardait. Une colonne de plus, écrite par le
-- passage du dimanche et par « Réessayer » (lib/app/ecriture.ts, revueDe et garderLaRevue) :
--   { quoi, pourquoi (le pourquoi du moteur), realise (la semaine écoulée telle que le moteur l'a jugée),
--     lu : { questionnaire, questionnaire_du (sa réponse du samedi), lues (ses séances de qualité des 4 dernières
--            semaines : date, famille, minutes, répétitions, RPE), premiere, sansRetours } }.
-- Jamais le détail des séances lues dans Nolio. Elle s'efface avec l'accord de lecture, comme realise.
--
-- À exécuter une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run. Sans lui, rien ne casse : les semaines
-- partent comme avant, la revue ne se garde pas, et la page de l'athlète le dit sous « Sa semaine qui arrive ».

begin;

alter table public.semaines_ecrites add column if not exists revue jsonb;
comment on column public.semaines_ecrites.revue is
  'La revue du dimanche (Q4, 08/11/2026) : le pourquoi du moteur et ce qu''il a lu (réponse du samedi, semaine écoulée, séances de qualité), gardés au passage ; null sans accord de lecture.';

commit;

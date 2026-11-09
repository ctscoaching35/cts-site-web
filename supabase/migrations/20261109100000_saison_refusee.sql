-- CTS — la saison de fond refusée, gardée sur la fiche (moteur 8.464, étape D3 de la doctrine de la semaine ; décision 8
-- du coach du 09/11/2026 : « un refus n'est plus jamais tu », il apparaît dans « Urgent »).
--
-- saison_refusee : la saison que le passage du soir n'a pas pu créer pour un coaché en programmation automatique —
-- {"le": "AAAA-MM-JJ", "lundi": "AAAA-MM-JJ" (le lundi qu'elle devait couvrir), "motif": ce que le moteur a répondu} —,
-- écrite par lib/app/fond.ts (saisonsDuJour), effacée dès qu'une saison ou une préparation couvre son lundi ; « Urgent »
-- la montre (lib/app/espaceCoach.ts, genre « saison »). Jamais de donnée de l'athlète : le message du moteur seul.
--
-- À exécuter une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run. Avant de pousser le site qui s'en sert.
-- Sans lui, rien ne casse : le refus reste au journal du soir, comme avant, et « Urgent » ne le montre pas.

begin;

alter table public.athletes_coaches add column if not exists saison_refusee jsonb;
comment on column public.athletes_coaches.saison_refusee is
  'La saison de fond que le passage du soir n''a pas pu créer (le, lundi, motif du moteur) ; effacée quand son lundi est couvert.';

commit;

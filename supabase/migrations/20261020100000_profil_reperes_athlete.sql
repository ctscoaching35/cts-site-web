-- CTS — le profil et les repères d'un athlète coaché (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, PO1 et AP4 ;
-- décisions coach du 19/10/2026). À exécuter une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run.
--
-- profil : rempli une fois et modifiable sur sa fiche, à part de ses objectifs (niveau, terrain, jours disponibles,
-- jour de la sortie longue, séances par semaine) ; le questionnaire court d'un nouvel objectif le reprend (sinon les
-- réponses du dernier objectif). d_prime_m : la D′ de son test de vitesse critique, pour son profil de coureur (le
-- coefficient de Riegel, AP4). reperes_sources : pour chaque repère, sa date et sa source (« test » lu dans Nolio,
-- « coach » saisi sur la fiche). Le tout dans une transaction.

begin;

alter table public.athletes_coaches
  add column profil jsonb,
  add column d_prime_m real check (d_prime_m between 20 and 600),
  add column reperes_sources jsonb not null default '{}'::jsonb;
comment on column public.athletes_coaches.profil is
  'Le profil de l''athlète (PO1) : niveau, terrain, jours_disponibles, jour_sl, freq_hebdo ; null : celui du dernier objectif.';
comment on column public.athletes_coaches.reperes_sources is
  'Pour fc_seuil1, vc_ms, fc_seuil2 : {"le": "AAAA-MM-JJ", "source": "test" | "coach"}.';

commit;

-- CTS — le dimanche de chaque coaché (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur ; décision coach du 21/10/2026,
-- « une série par coaché »). À exécuter une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run.
--
-- questionnaires, sur sa fiche : la série du dimanche que le site pose dans son Nolio — « Ta semaine prochaine », avec
-- la question ouverte des coachés, et le Hooper, chaque dimanche à 8 h, par séries de 26 semaines renouvelées par le
-- passage quotidien : {"semaine": id, "hooper": id, "jusqua": "AAAA-MM-JJ", "mot_le": "AAAA-MM-JJ", "mot_note": horodatage}.
-- mot_le : le dernier dimanche où il a écrit à la question ouverte, lu chaque nuit avec son accord ; le texte reste dans
-- Nolio, jamais ici.

begin;

alter table public.athletes_coaches add column if not exists questionnaires jsonb;
comment on column public.athletes_coaches.questionnaires is
  'La série du dimanche posée dans son Nolio (ids, fin) et le dernier mot écrit à la question ouverte (sa date, pas son texte).';

commit;

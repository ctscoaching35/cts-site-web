-- CTS — l'allure du seuil 1 (le palier du test de la parole), recoupée avec la vitesse critique comme dans le
-- calculateur « Ton profil de traileur » (décision coach du 13/10/2026, B1 ; moteur 8.320) : dans « Tes zones » de
-- l'athlète, et sur la fiche d'un athlète coaché pour Nolio. En m/s (2:30 à 12:00/km). À exécuter une fois dans
-- le projet Supabase : SQL Editor, coller ce fichier, Run.

alter table public.zones add column v_seuil1_ms real check (v_seuil1_ms between 1.3 and 7.0);
alter table public.athletes_coaches add column v_seuil1_ms real check (v_seuil1_ms between 1.3 and 7.0);

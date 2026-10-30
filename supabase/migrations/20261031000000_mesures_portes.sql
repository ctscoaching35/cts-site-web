-- CTS — les portes du questionnaire (audit de la programmation trail du 30/10/2026, P6 ; décision coach du même jour) :
-- les compteurs anonymes du tunnel de vente comptent aussi les refus avant paiement, par type, une fois par visite.
-- À exécuter une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run. Sans lui, les portes ne se
-- comptent pas (la mesure échoue en silence), le reste du tunnel continue.

alter table public.mesures drop constraint if exists mesures_etape_check;
alter table public.mesures add constraint mesures_etape_check check (etape in (
  'offre', 'questionnaire', 'recap', 'paiement',
  'porte_niveau', 'porte_duree', 'porte_frequence', 'porte_sortie_longue', 'porte_temps', 'porte_autre'
));

-- CTS — la confirmation de charge avant un départ éloigné (décision coach du 04/11/2026 au soir, « A » ;
-- lib/app/confirmation.ts). Un achat fait plus de 3 semaines avant son invitation dans l'équipe Nolio (le lundi de la
-- semaine qui précède le départ) : de l'invitation à la veille du départ, l'app demande à l'acheteur si son volume, sa
-- plus longue sortie ou un arrêt récent ont changé ; sa réponse est gardée ici, et sa première semaine s'écrit dessus.
-- À exécuter une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run. Sans lui, la carte ne s'affiche pas
-- et le rappel du samedi ne part pas ; tout le reste continue (les réponses de l'achat servent).

alter table public.plans add column if not exists confirmation_charge jsonb;
comment on column public.plans.confirmation_charge is
  'La réponse de l''acheteur à la confirmation de charge (lib/app/confirmation.ts) : {le, reponse : « oui » | « corrige », '
  'charge : {volume_hebdo_actuel, sortie_longue_actuelle, coupure}} ; null sans réponse.';

-- CTS — s'adapter aux retours (cadrage de l'app §7.2, étape 3, décisions coach A1 à A7 du 08/10/2026) :
-- les propositions d'ajustement que l'athlète applique ou refuse. À exécuter une fois dans le projet
-- Supabase : SQL Editor, coller ce fichier, Run.
--
-- Une ligne par décision : la règle (marche reprise ou fatigue), la séance visée, la séance d'où vient
-- la marche reprise, appliquée ou refusée, et le jour de la décision. Le plan lui-même ne change pas.
-- Ces décisions découlent des retours de séance : elles vivent sous le consentement du journal (J3,
-- « seulement pour suivre et ajuster mon plan ») et partent avec lui, avec le plan ou le compte. Les
-- refus et les acceptations se comptent pendant la bêta pour corriger les seuils.
--
-- Écritures : seulement par le serveur du site (clé de service), après avoir vérifié la session ;
-- le navigateur ne fait que lire ce qui est à lui.

create table public.ajustements (
  plan_id uuid not null references public.journaux (plan_id) on delete cascade,
  regle text not null check (regle in ('marche', 'fatigue')),
  cible text not null,
  source text,
  statut text not null check (statut in ('applique', 'refuse')),
  decide_le date not null,
  compte_id uuid not null references public.comptes (id) on delete cascade,
  maj_le timestamptz not null default now(),
  primary key (plan_id, regle, cible)
);
comment on table public.ajustements is
  'Une proposition d''ajustement appliquée ou refusée (cible : l''identifiant stable de la séance visée, « S9-jeudi »).';

alter table public.ajustements enable row level security;
create policy "ajustements : chacun lit les siens" on public.ajustements
  for select to authenticated using (compte_id = (select auth.uid()));

-- CTS — l'app gratuite, lot A2 (décisions du coach du 16/11/2026) : la DEMANDE DE COACHING d'un compte gratuit. À exécuter
-- une fois dans le projet Supabase (après celui du lot A1, 20261116110000_app_gratuite.sql) : SQL Editor, coller ce fichier,
-- Run.
--
-- Une demande par compte, rattachée au compte (public.comptes) et effacée avec lui. Le compte la LIT et l'EFFACE (« Effacer ma
-- demande » dans Compte) ; il ne l'écrit pas : seul le serveur écrit (clé de service), après avoir contrôlé les réponses, la
-- santé et son consentement. Le coach la lit par le serveur (son espace, /app/coach/demandes).
--
-- La santé est une donnée à part : une colonne à part, jamais gardée sans le consentement daté (contrôle ici aussi). Une demande
-- non acceptée est effacée 3 mois après son envoi (le passage quotidien, lib/app/demandesCoaching.ts) ; « Sans suite » l'efface
-- tout de suite ; une demande acceptée reste lisible sur la fiche du coaché (athlete_id).

create table public.demandes_coaching (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid not null unique references public.comptes (id) on delete cascade,
  -- les réponses du formulaire (lib/app/coachingRegles.ts, ReponsesCoaching), sans la santé ni le téléphone
  reponses jsonb not null default '{}'::jsonb,
  sante text,
  consentement_sante_le timestamptz,
  -- les moments où appeler : « lun_matin », « mer_soir »… (au moins un)
  moments jsonb not null default '[]'::jsonb,
  telephone text not null,
  envoyee_le timestamptz not null default now(),
  statut text not null default 'ouverte' check (statut in ('ouverte', 'acceptee', 'sans_suite')),
  traitee_le timestamptz,
  athlete_id uuid references public.athletes_coaches (id) on delete set null,
  constraint demandes_coaching_sante_avec_accord check (sante is null or consentement_sante_le is not null)
);
create index demandes_coaching_statut on public.demandes_coaching (statut, envoyee_le);
comment on table public.demandes_coaching is
  'La demande de coaching d''un compte gratuit : ses réponses (jsonb), sa santé (colonne à part, avec consentement_sante_le '
  'daté, sinon vide), ses moments d''appel et son téléphone. Non acceptée, effacée 3 mois après envoyee_le ; acceptée, reliée '
  'à la fiche du coaché (athlete_id).';

alter table public.demandes_coaching enable row level security;

create policy "demandes_coaching : chacun lit la sienne" on public.demandes_coaching
  for select to authenticated using (compte_id = (select auth.uid()));
create policy "demandes_coaching : chacun efface la sienne" on public.demandes_coaching
  for delete to authenticated using (compte_id = (select auth.uid()));
-- Ni ajout ni modification par le compte : le serveur seul écrit.

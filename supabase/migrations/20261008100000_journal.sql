-- CTS — le journal de séance (cadrage de l'app §7.2, décisions coach J1 à J7 du 08/10/2026) : après
-- chaque séance, faite, raccourcie ou pas faite, le RPE ressenti, les sensations du jour (1 à 5). À
-- exécuter une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run.
--
-- Ces retours renseignent sur l'état de forme : gardés seulement avec le consentement explicite de
-- l'athlète (J3), daté dans journaux, pour une seule finalité (suivre et ajuster son plan). Jamais de
-- douleur (J6). Effaçables à tout moment, et avec le plan ou le compte.
--
-- Écritures : seulement par le serveur du site (clé de service), après avoir vérifié la session ;
-- le navigateur ne fait que lire ce qui est à lui.

create table public.journaux (
  plan_id uuid primary key references public.plans (id) on delete cascade,
  compte_id uuid not null references public.comptes (id) on delete cascade,
  consentement_le timestamptz not null default now()
);
comment on table public.journaux is
  'Le consentement au journal de séance d''un plan (J3) : sans lui, aucun retour n''est gardé.';

create table public.retours (
  plan_id uuid not null references public.journaux (plan_id) on delete cascade,
  jour_id text not null,
  compte_id uuid not null references public.comptes (id) on delete cascade,
  statut text not null check (statut in ('faite', 'raccourcie', 'pas_faite')),
  rpe smallint check (rpe between 0 and 10),
  sensations smallint check (sensations between 1 and 5),
  maj_le timestamptz not null default now(),
  primary key (plan_id, jour_id)
);
comment on table public.retours is
  'Un retour par séance (jour_id : l''identifiant stable du plan, « S9-jeudi »), toujours corrigeable (J7).';

alter table public.journaux enable row level security;
alter table public.retours enable row level security;
create policy "journaux : chacun lit le sien" on public.journaux
  for select to authenticated using (compte_id = (select auth.uid()));
create policy "retours : chacun lit les siens" on public.retours
  for select to authenticated using (compte_id = (select auth.uid()));

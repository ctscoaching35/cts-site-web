-- CTS — « Tes zones » (cadrage de l'app §7.1, décisions coach Z1 à Z9 des 07 et 08/10/2026) : le
-- profil de l'athlète pour un plan (FC au seuil 1, vitesse critique et D′, FC au seuil 2). À
-- exécuter une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run.
--
-- La FC compte parmi les données relatives à la santé (CNIL) : elle n'est gardée qu'avec le
-- consentement explicite de l'athlète (décision Z2), daté ici, pour une seule finalité (calibrer
-- ses séances), jamais croisée avec la réponse « blessure » (qui ne quitte pas le navigateur).
-- Effacée à la demande, et avec le plan ou le compte.
--
-- Écritures : seulement par le serveur du site (clé de service), après avoir vérifié la session ;
-- le navigateur ne fait que lire ce qui est à lui.

create table public.zones (
  plan_id uuid primary key references public.plans (id) on delete cascade,
  compte_id uuid not null references public.comptes (id) on delete cascade,
  fc_seuil1 smallint check (fc_seuil1 between 80 and 220),
  fc_seuil1_le date,
  vc_ms real check (vc_ms between 2 and 7),
  d_prime_m real check (d_prime_m between 20 and 600),
  vc_efforts jsonb,
  vc_le date,
  fc_seuil2 smallint check (fc_seuil2 between 80 and 220),
  fc_seuil2_le date,
  consentement_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);
comment on table public.zones is
  'Le profil « Tes zones » d''un plan (valable pour toute sa durée, Z9), gardé avec le consentement '
  'explicite de l''athlète (Z2). Le RPE prime : ce ne sont que des repères.';

alter table public.zones enable row level security;
create policy "zones : chacun lit les siennes" on public.zones
  for select to authenticated using (compte_id = (select auth.uid()));

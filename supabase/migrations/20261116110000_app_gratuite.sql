-- CTS — l'app gratuite, lot A1 (maquette validée par le coach le 16/11/2026) : ce que garde un COMPTE GRATUIT, créé sans
-- achat. À exécuter une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run.
--
-- Deux tables, chacune rattachée au compte (public.comptes, créé au besoin par le serveur à la première connexion) et
-- effacée avec lui. Contrairement aux tables des acheteurs (écrites par la clé de service), le compte lit ET écrit ses
-- propres lignes : chacun ne voit et ne touche que les siennes.
--
-- profils_gratuits : l'expérience en trail et les tests de terrain (vitesse critique, test de la parole, FC au seuil 2).
--   La FC est une donnée de santé : elle n'est gardée qu'avec l'accord de la personne, daté ici (consentement_fc_le), comme
--   pour « Tes zones » des acheteurs. L'accord à la liste e-mail est à part et facultatif (liste_email_le : la date de
--   l'accord, vide sans accord) ; l'envoi vers Brevo viendra au lot A2.
-- courses_gratuites : les courses préparées (lot B). Créée maintenant, pas encore écrite.

create table public.profils_gratuits (
  compte_id uuid primary key references public.comptes (id) on delete cascade,
  experience text check (experience in ('debutant', 'intermediaire', 'confirme')),
  tests jsonb not null default '{}'::jsonb,
  consentement_fc_le timestamptz,
  liste_email_le timestamptz,
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);
comment on table public.profils_gratuits is
  'Le profil d''un compte gratuit : son expérience en trail et ses tests (jsonb : vc, parole, fc2). La FC n''est gardée '
  'qu''avec consentement_fc_le ; liste_email_le est la date de l''accord à la liste e-mail (vide : pas d''accord).';

create table public.courses_gratuites (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid not null references public.comptes (id) on delete cascade,
  nom text not null,
  course_date date,
  temps_vise_s integer check (temps_vise_s is null or temps_vise_s > 0),
  distance_km numeric(6, 2) check (distance_km is null or distance_km > 0),
  dplus_m integer check (dplus_m is null or dplus_m >= 0),
  resultat jsonb,
  strategie jsonb,
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);
create index courses_gratuites_compte on public.courses_gratuites (compte_id);
comment on table public.courses_gratuites is
  'Une course préparée dans l''app gratuite : son nom, sa date, le temps visé, la distance, le D+, le résultat de '
  'l''analyse et la stratégie (jsonb). Pour le lot B.';

alter table public.profils_gratuits enable row level security;
alter table public.courses_gratuites enable row level security;

create policy "profils_gratuits : chacun lit le sien" on public.profils_gratuits
  for select to authenticated using (compte_id = (select auth.uid()));
create policy "profils_gratuits : chacun ajoute le sien" on public.profils_gratuits
  for insert to authenticated with check (compte_id = (select auth.uid()));
create policy "profils_gratuits : chacun modifie le sien" on public.profils_gratuits
  for update to authenticated using (compte_id = (select auth.uid())) with check (compte_id = (select auth.uid()));
create policy "profils_gratuits : chacun efface le sien" on public.profils_gratuits
  for delete to authenticated using (compte_id = (select auth.uid()));

create policy "courses_gratuites : chacun lit les siennes" on public.courses_gratuites
  for select to authenticated using (compte_id = (select auth.uid()));
create policy "courses_gratuites : chacun ajoute les siennes" on public.courses_gratuites
  for insert to authenticated with check (compte_id = (select auth.uid()));
create policy "courses_gratuites : chacun modifie les siennes" on public.courses_gratuites
  for update to authenticated using (compte_id = (select auth.uid())) with check (compte_id = (select auth.uid()));
create policy "courses_gratuites : chacun efface les siennes" on public.courses_gratuites
  for delete to authenticated using (compte_id = (select auth.uid()));

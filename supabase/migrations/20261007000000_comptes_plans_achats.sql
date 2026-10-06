-- CTS — l'app : comptes, plans, achats (cadrage de l'app, CTS_APP_CADRAGE.md dans le dépôt du
-- moteur ; décisions D4 à D7 du 06/10/2026). À exécuter une fois dans le projet Supabase : SQL
-- Editor, coller ce fichier, Run (supabase/README.md).
--
-- Ce qui est stocké (D4) : le compte (l'e-mail vit dans auth.users, le nom ici), le plan en
-- données (cts_contenu.plan_en_donnees()) et son PDF, les réponses du questionnaire de la liste
-- blanche du moteur (cts_intake.CHAMPS_PERSISTES : course, niveau, charge actuelle, arrêt récent,
-- terrain, disponibilités), l'achat. JAMAIS la réponse « blessure » : elle ne quitte pas le
-- navigateur (décision du 17/09/2026, gardée par D4).
--
-- Écritures : seulement par le serveur du site, avec la clé de service (paiement confirmé,
-- suppression de compte). Le navigateur ne fait que lire, et seulement ce qui est à lui.

create table public.comptes (
  id uuid primary key references auth.users (id) on delete cascade,
  nom text not null default '',
  cree_le timestamptz not null default now()
);
comment on table public.comptes is
  'Un compte par e-mail (auth.users), créé au paiement (D6). Supprimé avec son utilisateur.';

-- L'achat survit au compte (obligation comptable de 10 ans, D4) : son lien au compte s'efface.
create table public.achats (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid references public.comptes (id) on delete set null,
  stripe_session text not null unique,
  montant_centimes integer not null check (montant_centimes >= 0),
  devise text not null default 'eur',
  paye_le timestamptz not null default now()
);
comment on table public.achats is
  'Le paiement d''un plan (D5 : l''achat du plan, app comprise). Rangé à part : un abonnement '
  'ou un module pourra s''ajouter sans refaire le paiement du plan.';

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid not null references public.comptes (id) on delete cascade,
  achat_id uuid references public.achats (id) on delete set null,
  course_nom text not null,
  course_date date not null,
  debut_plan date not null,
  schema integer not null,
  version_moteur text,
  donnees jsonb not null,
  intake jsonb not null default '{}'::jsonb,
  pdf_chemin text,
  cree_le timestamptz not null default now()
);
comment on table public.plans is
  'Un plan par course, figé à sa génération (cadrage 5.5) : donnees = plan_en_donnees(), '
  'pdf_chemin = « <compte>/<plan>.pdf » dans le rangement plans-pdf.';
create index plans_compte_course on public.plans (compte_id, course_date);

-- Chacun ne lit que ce qui est à lui ; personne n'écrit depuis le navigateur.
alter table public.comptes enable row level security;
alter table public.achats enable row level security;
alter table public.plans enable row level security;

create policy "comptes : chacun lit le sien" on public.comptes
  for select to authenticated using (id = (select auth.uid()));
create policy "achats : chacun lit les siens" on public.achats
  for select to authenticated using (compte_id = (select auth.uid()));
create policy "plans : chacun lit les siens" on public.plans
  for select to authenticated using (compte_id = (select auth.uid()));

-- Les PDF : un rangement privé, un dossier par compte.
insert into storage.buckets (id, name, public)
  values ('plans-pdf', 'plans-pdf', false)
  on conflict (id) do nothing;

create policy "pdf : chacun lit les siens" on storage.objects
  for select to authenticated
  using (bucket_id = 'plans-pdf' and (storage.foldername(name))[1] = (select auth.uid())::text);

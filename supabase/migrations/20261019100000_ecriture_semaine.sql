-- CTS — les séances dans Nolio, semaine par semaine (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, dernière section :
-- P1 à P4, T1 à T11, O1 à O3 ; décisions coach des 18-19/10/2026). Le moteur écrit chaque dimanche la semaine suivante
-- (moteur 8.326, cts_semaine et cts_ajustements) ; le site la range ici, l'envoie dans Nolio et garde ce qu'il faut
-- pour écrire la suivante. À exécuter une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run.
--
-- plans : un plan qui porte des paramètres s'écrit semaine par semaine (sans eux, l'ancien envoi en entier, T11) ;
-- l'état de l'écriture d'une semaine à l'autre ; pour un acheteur, son athlète Nolio et où en est son invitation
-- (P1 à P4), l'adresse Nolio qu'il a donnée (effacée une fois l'invitation partie) et son accord de lecture (T5).

alter table public.plans
  add column parametres jsonb,
  add column etat_ecriture jsonb,
  add column nolio_athlete_id text,
  add column nolio_statut text check (nolio_statut in ('a_inviter', 'en_cours', 'invite', 'actif', 'refuse', 'sorti')),
  add column nolio_email text,
  add column accord_lecture_le timestamptz,
  add column coach_id uuid references public.comptes (id) on delete set null,
  -- Le départ dans Nolio (trame, questionnaires, première semaine), posé une seule fois même si deux appels arrivent
  -- ensemble (le webhook de Nolio et le retour de paiement).
  add column demarre_le timestamptz,
  -- La trame (moteur, /v1/trame), gardée pour « Mon plan » et les graphiques ; effacée quand les paramètres changent.
  add column trame jsonb;
comment on column public.plans.parametres is
  'Paramètres de la réécriture semaine par semaine (cts_semaine) : réponses sans nom ni e-mail, jour de la commande, '
  'valeurs de la trace, courses secondaires. Null : un plan envoyé en entier (avant le 19/10/2026).';
comment on column public.plans.accord_lecture_le is
  'Accord de l''acheteur pour que l''app lise dans Nolio son RPE, son ressenti et son Hooper (T5) ; null sans accord.';

-- Les semaines écrites : ce qui est parti dans Nolio (la semaine sous la forme de l'app, versions EF comprises, pour la
-- fatigue en cours de semaine et le veto), les notes, ce que les règles ont décidé (journal, pour corriger les seuils)
-- et si le coach a annulé les ajustements.
create table public.semaines_ecrites (
  plan_id uuid not null references public.plans (id) on delete cascade,
  numero text not null,
  donnees jsonb not null,
  notes jsonb not null default '[]'::jsonb,
  journal jsonb not null default '[]'::jsonb,
  bilan text,
  sans_ajustement boolean not null default false,
  etat_avant jsonb,
  -- Ce qui a été fait cette semaine-là (moteur 8.327), rangé le dimanche suivant : la jauge et les graphiques.
  realise jsonb,
  ecrite_le timestamptz not null default now(),
  primary key (plan_id, numero)
);
comment on table public.semaines_ecrites is
  'Une semaine écrite par le moteur et envoyée dans Nolio (écriture semaine par semaine, 19/10/2026).';

alter table public.semaines_ecrites enable row level security;
create policy "semaines_ecrites : chacun lit celles de ses plans" on public.semaines_ecrites
  for select to authenticated using (
    exists (select 1 from public.plans p where p.id = plan_id and p.compte_id = (select auth.uid())));

-- Les tests lus dans Nolio (TN3, TN4, décisions coach du 19/10/2026) : chaque test écrit une seule fois lu ; ce qui en
-- est sorti (la valeur, ou pourquoi elle n'a pas pu se lire), pour le coach et pour corriger les garde-fous.
create table public.tests_lus (
  plan_id uuid not null references public.plans (id) on delete cascade,
  jour_id text not null,
  cle text not null check (cle in ('parole', 'vitesse_critique', 'fc_seuil2')),
  statut text not null check (statut in ('lu', 'illisible', 'sans_reponse', 'non_fait')),
  resultat jsonb not null default '{}'::jsonb,
  lu_le timestamptz not null default now(),
  primary key (plan_id, jour_id)
);
alter table public.tests_lus enable row level security;

-- Les athlètes coachés invités dans l'app (T6) : leur compte, relié à leur fiche.
alter table public.athletes_coaches add column compte_id uuid references public.comptes (id) on delete set null;

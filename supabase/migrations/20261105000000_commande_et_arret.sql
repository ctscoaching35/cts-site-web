-- CTS — la confirmation de commande, l'incident d'achat signalé, la préparation arrêtée (audits du 05/11/2026, lot 1 ;
-- décisions coach du 05/11/2026).
--
-- 1. La confirmation de commande (J1, art. L221-13 du code de la consommation) : l'e-mail de bienvenue porte la commande
-- (formule, prix payé, dates, vendeur, conditions de vente, formulaire de rétractation). Sa date d'envoi se garde ici ;
-- un envoi qui échoue (Brevo) est refait par le passage quotidien tant qu'elle manque, 14 jours au plus. Les plans déjà
-- rangés sont marqués envoyés à leur création : rien n'est renvoyé aux acheteurs d'avant.
--
-- 2. Payé mais pas rangé (E2) : le coach est prévenu au premier échec du rangement d'un achat (le retour du paiement et
-- le webhook de Stripe le retentent tous les deux) ; une ligne par session de paiement, pour qu'il ne le soit qu'une fois.
--
-- 3. La préparation arrêtée (E3) : « Arrêter cette préparation (remboursée) » dans Chiffres › Plans ; plus d'invitation,
-- plus de dimanche, sortie de l'équipe Nolio. Le remboursement reste fait dans Stripe.
--
-- À exécuter une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run. Sans lui, rien ne casse : la
-- confirmation part comme avant avec l'achat, sans renvoi ; le coach peut être prévenu plusieurs fois d'un même achat
-- non rangé ; l'arrêt d'une préparation marche, mais l'app de l'acheteur le dit comme une sortie de l'équipe.

begin;

alter table public.plans add column if not exists bienvenue_envoyee_le timestamptz;
update public.plans set bienvenue_envoyee_le = cree_le where bienvenue_envoyee_le is null;
comment on column public.plans.bienvenue_envoyee_le is
  'L''e-mail de bienvenue et de confirmation de commande parti (J1) ; null : à renvoyer par le passage quotidien, '
  '14 jours au plus après l''achat (lib/app/rangement.ts, renvoyerLesConfirmations).';

alter table public.plans add column if not exists arretee_le timestamptz;
comment on column public.plans.arretee_le is
  'La préparation arrêtée par le coach (E3 : remboursée) ; nolio_statut passe à « sorti » ; null sinon.';

create table if not exists public.achats_incidents (
  stripe_session text primary key,
  signale_le timestamptz not null default now()
);
comment on table public.achats_incidents is
  'Un achat payé que le site n''a pas pu ranger, signalé au coach une fois (E2, lib/app/rangement.ts). Ni nom ni e-mail.';
alter table public.achats_incidents enable row level security;

commit;

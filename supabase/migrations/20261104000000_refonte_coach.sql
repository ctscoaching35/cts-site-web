-- CTS — la refonte de l'espace coach par exception (audit de l'app coach du 03/11/2026 ; décisions coach du 04/11/2026).
--
-- 1. Les signaux de la semaine gardés (EC2, audit de l'app coach du 03/11/2026 ; décision coach du 04/11/2026, « A ») :
-- calculés chaque soir par le passage quotidien, avec ce qu'il lit déjà dans Nolio pour la fatigue du jour, sans appel
-- de plus. Les drapeaux seulement — « commentaire à lire » (pas son texte), « RPE 8 pour 6 prévu », « sensations 2/5 »,
-- « Hooper 16 pour 11 », le jour de la dernière activité — jamais le contenu d'une séance ni le texte d'un commentaire.
-- Une ligne par athlète, remplacée chaque soir ; elle s'efface avec son accord de lecture.
--
-- 2. Les corrections d'une semaine avant son envoi (EC3, « A ») : sur l'aperçu, le coach choisit « semaine allégée »,
-- « sans qualité », « sortie longue plus courte » ou « décaler la qualité », et pourquoi ; le passage du dimanche les
-- envoie au moteur, puis les marque appliquées : elles se comptent dans « Chiffres ». Une par objectif et par semaine.
--
-- À exécuter une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run. Sans lui, l'espace coach marche
-- comme avant : l'accueil « Cette semaine » affiche ce qui vient de la base sans les signaux du Suivi, et le dit ; les
-- corrections avant l'envoi ne s'enregistrent pas.

begin;

create table if not exists public.signaux_suivi (
  coach_id uuid not null references public.comptes (id) on delete cascade,
  nolio_athlete_id text not null,
  calcule_le timestamptz not null default now(),
  prevues integer not null default 0,
  faites integer not null default 0,
  -- { valeur, jour, moyenne } ou null.
  hooper jsonb,
  -- [{ genre, jour, detail }] : manquee, plus_dur, sensations, hooper, commentaire.
  signaux jsonb not null default '[]'::jsonb,
  derniere_activite date,
  primary key (coach_id, nolio_athlete_id)
);
alter table public.signaux_suivi enable row level security;
comment on table public.signaux_suivi is
  'Les drapeaux de la semaine de chaque athlète coaché (EC2), calculés chaque soir : jamais le contenu d''une séance ni le texte d''un commentaire.';

create table if not exists public.corrections_semaine (
  plan_id uuid not null references public.plans (id) on delete cascade,
  lundi date not null,
  coach_id uuid not null references public.comptes (id) on delete cascade,
  -- semaine_allegee, sans_qualite, sl_courte, decaler_qualite.
  corrections text[] not null,
  -- etat, info, placement, dose, facon (lib/app/corrections.ts, RAISONS).
  raison text,
  choisi_le timestamptz not null default now(),
  appliquee_le timestamptz,
  -- Celles qui ont changé la semaine, d'après le journal du moteur (« correction du coach », applique) : ce qui se compte.
  appliquees text[],
  primary key (plan_id, lundi)
);
alter table public.corrections_semaine enable row level security;
comment on table public.corrections_semaine is
  'Les corrections qu''un coach choisit sur l''aperçu d''une semaine (EC3), envoyées au moteur par le passage du dimanche.';

commit;

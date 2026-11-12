-- CTS — les anciens athlètes (lot 2 de l'app, décision A du coach du 12/11/2026) : l'équipe Nolio synchronisée avec l'app
-- coach. À chaque ouverture de l'app coach (lib/app/espaceCoach.ts, synchroniserLEquipe ; la règle, lib/app/anciens.ts),
-- une fiche dont l'athlète n'est plus dans l'équipe Nolio passe dans « Anciens athlètes » : hors de la liste principale,
-- plus aucune écriture du moteur pour lui (lib/app/ecriture.ts, plansALaMain ; les questionnaires du dimanche, la saison de
-- fond, les zones), son historique gardé. Revenu dans l'équipe, sa fiche revient d'elle-même (ancien_le effacé). On ne
-- touche à personne quand Nolio ne répond pas, renvoie une erreur ou rend une équipe vide.
--
-- ancien_le : le moment où l'app coach l'a vu hors de l'équipe ; null : dans l'équipe.
--
-- en_attente_profil (réponse du coach du 12/11/2026) : une fiche créée d'elle-même pour un nouveau de l'équipe, par le
-- compte du coach qui tient la clé Nolio seulement, reste programmée à la main (ni questionnaire du samedi, ni Hooper,
-- ni saison de fond tentée) tant que le coach n'a pas rempli son profil ou créé son premier objectif ; ensuite, la
-- programmation automatique, le chemin habituel. Un choix de programmation du coach l'efface aussi.
--
-- Les fiches créées d'elles-mêmes pour les nouveaux de l'équipe : une seule par athlète et par coach. L'index unique qui
-- l'assure n'est posé que si aucune fiche n'est déjà en double (sinon, rien ne change, et le reste de la migration passe).
--
-- À exécuter une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run. Avant de pousser le site qui s'en sert.
-- Sans lui, rien ne casse : personne ne passe dans « Anciens athlètes » (« Urgent » dit toujours « n'est plus dans ton
-- équipe Nolio : retire-le de l'app »), et aucune fiche ne se crée d'elle-même (« Créer sa fiche » reste, comme avant).

begin;

alter table public.athletes_coaches add column if not exists ancien_le timestamptz;
comment on column public.athletes_coaches.ancien_le is
  'Sorti de l''équipe Nolio : le moment où l''app coach l''a vu (« Anciens athlètes ») ; null dans l''équipe. Le moteur n''écrit plus rien pour lui.';

alter table public.athletes_coaches add column if not exists en_attente_profil boolean not null default false;
comment on column public.athletes_coaches.en_attente_profil is
  'Fiche créée d''elle-même depuis l''équipe Nolio : programmée à la main tant que son profil n''est pas rempli.';

do $$
begin
  if not exists (
    select 1 from public.athletes_coaches where nolio_athlete_id is not null
    group by coach_id, nolio_athlete_id having count(*) > 1
  ) then
    create unique index if not exists athletes_coaches_une_fiche_par_athlete
      on public.athletes_coaches (coach_id, nolio_athlete_id) where nolio_athlete_id is not null;
  end if;
end $$;

commit;

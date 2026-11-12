-- CTS — les anciens athlètes (lot 2 de l'app, décision A du coach du 12/11/2026) : l'équipe Nolio synchronisée avec l'app
-- coach. À chaque ouverture de l'app coach (lib/app/espaceCoach.ts, synchroniserLEquipe ; la règle, lib/app/anciens.ts),
-- une fiche dont l'athlète n'est plus dans l'équipe Nolio passe dans « Anciens athlètes » : hors de la liste principale,
-- plus aucune écriture du moteur pour lui (lib/app/ecriture.ts, plansALaMain ; les questionnaires du dimanche, la saison de
-- fond, les zones), son historique gardé. Revenu dans l'équipe, sa fiche revient d'elle-même (ancien_le effacé). On ne
-- touche à personne quand Nolio ne répond pas, renvoie une erreur ou rend une équipe vide.
--
-- ancien_le : le moment où l'app coach l'a vu hors de l'équipe ; null : dans l'équipe.
--
-- Les fiches créées d'elles-mêmes pour les nouveaux de l'équipe : une seule par athlète et par coach. L'index unique qui
-- l'assure n'est posé que si aucune fiche n'est déjà en double (sinon, rien ne change, et le reste de la migration passe).
--
-- À exécuter une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run. Avant de pousser le site qui s'en sert.
-- Sans lui, rien ne casse : personne ne passe dans « Anciens athlètes » (« Urgent » dit toujours « n'est plus dans ton
-- équipe Nolio : retire-le de l'app »), et les fiches des nouveaux de l'équipe se créent quand même.

begin;

alter table public.athletes_coaches add column if not exists ancien_le timestamptz;
comment on column public.athletes_coaches.ancien_le is
  'Sorti de l''équipe Nolio : le moment où l''app coach l''a vu (« Anciens athlètes ») ; null dans l''équipe. Le moteur n''écrit plus rien pour lui.';

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

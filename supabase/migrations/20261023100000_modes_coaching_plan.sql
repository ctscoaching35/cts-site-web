-- CTS — le mode de chaque athlète, coaching ou plan (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur ; décision coach du
-- 23/10/2026, « bien voir si la personne est en mode coaching ou plan, et le changer avec un bouton »). À exécuter une
-- fois dans le projet Supabase : SQL Editor, coller ce fichier, Run. Avant de pousser le site qui s'en sert.
--
-- mode, sur sa fiche : « coaching » (ses objectifs de coaching s'écrivent, son app est celle d'un coaché) ou « plan »
-- (sa fiche reste pour l'historique ; rien ne s'y écrit, son app est celle d'un acheteur). mode_le : le dernier
-- changement, pour reconnaître un plan acheté pendant son coaching.
--
-- nolio_statut « coaching », sur un plan acheté : il ne s'écrit pas, parce que l'athlète est en coaching (passé en
-- coaching, ou acheté pendant son coaching : il attend le bouton du coach).

begin;

alter table public.athletes_coaches add column if not exists mode text not null default 'coaching'
  check (mode in ('coaching', 'plan'));
alter table public.athletes_coaches add column if not exists mode_le timestamptz not null default now();
comment on column public.athletes_coaches.mode is
  'coaching : ses objectifs de coaching s''écrivent ; plan : sa fiche reste, rien ne s''y écrit, son app est celle d''un acheteur.';

-- La règle d'avant sur nolio_statut, quel que soit son nom.
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.plans'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%nolio_statut%' loop
    execute format('alter table public.plans drop constraint %I', c);
  end loop;
end $$;
alter table public.plans add constraint plans_nolio_statut_check
  check (nolio_statut in ('a_inviter', 'en_cours', 'invite', 'actif', 'refuse', 'sorti', 'coaching'));

commit;

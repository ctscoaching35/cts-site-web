-- CTS — la mesure du tunnel de vente (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, L4, décision coach du
-- 13/10/2026) : des compteurs par jour et par étape, sans aucune donnée personnelle (ni cookie, ni adresse, ni
-- identifiant) — la page des plans vue, le questionnaire commencé, le récapitulatif atteint, le paiement lancé.
-- Les achats se comptent dans la table achats. À exécuter une fois dans le projet Supabase : SQL Editor, coller
-- ce fichier, Run.

create table public.mesures (
  jour date not null default current_date,
  etape text not null check (etape in ('offre', 'questionnaire', 'recap', 'paiement')),
  n integer not null default 0,
  primary key (jour, etape)
);
comment on table public.mesures is
  'Compteurs anonymes du tunnel de vente, par jour et par étape (L4). Clé de service seulement.';

alter table public.mesures enable row level security;

-- +1, d'un seul coup (deux visites au même instant ne s'écrasent pas).
create or replace function public.compter_mesure(e text) returns void
language sql security definer set search_path = public as $$
  insert into public.mesures (jour, etape, n) values (current_date, e, 1)
  on conflict (jour, etape) do update set n = public.mesures.n + 1;
$$;
revoke all on function public.compter_mesure(text) from public, anon, authenticated;

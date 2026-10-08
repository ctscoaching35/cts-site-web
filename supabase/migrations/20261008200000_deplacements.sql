-- CTS — déplacer une séance dans la semaine (cadrage de l'app §7.2, décisions coach E1 à E6 du
-- 08/10/2026) : l'athlète échange deux jours de la même semaine. À exécuter une fois dans le projet
-- Supabase : SQL Editor, coller ce fichier, Run.
--
-- Une ligne par séance qui n'est plus à son jour prévu : où elle est rangée maintenant. Le plan
-- lui-même ne change pas (5.5) ; « Remettre la semaine comme prévue » efface les lignes de la
-- semaine. C'est l'organisation de la semaine, pas une donnée de santé : pas de consentement. Tout
-- part avec le plan ou le compte.
--
-- Écritures : seulement par le serveur du site (clé de service), après avoir vérifié la session ;
-- le navigateur ne fait que lire ce qui est à lui.

create table public.deplacements (
  plan_id uuid not null references public.plans (id) on delete cascade,
  jour_id text not null,
  compte_id uuid not null references public.comptes (id) on delete cascade,
  date_iso date not null,
  maj_le timestamptz not null default now(),
  primary key (plan_id, jour_id)
);
comment on table public.deplacements is
  'Une séance rangée ailleurs qu''à son jour prévu (jour_id : l''identifiant stable du plan, « S9-jeudi »), dans sa semaine (E2).';

alter table public.deplacements enable row level security;
create policy "deplacements : chacun lit les siens" on public.deplacements
  for select to authenticated using (compte_id = (select auth.uid()));

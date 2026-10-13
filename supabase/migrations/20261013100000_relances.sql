-- CTS — la relance d'un questionnaire commencé sans paiement (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, L3,
-- décision coach du 13/10/2026) : une seule, le lendemain, seulement pour qui l'a demandée (case décochée au départ,
-- sous le champ e-mail). Seuls l'e-mail et la date de l'accord sont gardés ; la ligne s'efface à l'achat, et 30
-- jours après l'accord. À exécuter une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run.

create table public.relances (
  email text primary key,
  accord_le timestamptz not null default now(),
  envoyee_le timestamptz
);
comment on table public.relances is
  'Les rappels demandés au questionnaire (L3) : l''e-mail, la date de l''accord, celle de l''envoi. Clé de service seulement.';

alter table public.relances enable row level security;

-- CTS — la dernière activité de chaque compte (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, E7, décision coach du
-- 15/10/2026) : un compte sans activité depuis 3 ans est supprimé, après un e-mail d'avertissement 30 jours avant. La
-- « dernière connexion » de Supabase (last_sign_in_at) ne bouge qu'à une connexion par code : l'app restée ouverte sur
-- le téléphone rafraîchit sa session sans se reconnecter, et un athlète fidèle passerait pour inactif. Cette fonction
-- rend, pour chaque compte, la date la plus récente de ses sessions et de leurs rafraîchissements. Lue par le seul
-- serveur (clé de service), jamais par le navigateur. À exécuter une fois dans le projet Supabase : SQL Editor, coller
-- ce fichier, Run.

create or replace function public.derniere_activite()
returns table (compte_id uuid, vu_le timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.compte_id, max(a.vu_le)
  from (
    select s.user_id as compte_id, greatest(s.created_at, s.updated_at) as vu_le
    from auth.sessions s
    union all
    select r.user_id::uuid, greatest(r.created_at, r.updated_at)
    from auth.refresh_tokens r
    where r.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) a
  group by a.compte_id;
$$;

comment on function public.derniere_activite() is
  'La dernière activité de chaque compte (sessions et rafraîchissements), pour la suppression des comptes inactifs (E7).';

revoke all on function public.derniere_activite() from public, anon, authenticated;
grant execute on function public.derniere_activite() to service_role;

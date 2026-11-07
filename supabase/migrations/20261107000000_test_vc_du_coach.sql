-- CTS — le test de vitesse critique saisi par le coach, quelles que soient ses valeurs (décision coach du 07/11/2026 :
-- « Je devrais pouvoir rentrer le test avec n'importe quelle valeur »).
--
-- La fiche d'un coaché bornait sa vitesse critique (1,5 à 7,5 m/s) et sa D′ (20 à 600 m) : un test saisi par le coach
-- hors de ces bornes (un 3 min pas couru à fond donne une D′ sous 20 m) ne s'enregistrait pas. La saisie du coach
-- (lib/app/zones.ts, vitesseCritiqueCoach) ne refuse plus que ce qui ne se calcule pas, avec une ligne d'avertissement
-- quand le test sort des bornes habituelles ; la base garde seulement des valeurs positives. La saisie de l'athlète et la
-- lecture automatique dans Nolio gardent leurs bornes (2 à 7 m/s, 20 à 600 m), dans le code.
--
-- À exécuter une fois dans le projet Supabase : SQL Editor, coller ce fichier, Run. Sans lui, rien ne casse : le test
-- saisi par le coach s'enregistre tant qu'il tient dans les anciennes bornes (le cas du 07/11, D′ de 29 m, oui) ; hors
-- d'elles, la fiche répond « la migration du 07/11/2026 est-elle passée ? ».

begin;

-- Les contrôles d'avant sur ces deux colonnes, quel que soit leur nom.
do $$
declare c record;
begin
  for c in select distinct con.conname from pg_constraint con
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
      where con.conrelid = 'public.athletes_coaches'::regclass and con.contype = 'c' and a.attname in ('vc_ms', 'd_prime_m')
  loop
    execute format('alter table public.athletes_coaches drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.athletes_coaches add constraint athletes_coaches_vc_ms_check check (vc_ms > 0);
alter table public.athletes_coaches add constraint athletes_coaches_d_prime_m_check check (d_prime_m > 0);

commit;

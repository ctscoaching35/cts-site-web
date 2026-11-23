/**
 * Les dossiers de course gardés par un compte (table courses_gratuites, lot B), lus avec SA session : les règles de la base
 * ne lui montrent que les siens. Sans la table (migration pas encore collée), la liste est vide. Lisibles par un compte
 * gratuit comme par un acheteur ou un coaché qui en avait fait avant d'acheter (décision du coach du 16/11/2026).
 */
import { clientServeur } from './supabase';
import { dossierSur, lireClasse, type Classe, type Dossier } from './courseLibre';
import { lireStrategie, type Strategie } from './strategiePure';

export type LigneDossier = { id: string; nom: string; date: string | null; distance_km: number | null; dplus_m: number | null; classe: Classe | null; cree_le: string };

const COLONNES = 'id, nom, course_date, distance_km, dplus_m, resultat, strategie, cree_le';
type Brute = { id: string; nom: string; course_date: string | null; distance_km: number | string | null; dplus_m: number | null;
  resultat: unknown; strategie: unknown; cree_le: string };


// Le plus proche d'abord : les courses à venir par date croissante, puis les passées, puis celles sans date.
export function ordreDesDossiers(lignes: LigneDossier[], jour: string): LigneDossier[] {
  const rang = (l: LigneDossier) => (l.date && l.date >= jour ? 0 : l.date ? 1 : 2);
  return [...lignes].sort((a, b) => rang(a) - rang(b)
    || (rang(a) === 1 ? (b.date ?? '').localeCompare(a.date ?? '') : (a.date ?? '').localeCompare(b.date ?? '')));
}

export async function dossiersDuCompte(compteId: string): Promise<LigneDossier[]> {
  // Seulement de quoi dresser la liste : la réponse du moteur (lourde) ne se lit qu'à l'ouverture d'un dossier.
  const { data, error } = await (await clientServeur()).from('courses_gratuites')
    .select('id, nom, course_date, distance_km, dplus_m, cree_le, classe:resultat->reponse->course->>classe').eq('compte_id', compteId);
  if (error) {
    console.error('Dossiers de course illisibles :', error.message);
    return [];
  }
  const jour = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  return ordreDesDossiers(((data ?? []) as unknown as (Omit<Brute, 'resultat' | 'strategie'> & { classe: unknown })[]).map((l) => ({
    id: l.id, nom: l.nom, date: l.course_date, distance_km: l.distance_km == null ? null : Number(l.distance_km), dplus_m: l.dplus_m,
    classe: lireClasse(l.classe), cree_le: l.cree_le,
  })), jour);
}

// Combien de dossiers a le compte (l'accueil de l'app payante : le lien « Tes dossiers de course › »). 0 sans la table.
export async function nombreDeDossiers(compteId: string): Promise<number> {
  const { count, error } = await (await clientServeur()).from('courses_gratuites').select('id', { count: 'exact', head: true }).eq('compte_id', compteId);
  return error ? 0 : (count ?? 0);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function dossierDuCompte(compteId: string, id: string): Promise<Dossier | null> {
  if (!UUID.test(id)) return null;
  const { data } = await (await clientServeur()).from('courses_gratuites').select(COLONNES).eq('compte_id', compteId).eq('id', id).maybeSingle();
  if (!data) return null;
  const l = data as Brute;
  const lu = dossierSur(l.resultat);
  if (!lu) return null;
  const s = lireStrategie(l.strategie);
  const le = (l.strategie as { le?: unknown } | null)?.le;
  const strategie: Strategie | null = s ? { ...s, le: typeof le === 'string' ? le : '' } : null;
  return { id: l.id, ...lu, strategie, cree_le: l.cree_le };
}

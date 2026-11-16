'use server';
/**
 * Les actions du dossier de course (app gratuite, lot B) : garder un dossier, le supprimer, garder ou effacer sa stratégie
 * de nutrition. Les lignes s'écrivent avec la session du compte (les règles de la base : chacun ne touche que les siennes).
 * Garder et modifier : un compte gratuit seulement ; supprimer : aussi un acheteur ou un coaché qui en avait fait avant
 * d'acheter (décision du coach du 16/11/2026 : ses dossiers restent lisibles et supprimables).
 */
import { revalidatePath } from 'next/cache';
import { lireAcces } from './acces';
import { majListeSiInscrit } from './listeGratuit';
import { rangerDossier } from './rangerDossier';
import { lireStrategie } from './strategiePure';
import { clientServeur } from './supabase';

export type EtatDossier = { ok: boolean; message: string };
const SESSION_EXPIREE = 'Ta session a expiré : reconnecte-toi.';
const aujourdhui = () => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function enregistrerDossier(entree: unknown): Promise<EtatDossier & { id?: string }> {
  const acces = await lireAcces();
  if (acces.cas !== 'gratuit' || !acces.compteId) return { ok: false, message: SESSION_EXPIREE };
  try {
    const r = await rangerDossier(acces.compteId, acces.email, entree);
    if (!r.ok) return r;
    revalidatePath('/app/courses');
    return { ok: true, message: '', id: r.id };
  } catch (e) {
    console.error('Garder le dossier de course :', e instanceof Error ? e.message : e);
    return { ok: false, message: 'L’enregistrement n’a pas abouti. Réessaie dans un moment.' };
  }
}

export async function supprimerDossier(id: string): Promise<EtatDossier> {
  const acces = await lireAcces();
  if (acces.mode === 'coupe' || !acces.compteId || !UUID.test(String(id))) return { ok: false, message: SESSION_EXPIREE };
  const { error } = await (await clientServeur()).from('courses_gratuites').delete().eq('id', id).eq('compte_id', acces.compteId);
  if (error) {
    console.error('Supprimer le dossier de course :', error.message);
    return { ok: false, message: 'La suppression n’a pas abouti. Réessaie dans un moment.' };
  }
  // Sa prochaine course a pu changer.
  if (acces.cas === 'gratuit' && acces.email) await majListeSiInscrit(acces.compteId, acces.email);
  revalidatePath('/app', 'layout');
  return { ok: true, message: '' };
}

export async function garderStrategieDossier(id: string, donnees: unknown): Promise<EtatDossier> {
  const acces = await lireAcces();
  if (acces.cas !== 'gratuit' || !acces.compteId || !UUID.test(String(id))) return { ok: false, message: SESSION_EXPIREE };
  const s = lireStrategie(donnees);
  if (!s) return { ok: false, message: 'Indique au moins la durée de ta course pour garder ta stratégie.' };
  const { error } = await (await clientServeur()).from('courses_gratuites')
    .update({ strategie: { ...s, le: aujourdhui() }, maj_le: new Date().toISOString() }).eq('id', id).eq('compte_id', acces.compteId);
  if (error) {
    console.error('Stratégie du dossier de course :', error.message);
    return { ok: false, message: 'L’enregistrement n’a pas abouti. Réessaie dans un moment.' };
  }
  revalidatePath('/app/courses', 'layout');
  return { ok: true, message: 'Ta stratégie est gardée.' };
}

export async function effacerStrategieDossier(id: string): Promise<EtatDossier> {
  const acces = await lireAcces();
  if (acces.cas !== 'gratuit' || !acces.compteId || !UUID.test(String(id))) return { ok: false, message: SESSION_EXPIREE };
  const { error } = await (await clientServeur()).from('courses_gratuites')
    .update({ strategie: null, maj_le: new Date().toISOString() }).eq('id', id).eq('compte_id', acces.compteId);
  if (error) return { ok: false, message: 'Ça n’a pas abouti. Réessaie dans un moment.' };
  revalidatePath('/app/courses', 'layout');
  return { ok: true, message: '' };
}

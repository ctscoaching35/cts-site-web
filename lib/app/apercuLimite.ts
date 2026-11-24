/**
 * LA LIMITE DE L'APERÇU (contrat de POST /v1/apercu, 16/11/2026) : au plus 10 aperçus par visiteur et par heure, comptés
 * côté serveur (Vercel n'a pas de mémoire entre deux appels) dans la table apercus_appels (migration
 * 20261116130000_apercus.sql). Le visiteur est une empreinte HMAC de son adresse IP avec un secret du serveur : jamais l'IP
 * en clair. Sans la table (migration pas collée) ou sans base, l'aperçu passe quand même, avec un console.warn.
 */
import { createHmac } from 'node:crypto';
import { adresseIp } from '@/lib/app/porteRelance';
import { clientService } from '@/lib/app/supabase';
import { FENETRE_LIMITE_MS, LIMITE_APERCUS } from '@/lib/apercu';

export function empreinteVisiteur(ip: string, secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', porte = 'apercu'): string {
  return createHmac('sha256', secret).update(`${porte}:${ip}`).digest('base64url').slice(0, 32);
}

/** Compte cet appel ; faux seulement quand le visiteur a déjà fait ses 10 aperçus de l'heure. */
export function apercuPermis(entetes: Headers, maintenant: Date = new Date()): Promise<boolean> {
  return permis(entetes, 'apercu', maintenant);
}

/**
 * La route des prérequis d'un plan (entrée 234, app/plan/prerequis/route.ts) : la même limite, dans la même table, 10 appels par visiteur et par heure, mais comptés à part de ceux de l'aperçu (une empreinte
 * d'une autre « porte » : un récapitulatif fait un appel de chacun, ils ne se mangent pas). Sans la table, l'appel passe, avec un console.warn.
 */
export function prerequisPermis(entetes: Headers, maintenant: Date = new Date()): Promise<boolean> {
  return permis(entetes, 'prerequis', maintenant);
}

async function permis(entetes: Headers, porte: string, maintenant: Date): Promise<boolean> {
  try {
    const service = clientService();
    const empreinte = empreinteVisiteur(adresseIp(entetes), undefined, porte);
    const limite = new Date(maintenant.getTime() - FENETRE_LIMITE_MS).toISOString();
    // La table se purge au passage : au-delà d'une heure, plus rien ne sert.
    const purge = await service.from('apercus_appels').delete().lt('appele_le', limite);
    if (purge.error) throw new Error(purge.error.message);
    const { count, error } = await service.from('apercus_appels').select('id', { count: 'exact', head: true }).eq('empreinte', empreinte).gte('appele_le', limite);
    if (error) throw new Error(error.message);
    if ((count ?? 0) >= LIMITE_APERCUS) return false;
    const ajout = await service.from('apercus_appels').insert({ empreinte, appele_le: maintenant.toISOString() });
    if (ajout.error) throw new Error(ajout.error.message);
    return true;
  } catch (e) {
    console.warn(`Limite des ${porte === 'apercu' ? 'aperçus' : 'prérequis'} non appliquée (table apercus_appels absente ou base muette) :`, e instanceof Error ? e.message : e);
    return true;
  }
}

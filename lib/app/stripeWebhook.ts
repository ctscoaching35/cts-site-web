/**
 * Le webhook de Stripe (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, 13/10/2026) : sans lui, le plan ne se
 * rangeait qu'au retour sur /plan/merci, et un acheteur qui fermait la page avant payait sans recevoir son plan.
 * Stripe signe chaque appel avec le secret du point d'arrivée (STRIPE_WEBHOOK_SECRET, saisi par le coach dans
 * Vercel) : https://docs.stripe.com/webhooks#verify-manually.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

// La tolérance de Stripe : un appel signé il y a plus de 5 minutes est un rejeu.
const TOLERANCE_S = 300;

export function signatureValide(corps: string, entete: string | null, secret: string, maintenantMs = Date.now()): boolean {
  if (!entete || !secret) return false;
  const paires = entete.split(',').map((x) => x.trim().split('='));
  const horodatage = paires.find(([cle]) => cle === 't')?.[1];
  const signatures = paires.filter(([cle]) => cle === 'v1').map(([, valeur]) => valeur ?? '');
  if (!horodatage || !signatures.length || !(Math.abs(maintenantMs / 1000 - Number(horodatage)) <= TOLERANCE_S)) return false;
  const attendue = Buffer.from(createHmac('sha256', secret).update(`${horodatage}.${corps}`).digest('hex'));
  return signatures.some((s) => s.length === attendue.length && timingSafeEqual(Buffer.from(s), attendue));
}

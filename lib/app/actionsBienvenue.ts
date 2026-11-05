'use server';
/**
 * L'écran de bienvenue (cadrage, 2.6) : lu une fois par appareil, avant d'entrer dans le plan.
 * Un cookie le retient sur l'appareil — une app installée sur iPhone, qui a ses propres cookies,
 * le montre une fois de plus, avec ses consignes à elle.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_BIENVENUE, COOKIE_DEMARRAGE } from './bienvenue';
import { demonstrationOuverte } from './demonstrationPorte';

// La démonstration (développement seulement) ne pose aucun cookie : la bienvenue et « Pour bien démarrer » s'y disent
// par l'adresse (lib/app/demonstrationPorte.ts). Avant, elle posait les vrais, qui masquaient « Pour bien démarrer »
// pour toutes les vues suivantes du même navigateur, tous ports confondus (audit du 05/11/2026).
export async function entrerDansLePlan(retour: string) {
  if (!demonstrationOuverte()) (await cookies()).set(COOKIE_BIENVENUE, '1', { path: '/', maxAge: 395 * 24 * 60 * 60, sameSite: 'lax' });
  redirect(retour.startsWith('/app') ? retour : '/app');
}

// « Pour bien démarrer » masquée sur cet appareil : d'un appui, ou d'elle-même une fois tout en place.
export async function masquerDemarrage() {
  if (demonstrationOuverte()) return;
  (await cookies()).set(COOKIE_DEMARRAGE, '1', { path: '/', maxAge: 395 * 24 * 60 * 60, sameSite: 'lax' });
}

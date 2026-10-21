'use server';
/**
 * L'écran de bienvenue (cadrage, 2.6) : lu une fois par appareil, avant d'entrer dans le plan.
 * Un cookie le retient sur l'appareil — une app installée sur iPhone, qui a ses propres cookies,
 * le montre une fois de plus, avec ses consignes à elle.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_BIENVENUE, COOKIE_DEMARRAGE } from './bienvenue';

export async function entrerDansLePlan(retour: string) {
  (await cookies()).set(COOKIE_BIENVENUE, '1', { path: '/', maxAge: 400 * 24 * 60 * 60, sameSite: 'lax' });
  redirect(retour.startsWith('/app') ? retour : '/app');
}

// « Pour bien démarrer » masquée sur cet appareil : d'un appui, ou d'elle-même une fois tout en place.
export async function masquerDemarrage() {
  (await cookies()).set(COOKIE_DEMARRAGE, '1', { path: '/', maxAge: 400 * 24 * 60 * 60, sameSite: 'lax' });
}

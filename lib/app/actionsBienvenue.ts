'use server';
/**
 * L'écran de bienvenue (cadrage, 2.6) : lu une fois par appareil, avant d'entrer dans le plan.
 * Un cookie le retient sur l'appareil — une app installée sur iPhone, qui a ses propres cookies,
 * le montre une fois de plus, avec ses consignes à elle.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_BIENVENUE, COOKIE_DEMARRAGE, COOKIE_MONTRE, plansMasques } from './bienvenue';
import { demonstrationOuverte } from './demonstrationPorte';

// La démonstration (développement seulement) ne pose aucun cookie : la bienvenue et « Pour bien démarrer » s'y disent
// par l'adresse (lib/app/demonstrationPorte.ts). Avant, elle posait les vrais, qui masquaient « Pour bien démarrer »
// pour toutes les vues suivantes du même navigateur, tous ports confondus (audit du 05/11/2026).
export async function entrerDansLePlan(retour: string) {
  if (!demonstrationOuverte()) (await cookies()).set(COOKIE_BIENVENUE, '1', { path: '/', maxAge: 395 * 24 * 60 * 60, sameSite: 'lax' });
  redirect(retour.startsWith('/app') ? retour : '/app');
}

// « Pour bien démarrer » masquée sur cet appareil : d'un appui, ou d'elle-même une fois tout en place. C12 (audits du
// 05/11/2026) : pour ce plan seulement (avant, pour 13 mois, plans suivants compris) : le cookie garde la liste des plans
// où elle est masquée (lib/app/bienvenue.ts, demarrageMasque).
export async function masquerDemarrage(planId: string) {
  if (demonstrationOuverte() || !/^[A-Za-z0-9-]{1,64}$/.test(planId)) return;
  const jar = await cookies();
  const plans = plansMasques(jar.get(COOKIE_DEMARRAGE)?.value);
  if (!plans.includes(planId)) plans.push(planId);
  jar.set(COOKIE_DEMARRAGE, plans.slice(-20).join('.'), { path: '/', maxAge: 395 * 24 * 60 * 60, sameSite: 'lax' });
}

// « Installe l'appli Nolio et relie ta montre » cochée, ou décochée, d'un appui sur son rond (décision coach du
// 07/11/2026) : retenue sur cet appareil, pour ce plan, comme masquerDemarrage ; rien en démonstration.
export async function cocherMontre(planId: string, cochee: boolean) {
  if (demonstrationOuverte() || !/^[A-Za-z0-9-]{1,64}$/.test(planId)) return;
  const jar = await cookies();
  const plans = plansMasques(jar.get(COOKIE_MONTRE)?.value).filter((p) => p !== planId);
  if (cochee) plans.push(planId);
  jar.set(COOKIE_MONTRE, plans.slice(-20).join('.'), { path: '/', maxAge: 395 * 24 * 60 * 60, sameSite: 'lax' });
}

/**
 * L'app gratuite, côté serveur : lit l'interrupteur (lib/app/gratuitRegles.ts) et le cookie du lien secret.
 * Aucun import de contexte.ts : c'est lui qui l'appelle.
 */
import { cookies } from 'next/headers';
import { coachConnecte } from './nolio';
import { COOKIE_ESSAI, gratuitOuvertPour, modeAppGratuite } from './gratuitRegles';

// L'app gratuite est-elle ouverte pour cette visite ? Toujours faux en mode « coupe », sans rien lire.
export async function gratuitOuvert(): Promise<boolean> {
  const mode = modeAppGratuite();
  if (mode === 'coupe') return false;
  if (mode === 'ouvert') return true;
  return gratuitOuvertPour(mode, (await cookies()).get(COOKIE_ESSAI)?.value);
}

// Un compte connecté, déjà vu sans plan ni fiche de coaché, relève de l'app gratuite : l'app gratuite est ouverte pour lui
// et ce n'est pas le compte coach (qui va dans son espace).
export async function compteGratuitPossible(): Promise<boolean> {
  if (!(await gratuitOuvert())) return false;
  return !(await coachConnecte());
}

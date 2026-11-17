'use client';
/**
 * Ce que le visiteur a sous les yeux (ses tests) tient le temps de son parcours : en mémoire de l'onglet
 * (sessionStorage), jamais plus. Il sert à une chose : être gardé dans son compte quand il se connecte, dans la même
 * session. Effacé dès que le compte l'a reçu (ou qu'il n'y en a pas besoin), et à la fermeture de l'onglet. Rien d'autre
 * ne reste dans le navigateur (ni localStorage, ni cookie).
 */
import { SAISIE_VIDE, saisieSure, type Saisie } from './profilGratuit';

const CLE = 'cts-gratuit-brouillon';

export function lireBrouillon(): Saisie | null {
  try {
    const brut = sessionStorage.getItem(CLE);
    return brut ? saisieSure(JSON.parse(brut)) : null;
  } catch {
    return null;
  }
}

export function garderBrouillon(s: Saisie) {
  try {
    sessionStorage.setItem(CLE, JSON.stringify(s));
  } catch {
    // Sans stockage (navigation privée stricte) : le résultat reste à l'écran, il ne suit pas jusqu'à la connexion.
  }
}

export function effacerBrouillon() {
  try {
    sessionStorage.removeItem(CLE);
  } catch {
    // rien à effacer
  }
}

export const brouillonVide = (s: Saisie | null) => !s || JSON.stringify(s) === JSON.stringify(SAISIE_VIDE);

// Le dossier de course que le visiteur a sous les yeux (lot B) : le même régime, la mémoire de l'onglet. Ce qui s'y garde :
// ce qui est parti au moteur (jamais le fichier GPX), la réponse allégée et la stratégie de nutrition, si elle est faite.
// Gardé dans son compte à la connexion, puis effacé ; effacé aussi à la fermeture de l'onglet.
const CLE_DOSSIER = 'cts-gratuit-dossier';

export function lireDossierBrouillon(): { entrees: unknown; reponse: unknown; strategie: unknown } | null {
  try {
    const brut = sessionStorage.getItem(CLE_DOSSIER);
    const o = brut ? JSON.parse(brut) : null;
    return o && typeof o === 'object' ? o : null;
  } catch {
    return null;
  }
}

export function garderDossierBrouillon(d: { entrees: unknown; reponse: unknown; strategie: unknown }): boolean {
  try {
    sessionStorage.setItem(CLE_DOSSIER, JSON.stringify(d));
    return true;
  } catch {
    // Sans stockage : le dossier reste à l'écran, il ne suit pas jusqu'à la connexion.
    return false;
  }
}

export function effacerDossierBrouillon() {
  try {
    sessionStorage.removeItem(CLE_DOSSIER);
  } catch {
    // rien à effacer
  }
}

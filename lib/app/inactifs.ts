/**
 * Les comptes inactifs (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, E7 ; D4 du cadrage de l'app ; décision coach
 * du 15/10/2026) : un compte sans activité depuis 3 ans est supprimé, comme par « Supprimer mon compte », après un
 * e-mail d'avertissement 30 jours avant. Jamais un compte coach, jamais sans avertissement : un avertissement envoyé en
 * retard repousse la suppression à 30 jours après lui. Revenir dans l'app repousse tout. La règle seule, sans accès à
 * la base ni au réseau (lib/app/comptesInactifs.ts fait les gestes).
 */
export const ANS_SANS_ACTIVITE = 3;
export const PREAVIS_JOURS = 30;
const JOUR_MS = 24 * 3600 * 1000;

// La dernière activité connue (ISO) et la date d'un avertissement déjà envoyé, s'il y en a un.
export type CompteAge = { id: string; email: string; derniere: string; avertiLe: string | null };
export type Geste = { id: string; email: string; geste: 'avertir' | 'supprimer'; suppressionLe: string };

export function finDuCompte(derniere: string): Date {
  const fin = new Date(derniere);
  fin.setUTCFullYear(fin.getUTCFullYear() + ANS_SANS_ACTIVITE);
  return fin;
}

export function gestesDuJour(comptes: CompteAge[], maintenant: Date, coachs: string[]): Geste[] {
  const gestes: Geste[] = [];
  for (const c of comptes) {
    if (coachs.includes(c.email.trim().toLowerCase())) continue;
    const fin = finDuCompte(c.derniere);
    const avertirLe = new Date(fin.getTime() - PREAVIS_JOURS * JOUR_MS);
    // Un avertissement d'avant la dernière activité ne compte plus : la personne est revenue entre-temps.
    const averti = c.avertiLe !== null && new Date(c.avertiLe) >= avertirLe;
    if (!averti) {
      if (maintenant >= avertirLe) {
        const auPlusTot = new Date(maintenant.getTime() + PREAVIS_JOURS * JOUR_MS);
        gestes.push({ id: c.id, email: c.email, geste: 'avertir', suppressionLe: (fin > auPlusTot ? fin : auPlusTot).toISOString() });
      }
    } else if (maintenant >= fin && maintenant.getTime() - new Date(c.avertiLe as string).getTime() >= PREAVIS_JOURS * JOUR_MS) {
      gestes.push({ id: c.id, email: c.email, geste: 'supprimer', suppressionLe: maintenant.toISOString() });
    }
  }
  return gestes;
}

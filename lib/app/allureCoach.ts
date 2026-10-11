/**
 * La vitesse critique d'un athlète coaché en allure (min/km), comme le coach la pense (demande du 11/10/2026) ;
 * le moteur la reçoit en m/s.
 */

// « 4:10 », « 4'10 », « 4′10″ », « 4 10 », « 4 » -> secondes par km ; null si illisible.
export function lireAllure(texte: string): number | null {
  const m = /^\s*(\d{1,2})(?:\s*(?::|'|′|’|min|\s)\s*(\d{1,2}))?\s*(?:"|″|s)?\s*(?:\/\s*km)?\s*$/i.exec(texte);
  if (!m) return null;
  const secondes = Number(m[2] ?? 0);
  if (secondes > 59) return null;
  return Number(m[1]) * 60 + secondes;
}

// m/s -> « 4:10 »
export const allureDepuisVitesse = (vcMs: number) => {
  const s = Math.round(1000 / vcMs);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

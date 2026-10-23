/**
 * La route (moteur 8.349 ; CTS_ROUTE_CADRAGE.md, décision 5 du 10 km) : l'allure de course vient du chrono visé, les
 * bornes physiologiques de la VC. Un chrono visé totalement incohérent avec sa VC s'annonce dans « À regarder », pour
 * que le coach en parle avec l'athlète : au 10 km, une allure visée plus rapide que 104 % de sa VC ou plus lente que
 * 90 % (seuils proposés par Claude le 23/10/2026, à ajuster par le coach). Le semi et le marathon suivront.
 */
export const BORNES_CHRONO_ROUTE: Record<string, { km: number; bas: number; haut: number }> = {
  R10: { km: 10, bas: 0.9, haut: 1.04 },
};

// « 0h46 », « 46min », « 0:46:30 », « 46:30 » : des secondes ; null illisible.
export function secondesDuChrono(brut: unknown): number | null {
  const t = String(brut ?? '').trim().toLowerCase().replace(/\s+/g, '');
  let m = /^(\d{1,2})h(\d{0,2})$/.exec(t);
  if (m) return Number(m[1]) * 3600 + Number(m[2] || 0) * 60;
  m = /^(\d{1,3})(?:min|mn|')?$/.exec(t);
  if (m) return Number(m[1]) * 60;
  m = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(t);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  m = /^(\d{1,3}):(\d{2})$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  return null;
}

const allure = (sKm: number) => `${Math.floor(sKm / 60)}:${String(Math.round(sKm % 60)).padStart(2, '0')}/km`;

// La phrase de l'alerte, ou null : format hors route, chrono illisible, VC inconnue, ou allure dans les bornes.
export function alerteChronoRoute(format: unknown, chrono: unknown, vcMs: number | null | undefined): string | null {
  const b = BORNES_CHRONO_ROUTE[String(format ?? '')];
  const s = secondesDuChrono(chrono);
  if (!b || !s || !vcMs) return null;
  const part = (b.km * 1000) / s / vcMs;
  if (part >= b.bas && part <= b.haut) return null;
  return `son chrono visé demande ${allure(s / b.km)}, soit ${Math.round(part * 100)} % de sa vitesse critique `
    + `(${allure(1000 / vcMs)}) : ${part > b.haut ? 'plus rapide' : 'plus lent'} que ce qu’elle laisse attendre, à en parler avec lui.`;
}

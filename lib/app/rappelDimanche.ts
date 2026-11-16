/**
 * LE RAPPEL DU DIMANCHE (décision 5 du coach du 16/11/2026, lot 0) : le calcul seul, sans Nolio ni base ; la lecture et l'envoi
 * sont dans lib/app/rappelDuDimanche.ts, lancé par app/api/ecriture/rappel (vercel.json, dimanche vers 14 h UTC).
 *
 * Le rappel part par un MESSAGE NOLIO PROGRAMMÉ (`POST planned/messages/`, droit `planned:write`) : description, date_start,
 * hour_start, show_to_the_athlete, athletes (un athlète ; rien pour le coach lui-même). Il vise qui n'a pas répondu au
 * questionnaire du samedi, ou qui a une séance de la semaine pas remontée dans Nolio.
 *
 * COUPÉ PAR DÉFAUT : rien ne part tant que la variable d'environnement CTS_RAPPEL_DIMANCHE n'est pas « oui » (Vercel, Settings >
 * Environment Variables) ; il faut d'abord vérifier le fuseau de `hour_start`. Les trois textes sont VALIDÉS par le coach (16/11/2026),
 * mot pour mot. Aucun texte n'invite un acheteur de plan à échanger avec le coach.
 */

// L'interrupteur : éteint tant que la variable n'est pas « oui ».
export const rappelActif = (env: Record<string, string | undefined> = process.env) => env.CTS_RAPPEL_DIMANCHE?.trim().toLowerCase() === 'oui';

// Le texte du rappel, VALIDÉ par le coach le 16/11/2026 : un texte par cas (les deux manquent, la réponse seule, les séances seules).
export const TEXTE_RAPPEL_VALIDE = true;
export const TEXTES_RAPPEL = {
  les_deux: 'Petit rappel : ta semaine prochaine s’écrit ce soir. Pour qu’elle colle à ce que tu as vraiment fait, réponds au questionnaire du samedi et fais remonter tes séances dans Nolio (synchronise ta montre). Sinon, elle reste au même niveau, puis se recale dès que tout est à jour.',
  reponse: 'Petit rappel : ta semaine prochaine s’écrit ce soir. Pour qu’elle colle à ce que tu as vraiment fait, réponds au questionnaire du samedi. Sinon, elle reste au même niveau, puis se recale dès que tout est à jour.',
  seances: 'Petit rappel : ta semaine prochaine s’écrit ce soir. Pour qu’elle colle à ce que tu as vraiment fait, fais remonter tes séances dans Nolio (synchronise ta montre). Sinon, elle reste au même niveau, puis se recale dès que tout est à jour.',
};
export function texteDuRappel(cas: { sansReponse: boolean; nonRemontee: boolean }): string | null {
  if (!cas.sansReponse && !cas.nonRemontee) return null;
  return cas.sansReponse && cas.nonRemontee ? TEXTES_RAPPEL.les_deux : cas.sansReponse ? TEXTES_RAPPEL.reponse : TEXTES_RAPPEL.seances;
}

// L'heure du message, à Paris : 15 h, ou dans dix minutes si le passage de la tâche (Vercel la lance dans l'heure prévue) est plus
// tard, arrondie aux cinq minutes. Plus tard que 17 h : null (trop près de l'écriture de la semaine, rien ne part).
export const HEURE_RAPPEL = '15:00';
const HEURE_LIMITE = '17:00';
export function heureDuRappel(maintenant: Date = new Date()): string | null {
  const [h, m] = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Paris' })
    .format(maintenant).split(':').map(Number);
  const dans10 = Math.ceil((h * 60 + m + 10) / 5) * 5;
  const cible = Math.max(15 * 60, dans10);
  const hhmm = `${String(Math.floor(cible / 60)).padStart(2, '0')}:${String(cible % 60).padStart(2, '0')}`;
  return hhmm > HEURE_LIMITE ? null : hhmm;
}

// Une séance de la semaine pas remontée : une séance que le moteur a écrite pour cette semaine, prévue au plus tard aujourd'hui,
// à laquelle aucune activité n'est reliée. planifiees : les séances prévues lues ; parNolio : celles du moteur (leur identifiant
// Nolio -> leur jour de plan, « S14-mardi ») ; reliees : les identifiants de séance prévue auxquels une activité est reliée.
export function seancesNonRemontees(p: { lundi: string; jour: string; planifiees: { id: string; date_start: string }[];
  parNolio: ReadonlyMap<string, string>; reliees: ReadonlySet<string> }): string[] {
  return p.planifiees.filter((x) => p.parNolio.has(x.id) && x.date_start.slice(0, 10) >= p.lundi && x.date_start.slice(0, 10) <= p.jour
    && !p.reliees.has(x.id)).map((x) => String(p.parNolio.get(x.id)));
}

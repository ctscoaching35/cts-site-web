/**
 * Côté navigateur : un « +1 » anonyme du tunnel de vente (app/api/mesure), une fois par étape et par onglet,
 * sans cookie ni identifiant (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, L4).
 */
// LES PORTES DU QUESTIONNAIRE (audit de la programmation trail du 30/10/2026, P6 ; décision coach « A ») : chaque porte qui
// bloque compte une fois par visite, comme une étape du tunnel, pour savoir ce qu'elle coûte en ventes.
export type Porte = 'porte_niveau' | 'porte_duree' | 'porte_frequence' | 'porte_sortie_longue' | 'porte_temps' | 'porte_autre';

// Le type d'un refus du moteur, lu dans sa phrase (cts_intake.valider_champs) ; « autre » : la saisie, une course
// invalide (moins de 5 km, plus de 100 m/km, date passée).
export function porteDuRefus(message: string): Porte {
  if (/pas ouvert à ton niveau|Au niveau intermédiaire/.test(message)) return 'porte_niveau';
  if (/séances par semaine|séances\/semaine/.test(message)) return 'porte_frequence';
  if (/au moins 45 minutes/.test(message)) return 'porte_sortie_longue';
  if (/dépasse le plafond/.test(message)) return 'porte_temps';
  if (/ne se prépare (pas|dans aucune)|incompatible avec le format/.test(message)) return 'porte_duree';
  return 'porte_autre';
}

export function compterEtape(etape: 'offre' | 'questionnaire' | 'recap' | 'paiement' | Porte) {
  try {
    const cle = `cts-mesure-${etape}`;
    if (sessionStorage.getItem(cle)) return;
    sessionStorage.setItem(cle, '1');
  } catch {
    /* stockage indisponible : on compte quand même */
  }
  const corps = JSON.stringify({ etape });
  if (!navigator.sendBeacon?.('/api/mesure', new Blob([corps], { type: 'application/json' }))) {
    fetch('/api/mesure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corps, keepalive: true }).catch(() => {});
  }
}

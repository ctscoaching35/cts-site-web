/**
 * Côté navigateur : un « +1 » anonyme du tunnel de vente (app/api/mesure), une fois par étape et par onglet,
 * sans cookie ni identifiant (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, L4).
 */
export function compterEtape(etape: 'offre' | 'questionnaire' | 'recap' | 'paiement') {
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

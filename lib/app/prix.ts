/**
 * Le prix d'une nouvelle préparation, pour le bouton « Préparer une nouvelle course » de l'acheteur après sa course (Q12,
 * décision coach du 05/11/2026 au soir, « A » : le bouton dit qu'il mène à un achat, son prix dessous). Lu là où le site
 * le lit déjà, l'API du moteur (GET /v1/config, prix_eur_par_mois), comme la page des plans et les CGV ; le plus bas des
 * prix, « dès ». Côté serveur seulement.
 */
import { API_URL } from '@/lib/plan';
import { enTetesMoteur } from './cleMoteur';
import { demonstrationOuverte } from './demonstrationPorte';

// La démonstration (développement seulement) sans moteur lancé : les prix du moteur (api.py, PRIX_EUR), recopiés pour
// que la page se lise ; jamais en production.
const PRIX_DE_DEMONSTRATION = { 3: 39, 4: 49, 6: 59 };

export async function prixLePlusBas(): Promise<number | null> {
  try {
    const r = await fetch(`${API_URL}/v1/config`, { next: { revalidate: 3600 }, headers: enTetesMoteur() });
    const prix = r.ok ? ((await r.json()).prix_eur_par_mois ?? null) as Record<string, number> | null : null;
    if (prix && Object.keys(prix).length) return Math.min(...Object.values(prix));
  } catch {
    // Le moteur ne répond pas : pas de prix, le bouton reste.
  }
  return demonstrationOuverte() ? Math.min(...Object.values(PRIX_DE_DEMONSTRATION)) : null;
}

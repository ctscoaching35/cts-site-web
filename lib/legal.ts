/**
 * Les pages légales (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, L5 et C5 ; écrites le 15/10/2026, relues par le
 * coach) : qui vend, comment le joindre, le médiateur. Une seule source pour les CGV, les mentions légales et la
 * politique de confidentialité. Données par le coach le 15/10/2026 ; coordonnées publiques choisies par lui (option 1).
 */
import { site } from './content';
import { clientServeur, supabaseConfigure } from './app/supabase';
import { planOuvert } from './planAcces';

export const vendeur = {
  nom: 'Romain Leterme',
  forme: 'entrepreneur individuel (EI)',
  nomCommercial: 'CTS Coaching',
  adresse: '3 allée Angélique du Coudray, 35000 Rennes, France',
  siret: '813 554 755 00062',
  tvaIntracom: 'FR38813554755',
  email: site.email,
  telephone: '06 74 18 96 16',
  telephoneLien: '+33674189616',
};

// Adhésion faite par le coach le 15/10/2026, pour 3 ans.
export const mediateur = {
  nom: 'CM2C',
  adresse: '49 rue de Ponthieu, 75008 Paris',
  site: 'https://www.cm2c.net',
};

// RIEN DES PLANS AVANT LE LANCEMENT (décision coach du 15/10/2026) : les CGV et ce que la politique de confidentialité
// dit des plans restent derrière la porte des plans (lib/planAcces.ts : CTS_PLAN_OUVERT=1 le 7/11, ou le lien
// d'invitation), ouverte aussi à un compte connecté qui a un plan à lui (un acheteur sur un autre appareil que celui de
// l'invitation). Un coaché n'en a pas : ses objectifs sont rangés chez son coach ; il ne voit ni les CGV, qui ne
// couvrent pas le coaching individualisé, ni la partie achat (décision coach du 20/10/2026).
export async function plansVisibles(): Promise<boolean> {
  if (await planOuvert()) return true;
  if (!supabaseConfigure()) return false;
  try {
    const supabase = await clientServeur();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims?.sub) return false;
    // Les règles de la base ne montrent à un compte que ses propres plans.
    const { data: siens } = await supabase.from('plans').select('id').limit(1);
    return Boolean(siens?.length);
  } catch {
    return false;
  }
}

export const VERSION_CGV = '19 octobre 2026';
export const VERSION_CONFIDENTIALITE = '20 octobre 2026';

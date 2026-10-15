/**
 * Les pages légales (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, L5 et C5 ; écrites le 15/10/2026, relues par le
 * coach) : qui vend, comment le joindre, le médiateur. Une seule source pour les CGV, les mentions légales et la
 * politique de confidentialité. Données par le coach le 15/10/2026 ; coordonnées publiques choisies par lui (option 1).
 */
import { site } from './content';

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

export const VERSION_CGV = '15 octobre 2026';
export const VERSION_CONFIDENTIALITE = '15 octobre 2026';

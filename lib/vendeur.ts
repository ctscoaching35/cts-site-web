/**
 * Qui vend, sans dépendance (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, L5 et C5 ; données par le coach le
 * 15/10/2026, coordonnées publiques choisies par lui, option 1) : lu par les pages légales (lib/legal.ts) et par les
 * e-mails (la confirmation de commande, J1 des audits du 05/11/2026), qui ne doivent pas tirer la session du site.
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

// LES DATES DE VERSION (audits du 05/11/2026, S3) : celle de la mise en ligne des textes corrigés, que la session
// principale fixe ; « 5 novembre 2026 » par défaut.
export const VERSION_CGV = '5 novembre 2026';
export const VERSION_CONFIDENTIALITE = '5 novembre 2026';

// LE FORMULAIRE DE RÉTRACTATION (modèle de l'annexe à l'article R221-1 du code de la consommation, au « tu » des
// conditions de vente) : dans les CGV (article 8) et dans la confirmation de commande (J1), mot pour mot les mêmes lignes.
export const FORMULAIRE_RETRACTATION = {
  titre: 'Formulaire de rétractation',
  consigne: '(Complète et renvoie ce formulaire seulement si tu veux te rétracter du contrat.)',
  destinataire: `À l’attention de ${vendeur.nom}, ${vendeur.nomCommercial}, ${vendeur.adresse}, ${vendeur.email} :`,
  lignes: [
    'Je vous notifie par la présente ma rétractation du contrat portant sur la prestation de services ci-dessous :',
    'Commandé le :',
    'Nom :',
    'Adresse :',
    'Signature (seulement si ce formulaire est envoyé sur papier) :',
    'Date :',
  ],
};

/**
 * Couleurs de l'app, reprises du PDF (cts_base.py, CTS_CHARTE_VISUELLE.md) : une séance a la
 * même couleur sur papier et sur l'écran (cadrage de l'app, choix par défaut).
 */
import type { Famille } from './plan';

// Famille de séance -> fond de ligne et filet de la carte (cts_pdf_slim._FAMILLES).
export const FAMILLES: Record<Famille, { fond: string; filet: string }> = {
  repos: { fond: '#F3F7F0', filet: '#C5D5D2' },
  ef: { fond: '#FFFFFF', filet: '#B9C7C3' },
  qualite: { fond: '#E4E3EE', filet: '#2F2D4E' },
  mecanique: { fond: '#ECE7D6', filet: '#A8996A' },
  sl: { fond: '#D9ECE6', filet: '#0C6E5F' },
  course: { fond: '#0C6E5F', filet: '#0C6E5F' },
};

// Bannière de semaine par type (cts_base.BANNIERE_TYPE).
export const BANNIERE: Record<string, string> = {
  Charge: '#2F2D4E',
  Assimilation: '#4F6F69',
  'Affûtage actif': '#0C6E5F',
  Décharge: '#0D5A4E',
  'Back-to-back': '#0C6E5F',
};

// Pastilles de l'en-tête de la carte (cts_base._PASTILLES) : fond, encre.
export const PASTILLES: Record<string, [string, string]> = {
  Terrain: ['#E3EFE9', '#0C6E5F'],
  Durée: ['#EEF1F6', '#2F2D4E'],
  Cible: ['#FBE7DF', '#9A3B2C'],
  // « Tes zones » : la FC ou l'allure tirée du profil, à côté de la cible (moteur v8.311).
  Repère: ['#DFF0EA', '#0C6E5F'],
};

// Libellés de la carte : la consigne et le ravito en ocre, le reste en teal (cts_base).
export const ENCRE_LIBELLE: Record<string, string> = { 'À retenir': '#9A6A12', Ravito: '#8A5A00' };

// Catégories de pente du profil (cts_pdf_slim._COULEURS_PENTE) : bleu nuit pour la descente
// raide, teal pour la montée raide, crème pour le vallonné.
export const COULEURS_PENTE: Record<string, string> = {
  descente_raide: '#2F2D4E',
  descente: '#8DADCE',
  vallonne: '#E3DCC4',
  montee: '#BEE4DE',
  montee_raide: '#0C6E5F',
};

// Barres du graphique des semaines, par type (cts_pdf_slim._COULEURS_TYPE_SEMAINE).
export const COULEURS_TYPE_SEMAINE: Record<string, string> = {
  charge: '#2F2D4E',
  assimilation: '#8A94A8',
  affutage_actif: '#0C6E5F',
  affutage_decharge: '#0D5A4E',
};

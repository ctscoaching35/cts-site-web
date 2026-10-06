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
};

// Libellés de la carte : la consigne et le ravito en ocre, le reste en teal (cts_base).
export const ENCRE_LIBELLE: Record<string, string> = { 'À retenir': '#9A6A12', Ravito: '#8A5A00' };

/**
 * LA CARTE À PARTAGER (app gratuite, lot B, d'après l'écran « Partager » de la maquette validée le 16/11/2026) : un visuel au
 * format story (1080 × 1920), dessiné dans un canvas, la course seule (son nom, sa date, la distance, le D+, son profil) et
 * l'adresse de l'app. AUCUNE donnée personnelle : la fonction ne reçoit qu'un ModeleCarte (lib/app/courseLibre.ts), qui n'en porte pas
 * (ni FC, ni allure, ni temps visé). Pur : le dessin prend un contexte 2D, que le navigateur (CarteStory.tsx) et les tests fournissent.
 *
 * Le bas d'une story est recouvert par l'interface d'Instagram (la barre de réponse) et le haut par le nom du compte : tout ce qui
 * compte tient entre 250 et 1620 px.
 */
import type { Classe, ModeleCarte } from './courseLibre';

export const LARGEUR = 1080;
export const HAUTEUR = 1920;
export const ADRESSE_CARTE = 'cts-coaching.com';
// Les phrases de la carte et de son écran : celles de la maquette (« Partager »).
export const SURTITRE_CARTE = 'Ma prochaine course';
export const ACCROCHE_CARTE = 'Comprends ta course, gratuitement';
export const COMPTE_INSTAGRAM = '@cts.coaching';

const FOND = '#1F1D38';
const CLAIR = '#E8EFE3';
const MENTHE = '#5FB8A6';
const TEAL = '#0C6E5F';
// Les catégories de pente sur le fond sombre (celles de la maquette) ; la clé est celle du moteur.
const PENTES_SUR_SOMBRE: Record<string, string> = {
  descente_raide: '#2F2D4E', descente: '#3F3D6A', vallonne: CLAIR, montee: MENTHE, montee_raide: TEAL,
};
// « course roulante », « course vallonnée », « course de montagne », « course de montagne raide ».
export const CLASSE_COURTE: Record<Classe, string> = { roulant: 'roulante', vallonne: 'vallonnée', montagne: 'de montagne', montagne_raide: 'de montagne raide' };

// « dimanche 14 mars 2027 »
export const dateDeLaCarte = (iso: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    : '';

// Le nom du fichier téléchargé : « city-to-summit-trail-de-la-cote-sauvage.png »
export const nomDuFichier = (nom: string) =>
  `city-to-summit-${nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'course'}.png`;

type Ctx = CanvasRenderingContext2D;
export type OptionsCarte = { famille: string; logo?: CanvasImageSource | null };

// Le texte coupé en lignes de `largeur` px au plus ; la dernière finit par « … » s'il en reste.
export function decouperLignes(c: Pick<Ctx, 'measureText'>, texte: string, largeur: number, maxLignes: number): string[] {
  const mots = texte.trim().split(/\s+/).filter(Boolean);
  const lignes: string[] = [];
  let courante = '';
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (courante && c.measureText(essai).width > largeur) { lignes.push(courante); courante = mot; } else courante = essai;
  }
  if (courante) lignes.push(courante);
  if (lignes.length <= maxLignes) return lignes;
  const gardees = lignes.slice(0, maxLignes);
  let derniere = `${gardees[maxLignes - 1]}…`;
  while (derniere.length > 2 && c.measureText(derniere).width > largeur) derniere = `${derniere.slice(0, -2)}…`;
  gardees[maxLignes - 1] = derniere;
  return gardees;
}

function texte(c: Ctx, t: string, x: number, y: number, o: { taille: number; poids: number; couleur: string; famille: string; espacement?: number; align?: CanvasTextAlign }) {
  c.font = `${o.poids} ${o.taille}px ${o.famille}`;
  c.fillStyle = o.couleur;
  c.textAlign = o.align ?? 'left';
  c.textBaseline = 'alphabetic';
  if ('letterSpacing' in c) (c as unknown as { letterSpacing: string }).letterSpacing = `${o.espacement ?? 0}px`;
  c.fillText(t, x, y);
  if ('letterSpacing' in c) (c as unknown as { letterSpacing: string }).letterSpacing = '0px';
}

function arrondi(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// Le profil : l'altitude remplie, chaque plage à la couleur de sa pente, la ligne par-dessus.
function profil(c: Ctx, p: NonNullable<ModeleCarte['profil']>, zone: { x: number; y: number; w: number; h: number }) {
  const { km, altitude_m: alt, plages } = p;
  const total = km[km.length - 1] || 1;
  const bas = Math.min(...alt);
  const haut = Math.max(...alt);
  const marge = Math.max((haut - bas) * 0.1, 5);
  const x = (k: number) => zone.x + (k / total) * zone.w;
  const y = (a: number) => zone.y + (1 - (a - (bas - marge)) / (haut + marge - (bas - marge))) * zone.h;
  const fond = zone.y + zone.h;
  const morceaux: [number, number, string][] = plages?.length ? plages : [[0, alt.length - 1, 'vallonne']];
  for (const [i0, i1, cat] of morceaux) {
    c.beginPath();
    c.moveTo(x(km[i0]!), fond);
    for (let i = i0; i <= i1; i++) c.lineTo(x(km[i]!), y(alt[i]!));
    c.lineTo(x(km[i1]!), fond);
    c.closePath();
    c.fillStyle = PENTES_SUR_SOMBRE[cat] ?? CLAIR;
    c.fill();
  }
  c.beginPath();
  alt.forEach((a, i) => (i === 0 ? c.moveTo(x(km[i]!), y(a)) : c.lineTo(x(km[i]!), y(a))));
  c.strokeStyle = '#FFFFFF';
  c.lineWidth = 5;
  c.lineJoin = 'round';
  c.stroke();
}

export function dessinerCarte(c: Ctx, m: ModeleCarte, o: OptionsCarte) {
  const f = o.famille;
  const marge = 76;
  c.fillStyle = FOND;
  c.fillRect(0, 0, LARGEUR, HAUTEUR);

  // Le logo en haut, sur une pastille claire (comme dans la maquette), sous la zone du nom du compte ; sans lui, la marque en lettres.
  if (o.logo) {
    const l = o.logo as { width?: number; height?: number };
    const h = 92;
    const w = l.width && l.height ? (l.width / l.height) * h : h;
    arrondi(c, marge, 250, w + 40, h + 36, 26);
    c.fillStyle = '#F3F7F0';
    c.fill();
    c.drawImage(o.logo, marge + 20, 268, w, h);
  } else texte(c, 'CITY TO SUMMIT', marge, 310, { taille: 40, poids: 800, couleur: '#FFFFFF', famille: f, espacement: 6 });

  texte(c, SURTITRE_CARTE.toUpperCase(), marge, 470, { taille: 34, poids: 700, couleur: MENTHE, famille: f, espacement: 7 });
  // Le nom : jusqu'à trois lignes, qui rétrécissent si le nom est long.
  let taille = 132;
  let lignes: string[] = [];
  for (; taille >= 84; taille -= 12) {
    c.font = `800 ${taille}px ${f}`;
    lignes = decouperLignes(c, m.nom, LARGEUR - 2 * marge, 3);
    if (lignes.length <= 3 && !lignes[lignes.length - 1]?.endsWith('…')) break;
  }
  let y = 470 + 30 + taille;
  for (const l of lignes) {
    texte(c, l, marge, y, { taille, poids: 800, couleur: '#FFFFFF', famille: f, espacement: -2 });
    y += taille * 1.04;
  }
  const yDate = y - taille * 1.04 + 70;
  const date = dateDeLaCarte(m.date);
  if (date) texte(c, date, marge, yDate, { taille: 46, poids: 600, couleur: CLAIR, famille: f });

  // Les chiffres : distance, D+. Sans profil à montrer, ils descendent vers le milieu de la carte.
  const avecProfil = Boolean(m.profil && m.profil.altitude_m.length > 1);
  const yc = Math.max(yDate + 190, avecProfil ? 0 : 1130);
  const km = String(Math.round(m.distance_km * 10) / 10).replace('.', ',');
  texte(c, km, marge, yc, { taille: 150, poids: 800, couleur: '#FFFFFF', famille: f, espacement: -3 });
  c.font = `800 150px ${f}`;
  const xDplus = marge + c.measureText(km).width + 70;
  texte(c, 'KM', marge, yc + 52, { taille: 34, poids: 700, couleur: MENTHE, famille: f, espacement: 5 });
  const dplus = String(Math.round(m.dplus_m));
  texte(c, dplus, xDplus, yc, { taille: 150, poids: 800, couleur: '#FFFFFF', famille: f, espacement: -3 });
  texte(c, 'M D+', xDplus, yc + 52, { taille: 34, poids: 700, couleur: MENTHE, famille: f, espacement: 5 });
  const finChiffres = yc + 52;

  // Le profil, d'un bord à l'autre, entre les chiffres et l'accroche.
  if (m.profil && avecProfil) {
    const haut = finChiffres + 80;
    profil(c, m.profil, { x: 0, y: haut, w: LARGEUR, h: Math.max(150, 1560 - haut) });
  }

  // L'accroche et l'adresse, au-dessus de la zone recouverte par l'interface d'Instagram.
  texte(c, ACCROCHE_CARTE, marge, 1640, { taille: 50, poids: 800, couleur: '#FFFFFF', famille: f });
  texte(c, ADRESSE_CARTE, marge, 1706, { taille: 44, poids: 700, couleur: MENTHE, famille: f });
}

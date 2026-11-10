/**
 * L'ESPACE COACH PAR ATHLÈTE (décision « 1A » du coach, 08/11/2026 ; maquette validée le 08/11/2026, « tout A » aux treize
 * questions, `reports/Espace coach par athlète — questions de la maquette 08-11.md` dans le dépôt du moteur) : le calcul
 * seul, sans lecture, pour se tester sur des données fabriquées (scripts/test-espace-coach.mjs).
 * - Q1 : la couleur de « Dimanche » toute la semaine, et sa raison courte (« Orange · plus dur que prévu ») ;
 * - Q2 : l'ordre de « Mes athlètes », celui de Nolio (alphabétique du prénom, 09/11/2026), qui est aussi celui d'« Athlète suivant » ;
 * - Q6 et Q7 : « Ce qui l'attend », tous ses points en étiquettes, ce que le moteur a réglé seul compris, « À venir » en gris ;
 * - Q8 : « Urgent », une ligne par point, en quatre groupes ; « À venir » n'y va jamais.
 * La lecture est dans lib/app/mesAthletes.ts.
 */
import type { ARegarder } from './espaceCoach';
import type { Niveau as Couleur, Prevision } from './prevision';

// Le nom court de chaque point dans « Ce qui l'attend » (venu de « Mes athlètes », décision 1A du coach du 05/11/2026).
export const SIGNAL: Record<string, string> = {
  demande: 'Objectif demandé', arret: 'Arrêt de course', mot: 'Un mot pour toi', rpe: 'RPE à revoir', retour: 'Sans retour',
  sous_plan: 'Sous le plan', demarrer: 'À démarrer', nolio: 'Nolio à associer', equipe: 'Hors de l’équipe Nolio',
  accord: 'Sans accord de lecture', semaine: 'Semaine pas partie', profil: 'Profil à remplir', commentaire: 'Commentaire à lire',
  sensations: 'Mauvaises sensations', hooper: 'Fatigue qui monte', silence: 'Rien de remonté', chrono_route: 'Chrono à revoir',
  prerequis: 'Prérequis à voir', course_nolio: 'Course A dans Nolio', preparation: 'Course de préparation', suite: 'Rien après',
  test: 'Test à revoir', week_end_choc: 'Week-end choc à annoncer', courses_proches: 'Courses trop proches',
  saison: 'Saison de fond refusée', remontee: 'Pas remontée',
};

// ─── Une séance du week-end pas remontée (décision 13-6 du coach du 10/11/2026) ────────────────────────────────────

// Le dimanche, le moteur compte comme faite une séance du week-end pas encore remontée ; pour un coaché, « Urgent » prévient
// le coach à partir du mardi matin si elle n'est toujours pas dans Nolio, il ajuste lui-même (si elle n'a pas été courue,
// le dimanche suivant la lit comme un écart, feu orange). signaux : ceux gardés du soir (« manquee », une séance prévue
// passée sans réalisé rattaché ; son détail dit une sortie longue) ; jour : aujourd'hui. Rend ses séances du samedi et du
// dimanche d'avant, du mardi au dimanche ; rien le lundi.
export function seancesPasRemontees(signaux: { genre: string; jour: string; detail?: string }[], jour: string):
  { jour: string; sortieLongue: boolean }[] {
  const midi = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const decaler = (iso: string, n: number) => {
    const d = midi(iso);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const rang = (midi(jour).getUTCDay() + 6) % 7;
  if (rang < 1) return [];
  const lundi = decaler(jour, -rang);
  const samedi = decaler(lundi, -2);
  const dimanche = decaler(lundi, -1);
  return signaux.filter((s) => s.genre === 'manquee' && s.jour.slice(0, 10) >= samedi && s.jour.slice(0, 10) <= dimanche)
    .map((s) => ({ jour: s.jour.slice(0, 10), sortieLongue: /^sortie longue/.test(s.detail ?? '') }));
}

// Sa ligne (BROUILLON, CTS_TEXTES_A_VALIDER.md, section Z) : « Sa sortie longue de dimanche n'est pas remontée : à
// vérifier » ; une autre séance, « Sa séance de samedi … ».
export function texteRemontee(sortieLongue: boolean, jourDeLaSemaine: string): string {
  return `${sortieLongue ? 'Sa sortie longue' : 'Sa séance'} de ${jourDeLaSemaine} n’est pas remontée : à vérifier`;
}

// Un point d'« À regarder » (espaceCoach.ts) ou un signal de santé du soir. jour et mesure : ceux d'un signal du soir
// (« mardi 10/11 », « sensations 2/5 »), pour dire deux jours en une étiquette. sous : la ligne de dessous dans « Urgent »
// (la semaine pas partie du dimanche soir, qui attend ses reprises) ; sansGeste : ni bouton ni « Réglé » (elle se refait
// seule aux reprises ; « Réessayer » réécrit la semaine en cours, pas celle qui vient).
export type Point = ARegarder & { jour?: string; mesure?: string; sous?: string; sansGeste?: boolean };
// Ce que le moteur a réglé seul (Q6) : « Semaine ajustée », « Fatigue franche », « Arrêt de course », et sa ligne.
export type DecisionMoteur = { texte: string; detail?: string };
export type Ton = 'ok' | 'warn' | 'ko' | 'neutre';
export type Etiquette = { texte: string; ton: Ton; detail?: string };

// ─── Q1 : la couleur et sa raison ─────────────────────────────────────────────────────────────────────────────────

export const COULEUR: Record<Couleur, string> = { rouge: 'Rouge', orange: 'Orange', vert: 'Vert', rien: 'Sans signal' };

// « Rouge · aucune séance en 7 jours », « Orange · plus dur que prévu », « Vert · semaine normale », « Vert · aucune séance
// à lire » (aucune séance prévue dans ses 7 jours : une semaine pas partie, Camille dans la maquette, cas limite de Q1),
// « Sans signal · pas d'accord de lecture », « Sans signal · pas encore lu ». prevues : ses séances prévues lues ce soir,
// null sans signaux gardés.
export function raisonDuNiveau(p: Prevision, prevues: number | null, accord: boolean): string {
  if (p.niveau === 'rien') return `${COULEUR.rien} · ${accord ? 'pas encore lu' : 'pas d’accord de lecture'}`;
  if (p.niveau === 'vert') return `${COULEUR.vert} · ${prevues === 0 ? 'aucune séance à lire' : p.prevoit.toLowerCase()}`;
  return `${COULEUR[p.niveau]} · ${p.pourquoi}`;
}

// ─── Q2 : l'ordre de la liste, et « Athlète suivant » ─────────────────────────────────────────────────────────────

// Rouge, orange, puis ce qui bloque, la santé, ce que le moteur a réglé seul, ce qui arrive ; ensuite ceux qui n'ont rien.
// Ce que le moteur a réglé seul se place entre la santé et ce qui arrive, comme le signal de « Mes athlètes » le rangeait
// avant (une carte d'abord, puis la décision du moteur, puis ce qui arrive).
export function groupeDe(couleur: Couleur, points: Pick<Point, 'niveau'>[], moteur: boolean): number {
  if (couleur === 'rouge') return 0;
  if (couleur === 'orange') return 1;
  if (points.some((p) => p.niveau === 'bloque')) return 2;
  if (points.some((p) => p.niveau === 'sante')) return 3;
  if (moteur) return 4;
  if (points.some((p) => p.niveau === 'arrive')) return 5;
  return 6;
}

// L'ordre de Nolio (demande du coach du 09/11/2026, qui remplace Q2 « A » du 08/11) : par ordre alphabétique du prénom,
// comme sa liste d'athlètes dans Nolio, pour s'y retrouver d'un outil à l'autre ; « Athlète suivant » suit le même ordre.
// Ceux qui l'attendent restent repérés par leur pastille et rassemblés dans « Urgent » ; le groupe (groupeDe) sert encore
// à leurs étiquettes, plus à l'ordre.
export function ordonner<T extends { nom: string; groupe: number }>(lignes: T[]): T[] {
  return [...lignes].sort((x, y) => x.nom.localeCompare(y.nom, 'fr', { sensitivity: 'base' }));
}

export type Suite = { rang: number; total: number; precedent: { id: string; nom: string } | null; suivant: { id: string; nom: string } | null };
// Sa place dans la liste (« 2 sur 10 »), l'athlète d'avant et celui d'après ; null s'il n'y est pas.
export function suiteDe(ordre: { id: string; nom: string }[], id: string): Suite | null {
  const i = ordre.findIndex((x) => x.id === id);
  if (i < 0) return null;
  const nomme = (x: { id: string; nom: string } | undefined) => (x ? { id: x.id, nom: x.nom } : null);
  return { rang: i + 1, total: ordre.length, precedent: nomme(ordre[i - 1]), suivant: nomme(ordre[i + 1]) };
}

// ─── Q6 et Q7 : « Ce qui l'attend » ───────────────────────────────────────────────────────────────────────────────

// La ligne courte d'un point tirée de son texte : sa majuscule, sans point final.
export const ligneCourte = (texte: string) => (texte.charAt(0).toUpperCase() + texte.slice(1)).replace(/\.$/, '');
const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const TON: Record<Point['niveau'], Ton> = { bloque: 'ko', sante: 'ko', arrive: 'neutre' };

// La ligne d'une étiquette qui réunit les points d'un même genre : deux jours de mauvaises sensations en une ligne
// (« Mardi 10/11 et jeudi 12/11 (sensations 2/5) », maquette), deux commentaires (« Sur ses séances du lundi 9/11 et du
// mercredi 11/11 ») ; sinon leurs lignes, à la suite.
function ligneDuGenre(genre: string, points: Point[]): string | undefined {
  const jours = points.map((p) => p.jour).filter((j): j is string => Boolean(j));
  if (genre === 'commentaire' && jours.length === points.length) {
    return jours.length === 1 ? `Sur sa séance du ${jours[0]}` : `Sur ses séances du ${jours.join(' et du ')}`;
  }
  const mesures = [...new Set(points.map((p) => p.mesure))];
  if (jours.length === points.length && mesures.length === 1 && mesures[0]) return `${majuscule(jours.join(' et '))} (${mesures[0]})`;
  const lignes = [...new Set(points.map((p) => p.detail ?? (p.genre === 'arret' ? '' : ligneCourte(p.texte))).filter(Boolean))];
  return lignes.length ? lignes.join(' · ') : undefined;
}

// Ses étiquettes, une par genre : ce qui bloque, la santé, ce que le moteur a réglé seul, ce qui arrive (en gris, Q7) ;
// « Rien à signaler » s'il n'a rien.
export function etiquettes(points: Point[], moteur: DecisionMoteur | null): Etiquette[] {
  const parGenre = (niveau: Point['niveau']) => {
    const genres = [...new Set(points.filter((p) => p.niveau === niveau).map((p) => p.genre))];
    return genres.map((g): Etiquette => {
      const lot = points.filter((p) => p.niveau === niveau && p.genre === g);
      const detail = ligneDuGenre(g, lot);
      return { texte: SIGNAL[g] ?? ligneCourte(lot[0].texte), ton: TON[niveau], ...(detail ? { detail } : {}) };
    });
  };
  const liste = [...parGenre('bloque'), ...parGenre('sante'),
    ...(moteur ? [{ texte: moteur.texte, ton: 'warn' as const, ...(moteur.detail ? { detail: moteur.detail } : {}) }] : []),
    ...parGenre('arrive')];
  return liste.length ? liste : [{ texte: 'Rien à signaler', ton: 'ok' }];
}

// ─── Q8 : « Urgent » ──────────────────────────────────────────────────────────────────────────────────────────────

export type CleUrgent = 'besoin' | 'silence' | 'semaine' | 'bloque';
export const GROUPES_URGENT: { cle: CleUrgent; titre: string; genres: string[] }[] = [
  { cle: 'besoin', titre: 'A besoin de toi', genres: ['commentaire', 'mot', 'sensations', 'hooper', 'rpe', 'retour', 'sous_plan', 'arret',
    'remontee'] },
  { cle: 'silence', titre: 'Ne court plus', genres: ['silence'] },
  { cle: 'semaine', titre: 'Semaine pas partie', genres: ['semaine'] },
  { cle: 'bloque', titre: 'Objectif bloqué', genres: ['demande', 'demarrer', 'nolio', 'equipe', 'accord', 'profil', 'saison'] },
];

// Le groupe d'un point dans « Urgent » ; null pour ce qui arrive (Q7). Un genre nouveau suit son niveau : ce qui bloque
// dans « Objectif bloqué », la santé dans « A besoin de toi ».
export function groupeUrgent(p: Pick<Point, 'niveau' | 'genre'>): CleUrgent | null {
  if (p.niveau === 'arrive') return null;
  return GROUPES_URGENT.find((g) => g.genres.includes(p.genre))?.cle ?? (p.niveau === 'bloque' ? 'bloque' : 'besoin');
}

export type LigneUrgente = { athleteId: string; nom: string; point: Point };
export type GroupeUrgent = { cle: CleUrgent; titre: string; lignes: LigneUrgente[] };
// Une ligne par point, rangée dans son groupe ; dans chaque groupe, l'ordre de « Mes athlètes » (lignes, déjà ordonnées).
// Les groupes vides n'y sont pas.
export function urgentDe(lignes: { id: string; nom: string; points: Point[] }[]): GroupeUrgent[] {
  return GROUPES_URGENT.map((g) => ({
    cle: g.cle, titre: g.titre,
    lignes: lignes.flatMap((l) => l.points.filter((p) => groupeUrgent(p) === g.cle).map((point) => ({ athleteId: l.id, nom: l.nom, point }))),
  })).filter((g) => g.lignes.length > 0);
}

// Le nombre de la pastille du menu : les athlètes qui ont au moins une ligne dans « Urgent ».
export const athletesUrgents = (groupes: GroupeUrgent[]) => new Set(groupes.flatMap((g) => g.lignes.map((l) => l.athleteId))).size;

// ─── Les nombres à la française ───────────────────────────────────────────────────────────────────────────────────

// La moyenne du Hooper (« 8,8 », pas « 8.8 », défaut relevé sur la maquette du 08/11/2026) : un nombre à une décimale ;
// virgule : dans un texte déjà écrit (les signaux gardés avant le 08/11/2026 l'écrivaient avec un point).
export const decimale = (n: number) => (Math.round(n * 10) / 10).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
export const virgule = (texte: string) => texte.replace(/(\d)\.(\d)/g, '$1,$2');

// ─── Le bilan du dimanche (Q10) ───────────────────────────────────────────────────────────────────────────────────

// Du passage du dimanche soir au lundi soir (heure de Paris) : rang du jour (lundi 0 … dimanche 6) ; apres : le passage
// du dimanche a eu lieu.
export const bilanVisible = (rang: number, apres: boolean) => (rang === 6 && apres) || rang === 0;

// « 8 semaines parties, 1 pas partie · 7 athlètes attendent quelque chose de toi. »
export function texteBilan(parties: number, pasParties: number, attendent: number): string {
  const s = (n: number) => (n > 1 ? 's' : '');
  return `${parties} semaine${s(parties)} partie${s(parties)}, ${pasParties} pas partie${s(pasParties)}`
    + (attendent > 0 ? ` · ${attendent} athlète${s(attendent)} attend${attendent > 1 ? 'ent' : ''} quelque chose de toi.` : '.');
}

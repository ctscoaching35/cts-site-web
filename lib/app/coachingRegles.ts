/**
 * LA DEMANDE DE COACHING (app gratuite, lot A2, décisions du coach du 16/11/2026) : les questions de départ, leur lecture
 * et leur contrôle. Pur : le même contrôle tourne sur le serveur (jamais cru sur parole) et sert les tests, sans réseau ni
 * base. Tout ce que lit la personne est dans QUESTIONS_COACHING (UN SEUL BLOC, à faire valider par le coach).
 */
import { coteEnClair, lireCote, TEXTES_COTE } from '../cote';
import { estExperience, EXPERIENCES, type Experience } from './profilGratuit';

// ─── Les textes à valider, en un bloc ─────────────────────────────────────────────────────────────────────────────────
// Les questions du coach (16/11/2026), leurs intitulés et leurs choix : VALIDÉS en bloc par le coach le 16/11/2026, voix « je »
// (les demandes ne vont qu'à Romain) ; retouches à l'usage.
type Choix = { cle: string; titre: string };
export const QUESTIONS_COACHING = {
  titre: 'Demander le coaching',
  intro: 'Quelques questions pour que je comprenne où tu en es, puis je t’appelle pour voir si on peut travailler ensemble. Aucun paiement ici. Trois minutes au plus.',
  dejaConnu: 'Repris de ton compte : tes tests, ton expérience et tes courses sont joints à ta demande, tu ne les redonnes pas.',
  toi: { titre: 'Toi', nom: 'Prénom et nom', naissance: 'Année de naissance', ville: 'Ville' },
  vecu: {
    titre: 'Ton vécu',
    depuis: 'Depuis combien de temps tu cours ?',
    depuisChoix: [
      { cle: 'moins_1', titre: 'Moins d’un an' }, { cle: '1_3', titre: '1 à 3 ans' },
      { cle: '3_5', titre: '3 à 5 ans' }, { cle: 'plus_5', titre: 'Plus de 5 ans' },
    ] as Choix[],
    experience: 'Ton expérience en trail',
    marquantes: 'Tes courses les plus marquantes',
    marquantesAide: 'Distance, D+, temps : par exemple « Trail de 42 km, 1 800 m D+, 5 h 40 ».',
  },
  semaine: {
    titre: 'Ta semaine aujourd’hui',
    seances: 'Séances par semaine',
    seancesChoix: [
      { cle: '1', titre: '1' }, { cle: '2', titre: '2' }, { cle: '3', titre: '3' }, { cle: '4', titre: '4' }, { cle: '5_plus', titre: '5 ou plus' },
    ] as Choix[],
    heures: 'Heures par semaine, environ',
    longue: 'Ta plus longue sortie des deux derniers mois',
    longueAide: 'Sa durée, ou sa distance et son D+ : par exemple « 2 h 30 » ou « 22 km, 900 m D+ ».',
  },
  terrain: {
    titre: 'Ton terrain',
    pres: 'Ce que tu as près de chez toi',
    // « Montées de plus de 10 minutes » (23/11/2026) et « Côtes courtes » (24/11/2026, entrée 191) ne sont plus des cases : la côte se
    // dit en minutes, juste au-dessous (décision du coach, entrée 188). Les anciennes demandes les gardent (TITRES_D_AVANT).
    presChoix: [
      { cle: 'route', titre: 'Route ou plat' }, { cle: 'chemins', titre: 'Chemins' },
      { cle: 'escaliers', titre: 'Escaliers' }, { cle: 'tapis', titre: 'Tapis de course' },
    ] as Choix[],
    // La plus longue côte, en minutes : la même question qu'à l'achat, sans « pas de côte » (lib/cote.ts). Facultative ici : la
    // demande n'est pas un achat, le coach la relit à l'appel.
    cote: TEXTES_COTE,
    dplus: 'Le D+ possible sur une sortie près de chez toi',
    dplusAide: 'Un ordre de grandeur : par exemple « 300 m ».',
    montagne: 'La montagne',
    montagneChoix: [
      { cle: 'jamais', titre: 'Jamais' }, { cle: 'quelques_we', titre: 'Quelques week-ends par an' }, { cle: 'souvent', titre: 'Souvent' },
    ] as Choix[],
  },
  objectif: {
    titre: 'Ton objectif',
    quelle: 'Ta course',
    deLApp: 'Une de mes courses de l’app',
    autre: 'Une autre course',
    aucune: 'Pas encore de course',
    nom: 'Nom de la course', date: 'Date', distance: 'Distance, en km', dplus: 'D+, en m',
    vise: 'Ce que tu vises',
    viseChoix: [
      { cle: 'finir', titre: 'Finir' }, { cle: 'chrono', titre: 'Un chrono' }, { cle: 'progresser', titre: 'Progresser' }, { cle: 'autre', titre: 'Autre' },
    ] as Choix[],
    viseAutre: 'Dis-le en quelques mots',
  },
  dispos: {
    titre: 'Tes disponibilités',
    jours: 'Les jours où tu peux t’entraîner',
    tempsSeance: 'Le temps d’une séance en semaine',
    tempsChoix: [
      { cle: 'moins_45', titre: 'Moins de 45 min' }, { cle: '45_60', titre: '45 min à 1 h' }, { cle: '60_90', titre: '1 h à 1 h 30' }, { cle: 'plus_90', titre: 'Plus de 1 h 30' },
    ] as Choix[],
    jourSl: 'Le jour possible pour la sortie longue',
    jourSlIndifferent: 'Peu importe',
  },
  montre: {
    titre: 'Ta montre',
    type: 'Ta montre',
    typeChoix: [
      { cle: 'gps_fc', titre: 'GPS avec FC' }, { cle: 'gps', titre: 'GPS sans FC' }, { cle: 'aucune', titre: 'Pas de montre' },
    ] as Choix[],
    nolio: 'Un compte Nolio',
    nolioChoix: [{ cle: 'oui', titre: 'Oui' }, { cle: 'non', titre: 'Non' }, { cle: 'sais_pas', titre: 'Je ne sais pas' }] as Choix[],
  },
  attentes: { titre: 'Ce que tu attends d’un coach', label: 'En quelques mots, si tu veux', facultatif: 'Facultatif' },
  sante: {
    titre: 'Ta santé',
    facultatif: 'Facultatif',
    label: 'Une douleur ou une blessure des 12 derniers mois, ou un suivi médical qui compte pour l’entraînement',
    consentement: 'J’accepte que City to Summit garde ces informations de santé pour préparer notre appel et mon coaching. Sans suite, elles sont effacées 3 mois après ma demande.',
    sansCase: 'Sans cette case, rien sur ta santé n’est envoyé ni gardé : tu peux en parler au téléphone.',
  },
  appel: {
    titre: 'Pour t’appeler',
    telephone: 'Ton téléphone',
    moments: 'Les moments où tu peux répondre',
    momentsAide: 'Au moins un.',
    mot: 'Un mot pour moi',
  },
  envoyer: 'Envoyer ma demande',
  metAJour: 'Mettre ma demande à jour',
  apres: 'C’est envoyé. Je t’appelle dans la semaine, à l’un des moments que tu as choisis.',
  apresSuite: 'En attendant, continue à courir comme d’habitude : ton profil, tes courses et la bibliothèque restent là.',
  deja: 'Ta demande est déjà envoyée. Tu peux la mettre à jour : elle remplace la précédente.',
  ensuite: 'Un appel, pour voir si on peut travailler ensemble. Aucun engagement.',
  effacement: 'Une demande sans suite est effacée au bout de 3 mois. Tu peux aussi l’effacer toi-même, à tout moment, depuis ton compte.',
  compte: {
    titre: 'Ta demande de coaching',
    envoyeeLe: (date: string) => `Envoyée le ${date}.`,
    effacer: 'Effacer ma demande',
    efface: 'Ta demande est effacée.',
  },
};

// ─── Les jours et les moments d'appel ─────────────────────────────────────────────────────────────────────────────────
export const JOURS = [
  { cle: 'lun', titre: 'Lundi', court: 'L' }, { cle: 'mar', titre: 'Mardi', court: 'M' }, { cle: 'mer', titre: 'Mercredi', court: 'M' },
  { cle: 'jeu', titre: 'Jeudi', court: 'J' }, { cle: 'ven', titre: 'Vendredi', court: 'V' }, { cle: 'sam', titre: 'Samedi', court: 'S' },
  { cle: 'dim', titre: 'Dimanche', court: 'D' },
] as const;
export const PLAGES = [{ cle: 'matin', titre: 'Matin' }, { cle: 'midi', titre: 'Midi' }, { cle: 'soir', titre: 'Soir' }] as const;
const CLES_JOURS = JOURS.map((j) => j.cle) as readonly string[];
export const CLES_MOMENTS: string[] = JOURS.flatMap((j) => PLAGES.map((p) => `${j.cle}_${p.cle}`));

// « lun_matin » en « lundi matin ».
export function momentEnClair(cle: string): string {
  const [j, p] = cle.split('_');
  const jour = JOURS.find((x) => x.cle === j)?.titre.toLowerCase();
  const plage = PLAGES.find((x) => x.cle === p)?.titre.toLowerCase();
  return jour && plage ? `${jour} ${plage}` : cle;
}
// Les moments de la semaine, rangés dans l'ordre du lundi au dimanche : « lundi matin, mercredi soir ».
export const momentsEnClair = (moments: string[]) => CLES_MOMENTS.filter((m) => moments.includes(m)).map(momentEnClair).join(', ');

// ─── Ce que garde la demande ──────────────────────────────────────────────────────────────────────────────────────────
export type ObjectifDemande =
  | { kind: 'aucune' }
  | { kind: 'app'; course_id: string; nom: string; date: string | null; distance_km: number | null; dplus_m: number | null }
  | { kind: 'libre'; nom: string; date: string | null; distance_km: number | null; dplus_m: number | null };

export type ReponsesCoaching = {
  nom: string; naissance: number; ville: string;
  course_depuis: string; experience_trail: Experience | null; courses_marquantes: string;
  seances: string; heures: number; longue: string;
  terrain: string[]; dplus_pres: string; montagne: string;
  // La plus longue côte, en minutes (un nombre d'au moins 1) ; vide si elle n'est pas donnée (une demande d'avant le 23/11/2026).
  cote_min: string;
  objectif: ObjectifDemande; vise: string; vise_autre: string;
  jours: string[]; temps_seance: string; jour_sl: string;
  montre: string; nolio: string;
  attentes: string; mot: string;
};

export type DemandeLue = {
  reponses: ReponsesCoaching;
  // La santé : texte ET date du consentement, ou ni l'un ni l'autre.
  sante: string | null; consentementSante: boolean;
  moments: string[]; telephone: string;
};

const cles = (choix: Choix[]) => choix.map((c) => c.cle);
const Q = QUESTIONS_COACHING;
const dans = (choix: Choix[], v: unknown): v is string => typeof v === 'string' && cles(choix).includes(v);
const texte = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
// Un texte long garde ses retours à la ligne.
const paragraphes = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max) : '');
const nombre = (v: unknown): number | null => {
  const n = Number(String(v ?? '').trim().replace(/\s/g, '').replace(',', '.'));
  return String(v ?? '').trim() !== '' && Number.isFinite(n) ? n : null;
};

// Un numéro de téléphone : des chiffres, un « + » devant au besoin, 9 à 15 chiffres ; les espaces, points et tirets se perdent.
export function lireTelephone(v: unknown): string | null {
  const brut = typeof v === 'string' ? v.trim() : '';
  if (!/^\+?[\d\s.\-()]+$/.test(brut)) return null;
  const chiffres = brut.replace(/\D/g, '');
  if (chiffres.length < 9 || chiffres.length > 15) return null;
  return `${brut.startsWith('+') ? '+' : ''}${chiffres}`;
}
// Un numéro à l'écran : « 06 12 34 56 78 » pour un numéro français, tel quel sinon.
export function telephoneEnClair(t: string): string {
  const m = /^(?:0|\+33)(\d)(\d{8})$/.exec(t);
  return m ? `0${m[1]} ${m[2].replace(/(\d{2})(?=\d)/g, '$1 ').trim()}` : t;
}

const dateIso = (v: unknown): string | null => {
  const t = typeof v === 'string' ? v.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t ? null : t;
};

// Ce que le navigateur envoie, lu et contrôlé. experienceConnue : l'expérience du profil gratuit (alors non redemandée) ;
// courseDuCompte : la course de l'app choisie, relue en base (le serveur ne croit pas le nom ni la date envoyés) ou null.
export function lireDemande(
  brut: unknown,
  options: { experienceConnue: Experience | null; anneeCourante: number; coursesDuCompte: { id: string; nom: string; date: string | null; distance_km: number | null; dplus_m: number | null }[] },
): { ok: true; demande: DemandeLue } | { ok: false; message: string } {
  const o = (brut && typeof brut === 'object' ? brut : {}) as Record<string, any>;
  const manque = (quoi: string) => ({ ok: false as const, message: `Il manque ${quoi}.` });
  const nom = texte(o.nom, 100);
  if (nom.length < 2) return manque('ton prénom et ton nom');
  const naissance = nombre(o.naissance);
  if (naissance === null || !Number.isInteger(naissance) || naissance < 1930 || naissance > options.anneeCourante - 15)
    return { ok: false, message: 'Ton année de naissance n’est pas valide : quatre chiffres, par exemple 1988.' };
  const ville = texte(o.ville, 80);
  if (!ville) return manque('ta ville');
  if (!dans(Q.vecu.depuisChoix, o.course_depuis)) return manque('depuis combien de temps tu cours');
  let experience: Experience | null = options.experienceConnue;
  if (!experience) {
    if (!estExperience(o.experience_trail)) return manque('ton expérience en trail');
    experience = o.experience_trail;
  }
  if (!dans(Q.semaine.seancesChoix, o.seances)) return manque('ton nombre de séances par semaine');
  const heures = nombre(o.heures);
  if (heures === null || heures < 0 || heures > 40) return { ok: false, message: 'Tes heures par semaine ne sont pas valides : un nombre, par exemple 5 ou 5,5.' };
  const terrain = (Array.isArray(o.terrain) ? o.terrain : []).filter((x: unknown): x is string => dans(Q.terrain.presChoix, x));
  if (!dans(Q.terrain.montagneChoix, o.montagne)) return manque('ta fréquence en montagne');
  // La côte : facultative, mais lue ou refusée (« douze » n'est pas deviné).
  const coteDonnee = o.cote_min != null && String(o.cote_min).trim() !== '';
  const cote = coteDonnee ? lireCote(o.cote_min) : '';
  if (cote === null) return { ok: false, message: TEXTES_COTE.illisible };

  // L'objectif : une course de l'app (relue en base), une autre course, ou pas encore de course.
  let objectif: ObjectifDemande;
  const ob = (o.objectif && typeof o.objectif === 'object' ? o.objectif : {}) as Record<string, any>;
  if (ob.kind === 'app') {
    const c = options.coursesDuCompte.find((x) => x.id === ob.course_id);
    if (!c) return { ok: false, message: 'Cette course n’est pas dans ton compte : choisis-en une autre.' };
    objectif = { kind: 'app', course_id: c.id, nom: c.nom, date: c.date, distance_km: c.distance_km, dplus_m: c.dplus_m };
  } else if (ob.kind === 'libre') {
    const nomCourse = texte(ob.nom, 120);
    if (!nomCourse) return manque('le nom de ta course');
    const date = ob.date ? dateIso(ob.date) : null;
    if (ob.date && !date) return { ok: false, message: 'La date de ta course n’est pas valide.' };
    const km = ob.distance_km === '' || ob.distance_km == null ? null : nombre(ob.distance_km);
    const dp = ob.dplus_m === '' || ob.dplus_m == null ? null : nombre(ob.dplus_m);
    if ((km !== null && (km <= 0 || km > 1000)) || (dp !== null && (dp < 0 || dp > 50000)))
      return { ok: false, message: 'La distance ou le D+ de ta course n’est pas valide : des nombres, en km et en mètres.' };
    objectif = { kind: 'libre', nom: nomCourse, date, distance_km: km, dplus_m: dp === null ? null : Math.round(dp) };
  } else if (ob.kind === 'aucune') objectif = { kind: 'aucune' };
  else return manque('ton objectif (ou « pas encore de course »)');
  if (!dans(Q.objectif.viseChoix, o.vise)) return manque('ce que tu vises');
  const viseAutre = o.vise === 'autre' ? texte(o.vise_autre, 200) : '';

  const jours = CLES_JOURS.filter((j) => Array.isArray(o.jours) && o.jours.includes(j));
  if (!jours.length) return manque('les jours où tu peux t’entraîner');
  if (!dans(Q.dispos.tempsChoix, o.temps_seance)) return manque('le temps d’une séance en semaine');
  const jourSl = o.jour_sl === 'peu_importe' || (typeof o.jour_sl === 'string' && CLES_JOURS.includes(o.jour_sl)) ? String(o.jour_sl) : 'peu_importe';
  if (!dans(Q.montre.typeChoix, o.montre)) return manque('ta montre');
  if (!dans(Q.montre.nolioChoix, o.nolio)) return manque('ta réponse sur Nolio');

  const telephone = lireTelephone(o.telephone);
  if (!telephone) return { ok: false, message: 'Ton téléphone n’est pas valide : un numéro avec ses 10 chiffres, par exemple 06 12 34 56 78.' };
  const moments = CLES_MOMENTS.filter((m) => Array.isArray(o.moments) && o.moments.includes(m));
  if (!moments.length) return manque('au moins un moment où t’appeler');

  // La santé : sans la case, ni le texte ni la date ne partent ; avec la case et un texte, les deux.
  const sante = o.consentement_sante === true ? paragraphes(o.sante, 1500) : '';

  return {
    ok: true,
    demande: {
      reponses: {
        nom, naissance, ville, course_depuis: o.course_depuis, experience_trail: options.experienceConnue ? null : experience,
        courses_marquantes: paragraphes(o.courses_marquantes, 400),
        seances: o.seances, heures: Math.round(heures * 10) / 10, longue: texte(o.longue, 120),
        terrain, dplus_pres: texte(o.dplus_pres, 60), montagne: o.montagne, cote_min: String(cote),
        objectif, vise: o.vise, vise_autre: viseAutre,
        jours, temps_seance: o.temps_seance, jour_sl: jourSl, montre: o.montre, nolio: o.nolio,
        attentes: paragraphes(o.attentes, 800), mot: paragraphes(o.mot, 400),
      },
      sante: sante || null, consentementSante: Boolean(sante), moments, telephone,
    },
  };
}

// ─── Le titre d'une réponse, pour le coach ────────────────────────────────────────────────────────────────────────────
// Les choix d'avant le 23/11/2026, qu'une demande déjà envoyée garde : lus, plus posés.
const TITRES_D_AVANT: Record<string, string> = { montees_longues: 'Montées de plus de 10 minutes', cotes_courtes: 'Côtes courtes' };
const titreDe = (choix: Choix[], cle: string) => choix.find((c) => c.cle === cle)?.titre ?? TITRES_D_AVANT[cle] ?? cle;
export const enClair = {
  depuis: (c: string) => titreDe(Q.vecu.depuisChoix, c),
  seances: (c: string) => titreDe(Q.semaine.seancesChoix, c),
  terrain: (c: string) => titreDe(Q.terrain.presChoix, c),
  montagne: (c: string) => titreDe(Q.terrain.montagneChoix, c),
  // « 12 min » ; null si la demande ne la donne pas.
  cote: (c: unknown) => coteEnClair(c),
  vise: (c: string) => titreDe(Q.objectif.viseChoix, c),
  tempsSeance: (c: string) => titreDe(Q.dispos.tempsChoix, c),
  montre: (c: string) => titreDe(Q.montre.typeChoix, c),
  nolio: (c: string) => titreDe(Q.montre.nolioChoix, c),
  jour: (c: string) => (c === 'peu_importe' ? Q.dispos.jourSlIndifferent : JOURS.find((j) => j.cle === c)?.titre ?? c),
  experience: (c: Experience | null) => EXPERIENCES.find((e) => e.cle === c)?.titre ?? null,
};

// Une course en une ligne : « Trail de la Côte sauvage · 14 mars 2027 · 18 km · 540 m D+ ».
export function objectifEnClair(ob: ObjectifDemande): string {
  if (ob.kind === 'aucune') return 'Pas encore de course';
  const date = ob.date ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(`${ob.date}T12:00:00Z`)).replace(/^1 /, '1er ') : null;
  const km = ob.distance_km != null ? `${ob.distance_km.toLocaleString('fr-FR')} km` : null;
  const dp = ob.dplus_m != null ? `${ob.dplus_m.toLocaleString('fr-FR')} m D+` : null;
  return [ob.nom, date, km, dp].filter(Boolean).join(' · ');
}

// Le profil d'une demande sans objectif lu : les réponses d'un objet quelconque de la base, relues (la forme d'une ligne ancienne).
export function reponsesSures(brut: unknown): Partial<ReponsesCoaching> {
  return (brut && typeof brut === 'object' ? brut : {}) as Partial<ReponsesCoaching>;
}

// ─── L'effacement à 3 mois ────────────────────────────────────────────────────────────────────────────────────────────
// Une demande non acceptée s'efface 3 mois après son envoi (le passage quotidien). La borne : tout ce qui a été envoyé avant.
export const MOIS_DE_GARDE = 3;
// Décaler de n mois, le jour du mois gardé (le 31 mai moins 3 mois : le 28 février, pas le 3 mars).
function decaler(d: Date, mois: number): Date {
  const x = new Date(d.getTime());
  const jour = x.getUTCDate();
  x.setUTCDate(1);
  x.setUTCMonth(x.getUTCMonth() + mois);
  const dernier = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  x.setUTCDate(Math.min(jour, dernier));
  return x;
}
export const bornePourEffacer = (maintenant: Date): string => decaler(maintenant, -MOIS_DE_GARDE).toISOString();
// La date où une demande envoyée s'efface, pour le dire à la personne.
export const effaceeLe = (envoyeeLe: string): string => decaler(new Date(envoyeeLe), MOIS_DE_GARDE).toISOString();

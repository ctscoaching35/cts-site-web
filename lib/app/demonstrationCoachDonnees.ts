/**
 * Les données de la démonstration de l'espace coach (lib/app/demonstrationCoach.ts), en développement seulement :
 * lib/app/exemples/coach.json (scripts/demonstration-coach.py : dix coachés fictifs, leurs objectifs pris dans le corpus
 * du moteur, leurs semaines écrites par le moteur), lu sur le disque, puis rangé en tables, en Nolio et en moteur pour
 * l'instant simulé : ce qui n'a pas encore eu lieu (une semaine écrite dimanche soir, une séance de jeudi) reste caché ;
 * les signaux gardés du soir se calculent comme le passage du soir les calcule (signauxSuivi.ts). Jamais importé en
 * production : demonstrationCoach.ts ne le charge que la porte ouverte.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COACH_DEMONSTRATION, LUNDI_DEMONSTRATION } from './demonstrationCoachPorte';
import { QUESTIONNAIRE_SEMAINE } from './ecriture';
import { ajouterJours } from './plan';
import { signaux, type Prevue, type Realisee, type Seuils, type ValeurHooper } from './signauxSuivi';

type Ligne = Record<string, unknown>;
type Athlete = {
  id: string; nom: string; profil?: string; k?: number; scenario: string; app?: boolean; pas_demarre?: boolean;
  sans_accord?: boolean; reperes: [number, number, number, number] | null; mot?: string; couru?: string; fond?: string;
  course_b?: { nom: string; date: string; distance_km: number; dplus_m: number };
  course_a?: { nom: string; date: string; distance_km: number; dplus_m: number };
  champs: Record<string, unknown>;
};
type Donnees = {
  lundi: string; seuils: Seuils; version_moteur: string; athletes: Athlete[]; plans: Ligne[]; semaines_ecrites: Ligne[];
  nolio_envois: Ligne[]; apercus: { plan_id: string; numero: string; des: string; sortie: unknown }[];
  nolio: Record<string, { prevues: Ligne[]; reelles: Ligne[]; hooper: Ligne[] }>;
};

let lues: Donnees | null = null;
function donnees(): Donnees {
  if (lues) return lues;
  const d = JSON.parse(readFileSync(join(process.cwd(), 'lib', 'app', 'exemples', 'coach.json'), 'utf8')) as Donnees;
  if (d.lundi !== LUNDI_DEMONSTRATION) {
    throw new Error(`coach.json est fait pour la semaine du ${d.lundi}, la démonstration attend celle du ${LUNDI_DEMONSTRATION} : aligne LUNDI_DEMONSTRATION.`);
  }
  lues = d;
  return d;
}

const COACH = COACH_DEMONSTRATION.compteId;
const USR_COACH = 'usr_democoach';
const usr = (a: Pick<Athlete, 'id'>) => `usr_${a.id.replace('-', '')}`;
const prenom = (nom: string) => nom.split(' ')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const compteDe = (a: Athlete) => (a.app ? `demo-compte-${a.id.slice(5)}` : null);
const visible = (maintenant: number) => (l: Ligne) => !l._des || Date.parse(String(l._des)) <= maintenant;
const sansInterne = (l: Ligne): Ligne => Object.fromEntries(Object.entries(l).filter(([k]) => !k.startsWith('_')));
const jourParis = (t: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(t));

// Les acheteurs de plans (« Chiffres », onglet Plans), fictifs eux aussi, et un membre de l'équipe Nolio sans fiche.
const ACHETEURS = [
  { id: 'demo-achat-perrin', nom: 'Lucas Perrin', course: 'GRF18', date: '2027-06-05', statut: 'actif', demarre: '2026-10-25T17:05:00.000Z', accord: true },
  { id: 'demo-achat-vidal', nom: 'Emma Vidal', course: 'Les Lucioles', date: '2027-06-05', statut: 'invite', demarre: null, accord: false },
];
const SANS_FICHE = { id: 'usr_demoromane', name: 'Romane Leroy' };

export function comptes(): Record<string, string> {
  return Object.fromEntries(donnees().athletes.filter((a) => a.app)
    .map((a) => [compteDe(a) as string, `${prenom(a.nom)}.${prenom(a.nom.split(' ').slice(1).join(' '))}@demonstration.test`]));
}

export function seuils(): Seuils {
  return donnees().seuils;
}

// ─── Les tables ───────────────────────────────────────────────────────────────────────────────────────────────────

let gardees: { minute: number; tables: Record<string, Ligne[]> } | null = null;

export function tables(): Record<string, Ligne[]> {
  const maintenant = Date.now();
  const minute = Math.floor(maintenant / 60_000);
  if (gardees?.minute === minute) return gardees.tables;
  const d = donnees();
  const vu = visible(maintenant);
  const lundi = d.lundi;
  const fiches: Ligne[] = d.athletes.map((a) => {
    const [fc1, vc, fc2, v1] = a.reperes ?? [null, null, null, null];
    const c = a.champs;
    return {
      id: a.id, coach_id: COACH, nom: a.nom, nolio_athlete_id: usr(a), fc_seuil1: fc1, vc_ms: vc, fc_seuil2: fc2, v_seuil1_ms: v1,
      d_prime_m: null, compte_id: compteDe(a), mode: 'coaching', mode_le: null, programmation: 'auto',
      // Son week-end posé dans Nolio jusqu'au dimanche suivant ; un mot à la question ouverte du samedi.
      questionnaires: { jusqua: a.pas_demarre ? null : ajouterJours(lundi, 13), mot_le: a.mot ?? null, mot_note: a.mot ? `${a.mot}T09:00:00.000Z` : null },
      profil: { niveau: c.niveau, terrain: c.terrain, jours_disponibles: c.jours_disponibles, jour_sl: c.jour_sl, freq_hebdo: c.freq_hebdo },
      reperes_sources: a.reperes ? { fc_seuil1: { le: '2026-09-12', source: 'test' }, vc_ms: { le: '2026-09-12', source: 'test' },
        fc_seuil2: { le: '2026-10-03', source: 'coach' } } : {},
      cree_le: '2026-09-01T10:00:00.000Z',
    };
  });
  const plans: Ligne[] = [
    ...d.plans.map((p) => ({
      ...p, compte_id: COACH, coach_id: COACH, nolio_statut: null, nolio_athlete_id: null, accord_lecture_le: null, achat_id: null,
      etat_ecriture: null, pdf_chemin: null,
      // La fiche de course de sa course de préparation (PO3).
      fiches_preparation: Object.fromEntries((((p.parametres as Ligne).courses_secondaires ?? []) as { date: string }[]).map((c) => [c.date, {}])),
    })),
    ...ACHETEURS.map((a) => ({
      id: a.id, compte_id: `demo-compte-${a.id}`, coach_id: COACH, course_nom: a.course, course_date: a.date, nolio_statut: a.statut,
      demarre_le: a.demarre, accord_lecture_le: a.accord ? '2026-10-20T08:00:00.000Z' : null, nolio_athlete_id: `usr_${a.id.replace(/-/g, '')}`,
      achat_id: a.id, donnees: { athlete: { nom: a.nom } }, parametres: null, intake: {}, cree_le: '2026-10-20T08:00:00.000Z',
    })),
  ];
  const ecrites = d.semaines_ecrites.filter(vu).map((l) => ({
    ...l, realise: l._realise_des && Date.parse(String(l._realise_des)) > maintenant ? null : l.realise,
  }));
  const t: Record<string, Ligne[]> = {
    comptes: [{ id: COACH, nom: 'Coach Démonstration' }],
    athletes_coaches: fiches,
    coaching: d.plans.map((p) => ({ plan_id: p.id, coach_id: COACH, athlete_id: p.athlete_id,
      athlete_nom: d.athletes.find((a) => a.id === p.athlete_id)?.nom ?? '' })),
    plans,
    semaines_ecrites: ecrites,
    nolio_envois: d.nolio_envois.filter(vu),
    nolio_accords: d.athletes.filter((a) => !a.sans_accord).map((a) => ({ coach_id: COACH, nolio_athlete_id: usr(a), accord_le: '2026-09-15T18:00:00.000Z' })),
    objectifs_demandes: [{
      id: 'demo-demande-antoine', athlete_id: 'demo-antoine', coach_id: COACH, statut: 'a_valider', plan_id: null, gpx_chemin: null,
      cree_le: '2026-11-10T19:12:00.000Z', _des: '2026-11-10T19:12:00.000Z',
      champs: { course_nom: 'Les Lucioles', date_course: '2027-05-29', distance_km: '14.7', dplus_m: '481', dmoins_m: '481', format: 'TC',
        temps_cible: '1h40', terrain: 'vallonne', jours_disponibles: ['mardi', 'jeudi', 'dimanche'], jour_sl: 'dimanche', freq_hebdo: '3' },
    }].filter(vu),
    signaux_suivi: signauxDuSoir(maintenant),
    retouches: retouches(lundi).filter(vu),
    mesures: mesures(lundi), achats: achats(lundi), relances: [{ accord_le: ajouterJours(lundi, -4) }, { accord_le: ajouterJours(lundi, -18) }],
    a_regarder_regles: [], corrections_semaine: [], tests_lus: [], semaines_athlete: [], zones: [], badges: [],
  };
  gardees = { minute, tables: t };
  return t;
}

// LES SIGNAUX GARDÉS DU SOIR (EC2) : ceux que le passage de 19 h 30 a calculés, au dernier soir passé, pour chaque coaché
// qui a donné son accord et dont un objectif ou une saison est en route ; le même calcul que le site (signaux()).
function signauxDuSoir(maintenant: number): Ligne[] {
  const d = donnees();
  const aujourdhui = jourParis(maintenant);
  const ceSoir = Date.parse(`${aujourdhui}T18:30:00.000Z`);
  const soir = ceSoir <= maintenant ? ceSoir : ceSoir - 86_400_000;
  const jour = jourParis(soir);
  const vu = visible(soir);
  const s = d.seuils;
  const debut = ajouterJours(jour, -(s.jours - 1));
  const entre = (de: string, a: string) => (l: Ligne) => String(l.date_start).slice(0, 10) >= de && String(l.date_start).slice(0, 10) <= a;
  return d.athletes.filter((a) => !a.sans_accord && !a.pas_demarre).map((a) => {
    const n = d.nolio[a.id];
    const prevues = n.prevues.filter(vu).filter(entre(ajouterJours(debut, -7), jour)).map(sansInterne) as Prevue[];
    const reelles = n.reelles.filter(vu).map(sansInterne);
    const suivi = signaux(prevues, reelles.filter(entre(debut, jour)) as Realisee[],
      n.hooper.filter(vu).filter(entre(ajouterJours(debut, -(7 * s.hooper_semaines + 3)), jour)).map(sansInterne) as ValeurHooper[], s, jour);
    const derniere = reelles.filter(entre(ajouterJours(jour, -35), jour)).map((r) => String(r.date_start).slice(0, 10)).sort().pop() ?? null;
    return { coach_id: COACH, nolio_athlete_id: usr(a), calcule_le: new Date(soir).toISOString(), prevues: suivi.prevues, faites: suivi.faites,
      hooper: suivi.hooper, signaux: suivi.signaux.map(({ genre, jour: j, detail }) => ({ genre, jour: j, detail })), derniere_activite: derniere };
  });
}

// Tes retouches dans Nolio, comptées chaque nuit (lib/app/retouches.ts) : des chiffres inventés, une ligne par semaine
// écrite et envoyée de chaque objectif (comme la table), sur 9 semaines. Plus elles sont récentes, moins elles sont
// retouchées : la part des semaines envoyées sans retouche monte au fil des dimanches (« Chiffres »).
function retouches(lundi: string): Ligne[] {
  const d = donnees();
  const lundis = Array.from({ length: 9 }, (_, i) => ajouterJours(lundi, -7 * i));
  const plans = d.plans.map((p) => String(p.id));
  const f = (envoyees: number, modifiees = 0, supprimees = 0, min = 0, ecart = 0) =>
    ({ envoyees, modifiees, supprimees, min_avant: modifiees ? min : 0, min_apres: modifiees ? Math.round(min * (1 + ecart)) : 0 });
  return d.semaines_ecrites.flatMap((e) => {
    const l = String((e.donnees as Ligne | null)?.lundi ?? '');
    const i = lundis.indexOf(l);
    if (i < 0) return [];
    const k = plans.indexOf(String(e.plan_id));
    // Retouchée : une sur deux il y a 5 à 8 semaines, une sur quatre ces 4 dernières, une sur cinq cette semaine.
    const retouchee = i >= 5 ? (k + i) % 2 === 0 : i >= 1 ? (k + i) % 4 === 0 : k % 5 === 0;
    const genre = (k + i) % 3;
    const familles = {
      ef: retouchee && genre === 0 ? f(3, 1, 0, 50, -0.12) : f(3),
      sl: retouchee && genre === 1 ? f(1, 1, 0, 120, -0.15) : f(1),
      [k % 2 ? 'seuil2' : 'vo2max']: retouchee && genre === 2 ? f(1, 0, 1) : f(1),
      renfo: f(1),
    };
    return [{ plan_id: e.plan_id, semaine: e.numero, coach_id: COACH, lundi: l, familles, ajoutees: retouchee && genre === 0 && i % 2 ? 1 : 0,
      _des: [String(e.ecrite_le), `${ajouterJours(l, 1)}T02:00:00.000Z`].sort().pop() }];
  });
}

// Le tunnel de la vente sur 12 semaines (« Chiffres », onglet Plans) : des compteurs inventés.
function mesures(lundi: string): Ligne[] {
  const lignes: Ligne[] = [];
  for (let i = 0; i < 12; i += 1) {
    const jour = ajouterJours(lundi, -7 * i + 2);
    const n = (base: number) => Math.max(0, base - i * 2 + ((i * 7) % 5));
    lignes.push({ jour, etape: 'offre', n: n(64) }, { jour, etape: 'questionnaire', n: n(23) }, { jour, etape: 'recap', n: n(12) },
      { jour, etape: 'paiement', n: n(5) }, { jour, etape: 'porte_niveau', n: i % 4 === 0 ? 1 : 0 },
      { jour, etape: 'porte_sortie_longue', n: i % 3 === 0 ? 2 : 1 }, { jour, etape: 'porte_temps', n: i % 5 === 0 ? 1 : 0 });
  }
  return lignes;
}
function achats(lundi: string): Ligne[] {
  return [3, 10, 17, 31, 52].map((j, i) => ({ paye_le: `${ajouterJours(lundi, -j)}T12:00:00.000Z`, montant_centimes: [5900, 7900, 9900, 5900, 7900][i],
    stripe_session: `cs_demo_${i}` }));
}

// ─── Nolio ────────────────────────────────────────────────────────────────────────────────────────────────────────

function equipe(): { id: string; name: string }[] {
  return [...donnees().athletes.map((a) => ({ id: usr(a), name: a.nom })), SANS_FICHE,
    ...ACHETEURS.map((a) => ({ id: `usr_${a.id.replace(/-/g, '')}`, name: a.nom }))];
}

// Ses compétitions dans Nolio : son objectif (course A), et celles que le coach y a posées sans objectif ici.
function competitions(a: Athlete): Ligne[] {
  const d = donnees();
  const p = d.plans.find((x) => x.athlete_id === a.id);
  const c = a.champs;
  const liste: Ligne[] = [];
  const km = (v: unknown) => Number(String(v ?? '').replace(',', '.')) || null;
  if (p && !a.fond) {
    liste.push({ id: `pcmp_${a.id.slice(5)}a`, name: String(p.course_nom), date_start: String(p.course_date), goal_type: 'a',
      distance: { value: km(c.distance_km) }, elevation_gain: { value: km(c.dplus_m) }, elevation_loss: { value: km(c.dmoins_m) } });
  }
  for (const [x, type] of [[a.course_b, 'b'], [a.course_a, 'a']] as const) {
    if (x) liste.push({ id: `pcmp_${a.id.slice(5)}${type}2`, name: x.nom, date_start: x.date, goal_type: type,
      distance: { value: x.distance_km }, elevation_gain: { value: x.dplus_m }, elevation_loss: { value: x.dplus_m } });
  }
  return liste;
}

// Son questionnaire du samedi (« Ta semaine prochaine »), rempli chaque samedi matin depuis son départ ; Nolio rend
// un jour par son rang.
function questionnaires(a: Athlete): Ligne[] {
  if (a.pas_demarre || a.id === 'demo-julien') return [];
  const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const c = a.champs;
  return [-30, -23, -16, -9, -2, 5].map((j) => {
    const samedi = ajouterJours(donnees().lundi, j);
    return {
      id: `qres_${a.id.slice(5)}${samedi.replace(/-/g, '')}`, name: QUESTIONNAIRE_SEMAINE.name, date_start: samedi, is_confirmed: true,
      _des: `${samedi}T07:30:00.000Z`,
      items: [
        { question: QUESTIONNAIRE_SEMAINE.items[0].question, value: ((c.jours_disponibles ?? []) as string[]).map((x) => JOURS.indexOf(x)) },
        { question: QUESTIONNAIRE_SEMAINE.items[1].question, value: JOURS.indexOf(String(c.jour_sl)) },
        { question: QUESTIONNAIRE_SEMAINE.items[2].question, value: Number(c.freq_hebdo) },
      ],
    };
  });
}

const liste = (data: Ligne[]) => ({ statut: 200, corps: { data, has_more: false } as Record<string, unknown> });

export function nolio(_methode: string, chemin: string): { statut: number; corps: Record<string, unknown> | null } {
  const d = donnees();
  const maintenant = Date.now();
  const vu = visible(maintenant);
  const [base, requete] = chemin.split('?');
  const q = new URLSearchParams(requete ?? '');
  const qui = q.get('athlete') ?? USR_COACH;
  const a = d.athletes.find((x) => usr(x) === qui);
  const de = q.get('date_from') ?? '0000-00-00';
  const a_ = q.get('date_to') ?? '9999-12-31';
  const dansLaPeriode = (l: Ligne) => String(l.date_start).slice(0, 10) >= de && String(l.date_start).slice(0, 10) <= a_;
  const servi = (lignes: Ligne[]) => liste(lignes.filter(vu).filter(dansLaPeriode).map(sansInterne));
  if (base === 'me/') return { statut: 200, corps: { id: USR_COACH, first_name: 'Coach', last_name: 'Démonstration' } };
  if (base === 'me/athletes/') return liste(equipe());
  if (base === 'metrics/items/') return liste([{ id: 'mtr_demohooper', key: 'INDICEHOOPER', name: 'Indice Hooper' }]);
  if (base === 'metrics/values/') return servi(a ? d.nolio[a.id].hooper : []);
  if (base === 'planned/trainings/') return servi(a ? d.nolio[a.id].prevues.map((p) => ({ ...p, revision: 'r1' })) : []);
  if (base === 'real/trainings/') return servi(a ? d.nolio[a.id].reelles : []);
  if (base === 'real/quiz_results/') return servi(a ? questionnaires(a) : []);
  if (base === 'planned/competitions/') return servi(a ? competitions(a) : []);
  const seance = /^planned\/trainings\/([^/]+)\/$/.exec(base);
  if (seance) {
    const p = a ? d.nolio[a.id].prevues.find((x) => x.id === seance[1]) : undefined;
    return p ? { statut: 200, corps: { ...sansInterne(p), workout: [] } } : { statut: 404, corps: { error: { code: 'not_found' } } };
  }
  const course = /^planned\/competitions\/([^/]+)\/$/.exec(base);
  if (course) {
    const c = a ? competitions(a).find((x) => x.id === course[1]) : undefined;
    return c ? { statut: 200, corps: c } : { statut: 404, corps: { error: { code: 'not_found' } } };
  }
  // Les notes, les bandeaux, les questionnaires posés, la bibliothèque : rien à lire en démonstration.
  return liste([]);
}

// ─── Le moteur ────────────────────────────────────────────────────────────────────────────────────────────────────

export function moteur(chemin: string, corps: unknown): unknown {
  const d = donnees();
  const c = (corps ?? {}) as { parametres?: { _demonstration?: string }; numero?: string };
  const planId = c.parametres?._demonstration;
  if (chemin === '/v1/trame') {
    const p = d.plans.find((x) => x.id === planId);
    if (p) return p.trame;
  }
  if (chemin === '/v1/semaine' || chemin === '/v1/recuperation') {
    const maintenant = Date.now();
    const choix = d.apercus.filter((x) => x.plan_id === planId && x.numero === c.numero && Date.parse(x.des) <= maintenant)
      .sort((x, y) => x.des.localeCompare(y.des)).pop();
    if (choix) return choix.sortie;
    throw new Error(`Démonstration : le moteur n’a pas écrit la semaine ${c.numero ?? '?'} de cet objectif pour ce jour-là (scripts/demonstration-coach.py).`);
  }
  throw new Error(`Démonstration : le moteur n’est pas appelé (${chemin}).`);
}

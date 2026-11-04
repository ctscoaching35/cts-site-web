/**
 * LA DÉMONSTRATION DE L'ESPACE COACH (04/11/2026) : l'espace coach parcouru avec dix coachés FICTIFS, pour le relire
 * écran par écran sans jamais lire les données d'un vrai coaché, et pour contrôler les écrans avant une mise en ligne.
 * Comme celle de l'app (lib/app/demonstration.ts), elle ne s'ouvre qu'en développement, et seulement tant que Supabase
 * n'est pas configuré.
 *
 * LA PORTE, FERMÉE EN PRODUCTION, trois fois :
 * - `next build` remplace process.env.NODE_ENV par « production » : la condition est fausse dans le code construit, et
 *   tout ce qui en dépend disparaît du paquet servi (Vercel, `next start`) ;
 * - le site en ligne a Supabase configuré (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) : il suffit qu'une
 *   des deux variables soit posée pour que la démonstration reste fermée, même en développement ;
 * - Vercel pose VERCEL=1 sur ses constructions et ses fonctions : fermée aussi.
 * Ouverte, elle ne donne accès à rien de réel : la base, Nolio et le moteur y sont remplacés par des données fabriquées
 * (lib/app/demonstrationCoachDonnees.ts, depuis lib/app/exemples/coach.json) ; rien ne s'écrit, rien ne part.
 *
 * Ce qu'elle remplace, aux seules frontières : la session (un coach fictif), le client Supabase (une base en mémoire,
 * en lecture), l'API Nolio (ce que Nolio aurait, en lecture ; toute écriture refusée), le moteur (les semaines qu'il a
 * écrites pour la démonstration), et l'heure : LE JOUR SIMULÉ (?jour=AAAA-MM-JJ ou AAAA-MM-JJTHH:MM, heure de Paris,
 * gardé dans un cookie par proxy.ts), de la semaine de démonstration, posé sur l'horloge du serveur de développement
 * pour que chaque page, chaque règle et chaque date tombent ce jour-là. Les écrans, eux, sont ceux du site, tels quels.
 */

export { COACH_DEMONSTRATION, COOKIE_JOUR, demonstrationCoachOuverte, JOUR_PAR_DEFAUT, jourValide, LUNDI_DEMONSTRATION, MOMENTS }
  from './demonstrationCoachPorte';
import { COACH_DEMONSTRATION, JOUR_PAR_DEFAUT, jourValide, COOKIE_JOUR } from './demonstrationCoachPorte';

const FORME_JOUR = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?$/;

type Globale = typeof globalThis & { __ctsDateReelle?: DateConstructor; __ctsDecalage?: number };
const globale = globalThis as Globale;
const DateReelle = (): DateConstructor => globale.__ctsDateReelle ?? Date;

// L'instant d'un « AAAA-MM-JJ[THH:MM] » à Paris (10 h sans heure).
export function instantDuJour(valeur: string): number {
  const m = FORME_JOUR.exec(valeur) ?? FORME_JOUR.exec(JOUR_PAR_DEFAUT)!;
  const [a, mo, j] = m[1].split('-').map(Number);
  const h = m[2] ? Number(m[2]) : 10;
  const mi = m[3] ? Number(m[3]) : 0;
  const R = DateReelle();
  const paris = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const voulu = `${m[1]} ${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
  for (const decalage of [60, 120, 0]) {
    const t = R.UTC(a, mo - 1, j, h, mi) - decalage * 60_000;
    if (paris.format(new R(t)) === voulu) return t;
  }
  return R.UTC(a, mo - 1, j, h, mi) - 3600_000;
}

// L'horloge du serveur de développement, décalée sur le jour simulé : Date (sans argument) et Date.now() rendent
// l'instant simulé, le temps continuant de courir à partir de lui. Posée une fois, à la première page coach.
function installerHorloge() {
  if (globale.__ctsDateReelle) return;
  const Reelle = Date;
  globale.__ctsDateReelle = Reelle;
  globale.__ctsDecalage = 0;
  const maintenant = () => Reelle.now() + (globale.__ctsDecalage ?? 0);
  function DateSimulee(this: unknown, ...args: unknown[]) {
    if (!new.target) return new Reelle(maintenant()).toString();
    return args.length ? new (Reelle as unknown as new (...a: unknown[]) => Date)(...args) : new Reelle(maintenant());
  }
  Object.setPrototypeOf(DateSimulee, Reelle);
  DateSimulee.prototype = Reelle.prototype;
  (DateSimulee as unknown as { now: () => number }).now = maintenant;
  globale.Date = DateSimulee as unknown as DateConstructor;
}

// Le jour simulé de cette visite, lu dans son cookie : l'horloge s'y pose. Rend sa valeur (« AAAA-MM-JJTHH:MM »).
export async function poserLeJourSimule(): Promise<string> {
  const { cookies } = await import('next/headers');
  const lu = (await cookies()).get(COOKIE_JOUR)?.value;
  const valeur = jourValide(lu) ? (lu as string) : JOUR_PAR_DEFAUT;
  installerHorloge();
  globale.__ctsDecalage = instantDuJour(valeur) - DateReelle().now();
  return valeur;
}

// Le jour simulé en clair, pour le bandeau : « mercredi 11 novembre 2026, 10 h 00 ».
export function jourSimuleEnClair(): string {
  return new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long',
    year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── La base en mémoire ───────────────────────────────────────────────────────────────────────────────────────────
// Un client Supabase de lecture : les filtres, le tri et les sélections dont le site se sert, sur les tables que
// construit lib/app/demonstrationCoachDonnees.ts pour l'instant simulé. Une écriture ne fait rien et réussit (rien ne
// s'enregistre en démonstration) ; une écriture qui demande sa ligne en retour n'en a pas.

type Ligne = Record<string, unknown>;
type Resultat = { data: unknown; error: { message: string } | null; count?: number | null };
const ERREUR = { message: 'Démonstration : rien ne s’enregistre.' };

// Les données ne sont jamais construites avec le site : la condition, fausse en production, retire l'import du paquet.
const donneesDemonstration = () => (process.env.NODE_ENV !== 'production' ? import('./demonstrationCoachDonnees')
  : Promise.reject(new Error('La démonstration de l’espace coach est fermée en production.')));

// Une colonne, ou un chemin JSON (« donnees->course->>distance_km ») : ->> rend du texte.
function valeurDe(l: Ligne, chemin: string): unknown {
  const morceaux = chemin.split(/->>?/);
  let v: unknown = l[morceaux[0].trim()];
  for (const m of morceaux.slice(1)) v = v && typeof v === 'object' ? (v as Ligne)[m.trim()] : undefined;
  if (chemin.includes('->>') && v !== undefined && v !== null && typeof v !== 'string') v = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return v === undefined ? null : v;
}
const estInstant = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);
function comparer(a: unknown, b: unknown): number {
  if (estInstant(a) && estInstant(b) && (String(a).includes('T') || String(b).includes('T'))) {
    return Date.parse(String(a)) - Date.parse(String(b));
  }
  if (typeof a === 'number' || typeof b === 'number') return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
}
const egal = (a: unknown, b: unknown) => a !== null && b !== null && a !== undefined && (a === b || String(a) === String(b));
// Un motif LIKE (« coach\_% » : « \_ » est un « _ » littéral).
const motif = (p: string, i = false) => new RegExp(`^${p.replace(/\\_/g, '\u0000').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  .replace(/%/g, '.*').replace(/_/g, '.').replace(/\u0000/g, '_')}$`, i ? 'i' : '');

// Les morceaux d'une sélection, au premier niveau (« id, plans(course_nom, course_date), lundi:donnees->>lundi »).
function morceaux(selection: string): string[] {
  const out: string[] = [];
  let profondeur = 0;
  let courant = '';
  for (const c of selection) {
    if (c === '(') profondeur += 1;
    if (c === ')') profondeur -= 1;
    if (c === ',' && profondeur === 0) {
      out.push(courant.trim());
      courant = '';
    } else courant += c;
  }
  if (courant.trim()) out.push(courant.trim());
  return out;
}

// Une table liée (« plans(course_nom) » depuis coaching) : sa ligne par la clé « plan_id ».
const CLES_LIEES: Record<string, string> = { plans: 'plan_id', athletes_coaches: 'athlete_id', comptes: 'compte_id' };

class Requete implements PromiseLike<Resultat> {
  private filtres: ((l: Ligne) => boolean)[] = [];
  private selection = '*';
  private compter = false;
  private tete = false;
  private tris: [string, boolean][] = [];
  private limite: number | null = null;
  private seule: 'une' | 'peut-etre' | null = null;
  private ecriture = false;
  private retour = false;

  constructor(private table: string) {}

  select(selection = '*', options?: { count?: string; head?: boolean }) {
    if (this.ecriture) this.retour = true;
    this.selection = selection;
    this.compter = Boolean(options?.count);
    this.tete = Boolean(options?.head);
    return this;
  }
  insert() { this.ecriture = true; return this; }
  upsert() { this.ecriture = true; return this; }
  update() { this.ecriture = true; return this; }
  delete() { this.ecriture = true; return this; }
  eq(c: string, v: unknown) { this.filtres.push((l) => egal(valeurDe(l, c), v)); return this; }
  neq(c: string, v: unknown) { this.filtres.push((l) => !egal(valeurDe(l, c), v)); return this; }
  in(c: string, vs: unknown[]) { this.filtres.push((l) => vs.some((v) => egal(valeurDe(l, c), v))); return this; }
  gt(c: string, v: unknown) { this.filtres.push((l) => valeurDe(l, c) !== null && comparer(valeurDe(l, c), v) > 0); return this; }
  gte(c: string, v: unknown) { this.filtres.push((l) => valeurDe(l, c) !== null && comparer(valeurDe(l, c), v) >= 0); return this; }
  lt(c: string, v: unknown) { this.filtres.push((l) => valeurDe(l, c) !== null && comparer(valeurDe(l, c), v) < 0); return this; }
  lte(c: string, v: unknown) { this.filtres.push((l) => valeurDe(l, c) !== null && comparer(valeurDe(l, c), v) <= 0); return this; }
  like(c: string, p: string) { this.filtres.push((l) => motif(p).test(String(valeurDe(l, c) ?? ''))); return this; }
  ilike(c: string, p: string) { this.filtres.push((l) => motif(p, true).test(String(valeurDe(l, c) ?? ''))); return this; }
  is(c: string, v: unknown) { this.filtres.push((l) => (v === null ? valeurDe(l, c) === null : valeurDe(l, c) === v)); return this; }
  not(c: string, op: string, v: unknown) {
    this.filtres.push((l) => {
      const x = valeurDe(l, c);
      if (op === 'is') return v === null ? x !== null : x !== v;
      if (op === 'like') return !motif(String(v)).test(String(x ?? ''));
      if (op === 'eq') return !egal(x, v);
      return true;
    });
    return this;
  }
  match(criteres: Record<string, unknown>) { for (const [c, v] of Object.entries(criteres)) this.eq(c, v); return this; }
  // Les « ou » des tâches du soir ne servent pas aux écrans du coach : rien n'est filtré.
  or() { return this; }
  filter(c: string, op: string, v: unknown) {
    return op === 'eq' ? this.eq(c, v) : op === 'neq' ? this.neq(c, v) : op === 'gte' ? this.gte(c, v) : op === 'lte' ? this.lte(c, v) : this;
  }
  order(c: string, options?: { ascending?: boolean }) { this.tris.push([c, options?.ascending !== false]); return this; }
  limit(n: number) { this.limite = n; return this; }
  range(de: number, a: number) { this.limite = a - de + 1; return this; }
  single() { this.seule = 'une'; return this; }
  maybeSingle() { this.seule = 'peut-etre'; return this; }
  returns() { return this; }
  throwOnError() { return this; }
  abortSignal() { return this; }

  private async executer(): Promise<Resultat> {
    if (this.ecriture) return this.retour && this.seule === 'une' ? { data: null, error: ERREUR } : { data: null, error: null };
    const { tables } = await donneesDemonstration();
    const toutes = tables();
    let lignes = (toutes[this.table] ?? []).filter((l) => this.filtres.every((f) => f(l)));
    for (const [c, asc] of [...this.tris].reverse()) {
      lignes = [...lignes].sort((a, b) => (asc ? 1 : -1) * comparer(valeurDe(a, c) ?? '', valeurDe(b, c) ?? ''));
    }
    if (this.limite !== null) lignes = lignes.slice(0, this.limite);
    const projetees = lignes.map((l) => this.projeter(l, toutes));
    if (this.tete) return { data: null, error: null, count: projetees.length };
    const compte = this.compter ? projetees.length : null;
    if (this.seule === 'une') {
      return projetees.length === 1 ? { data: projetees[0], error: null, count: compte }
        : { data: null, error: { message: 'Démonstration : aucune ligne' }, count: compte };
    }
    if (this.seule === 'peut-etre') {
      return projetees.length > 1 ? { data: null, error: { message: 'Démonstration : plusieurs lignes' } }
        : { data: projetees[0] ?? null, error: null, count: compte };
    }
    return { data: projetees, error: null, count: compte };
  }

  // La ligne entière, plus les chemins JSON et les tables liées que la sélection nomme.
  private projeter(l: Ligne, toutes: Record<string, Ligne[]>): Ligne {
    const out: Ligne = Object.fromEntries(Object.entries(l).filter(([k]) => !k.startsWith('_')));
    for (const m of morceaux(this.selection)) {
      const [alias, expr] = /^[a-z_]+:/i.test(m) && !m.startsWith('*') ? [m.slice(0, m.indexOf(':')), m.slice(m.indexOf(':') + 1)] : [null, m];
      const lie = /^([a-z_]+)(?:![a-z_]+)?\((.*)\)$/i.exec(expr.trim());
      if (lie) {
        const cle = CLES_LIEES[lie[1]] ?? `${lie[1].replace(/s$/, '')}_id`;
        const ligne = (toutes[lie[1]] ?? []).find((x) => egal(x.id, l[cle])) ?? null;
        out[alias ?? lie[1]] = ligne ? Object.fromEntries(Object.entries(ligne).filter(([k]) => !k.startsWith('_'))) : null;
      } else if (expr.includes('->')) {
        out[alias ?? expr.split(/->>?/).pop()!.trim()] = valeurDe(l, expr.trim());
      } else if (alias) {
        out[alias] = valeurDe(l, expr.trim());
      }
    }
    return out;
  }

  then<A = Resultat, B = never>(ok?: ((r: Resultat) => A | PromiseLike<A>) | null, ko?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return this.executer().then(ok, ko);
  }
}

// Les comptes de l'app des coachés fictifs (leur adresse, sur leur fiche).
async function utilisateur(id: string) {
  const { comptes } = await donneesDemonstration();
  const email = comptes()[id];
  return { data: { user: email ? { id, email } : null }, error: email ? null : { message: 'Démonstration : compte inconnu' } };
}

export function clientDemonstration() {
  const rien = async () => ({ data: null, error: null });
  return {
    from: (table: string) => new Requete(table),
    rpc: async () => ({ data: null, error: ERREUR }),
    storage: {
      from: () => ({
        download: async () => ({ data: null, error: ERREUR }), list: async () => ({ data: [], error: null }),
        remove: rien, upload: rien, createSignedUrl: async () => ({ data: null, error: ERREUR }),
      }),
    },
    auth: {
      getClaims: async () => ({ data: { claims: { sub: COACH_DEMONSTRATION.compteId, email: COACH_DEMONSTRATION.email } }, error: null }),
      getUser: async () => ({ data: { user: { id: COACH_DEMONSTRATION.compteId, email: COACH_DEMONSTRATION.email } }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signOut: rien, signInWithOtp: async () => ({ data: null, error: ERREUR }), verifyOtp: async () => ({ data: null, error: ERREUR }),
      admin: {
        getUserById: utilisateur, listUsers: async () => ({ data: { users: [] }, error: null }),
        createUser: async () => ({ data: null, error: ERREUR }), generateLink: async () => ({ data: null, error: ERREUR }),
        deleteUser: async () => ({ data: null, error: ERREUR }), updateUserById: async () => ({ data: null, error: ERREUR }),
      },
    },
  };
}

// ─── Nolio et le moteur ───────────────────────────────────────────────────────────────────────────────────────────

// Ce que Nolio aurait répondu : lu dans les données de la démonstration ; toute écriture refusée.
export async function nolioDemonstration(methode: string, chemin: string): Promise<{ statut: number; corps: Record<string, unknown> | null }> {
  return (await donneesDemonstration()).nolio(methode, chemin);
}

// Ce que le moteur a écrit pour la démonstration (les semaines de l'aperçu, la trame) ; rien d'autre ne lui est demandé.
export async function moteurDemonstration<T>(chemin: string, corps: unknown): Promise<T> {
  return (await donneesDemonstration()).moteur(chemin, corps) as T;
}

export async function seuilsDemonstration() {
  return (await donneesDemonstration()).seuils();
}

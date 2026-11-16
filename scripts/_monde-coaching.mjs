/**
 * Le « monde » des tests du lot A2 de l'app gratuite (demande de coaching, liste e-mail) : de quoi charger les modules sous Node
 * sans Next ni Supabase. Une petite base en mémoire (des tables, des filtres eq / neq / lt, insert, upsert, update, delete)
 * à la place de Supabase ; les pièces qui parlent à Nolio, à l'e-mail du coach et à l'invitation sont des espions.
 * Le test règle globalThis.__monde2.
 */
export const monde = () => globalThis.__monde2;

// ─── next/headers, next/navigation, next/cache, react ─────────────────────────────────────────────────────────────────
export const cookies = async () => ({ get: (k) => (monde().cookies[k] ? { value: monde().cookies[k] } : undefined) });
export class Redirection extends Error { constructor(vers) { super(`redirect ${vers}`); this.vers = vers; } }
export class Introuvable extends Error { constructor() { super('notFound'); } }
export const redirect = (vers) => { throw new Redirection(vers); };
export const notFound = () => { throw new Introuvable(); };
export const revalidatePath = (chemin) => monde().revalidations.push(chemin);
export const cache = (f) => f;

// ─── Une base en mémoire ──────────────────────────────────────────────────────────────────────────────────────────────
let compteur = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++compteur).padStart(12, '0')}`;

export function creerBase(tables = {}) {
  const base = { tables: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.map((x) => ({ ...x }))])), journal: [] };
  const lignes = (nom) => (base.tables[nom] ??= []);
  base.from = (nom) => {
    const op = { type: 'select', filtres: [], donnees: null, retour: false, conflit: null, tri: null };
    const q = {
      select(_cols, options) { if (op.type !== 'select') op.retour = true; else if (options?.head) op.head = true; return q; },
      insert(d) { op.type = 'insert'; op.donnees = d; return q; },
      upsert(d, options) { op.type = 'upsert'; op.donnees = d; op.conflit = options?.onConflict ?? null; op.ignorer = Boolean(options?.ignoreDuplicates); return q; },
      update(d) { op.type = 'update'; op.donnees = d; return q; },
      delete() { op.type = 'delete'; return q; },
      eq(c, v) { op.filtres.push((x) => x[c] === v); return q; },
      neq(c, v) { op.filtres.push((x) => x[c] !== v); return q; },
      lt(c, v) { op.filtres.push((x) => x[c] != null && x[c] < v); return q; },
      not() { return q; },
      is(c, v) { op.filtres.push((x) => (x[c] ?? null) === v); return q; },
      order() { return q; },
      limit() { return q; },
      async maybeSingle() { const r = await q.then((x) => x); return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error }; },
      async single() { const r = await q.maybeSingle(); return r.data ? r : { data: null, error: { message: 'aucune ligne' } }; },
      then(ok, ko) { return Promise.resolve(executer()).then(ok, ko); },
    };
    function executer() {
      const t = lignes(nom);
      const choisies = () => t.filter((x) => op.filtres.every((f) => f(x)));
      base.journal.push({ table: nom, type: op.type, donnees: op.donnees, nb: op.type === 'select' ? undefined : undefined });
      if (monde().erreurs?.[`${nom}:${op.type}`]) return { data: null, error: { message: monde().erreurs[`${nom}:${op.type}`] } };
      if (op.type === 'select') {
        const r = choisies();
        return op.head ? { data: null, count: r.length, error: null } : { data: r.map((x) => ({ ...x })), error: null };
      }
      if (op.type === 'insert') {
        const nouvelle = { id: uuid(), ...op.donnees };
        t.push(nouvelle);
        return { data: op.retour ? [{ ...nouvelle }] : null, error: null };
      }
      if (op.type === 'upsert') {
        const c = op.conflit;
        const existante = c ? t.find((x) => x[c] === op.donnees[c]) : null;
        if (existante) { if (!op.ignorer) Object.assign(existante, op.donnees); return { data: null, error: null }; }
        t.push({ id: uuid(), ...op.donnees });
        return { data: null, error: null };
      }
      if (op.type === 'update') {
        const r = choisies();
        r.forEach((x) => Object.assign(x, op.donnees));
        return { data: op.retour ? r.map((x) => ({ ...x })) : null, error: null };
      }
      const r = choisies();
      base.tables[nom] = t.filter((x) => !r.includes(x));
      return { data: op.retour ? r.map((x) => ({ ...x })) : null, error: null };
    }
    return q;
  };
  return base;
}

// ─── supabase.ts : la session (le compte connecté) et la clé de service (le serveur) ──────────────────────────────────
export const supabaseConfigure = () => monde().supabase !== false;
export const clientServeur = async () => ({
  auth: {
    getClaims: async () => ({ data: monde().session ? { claims: monde().session } : null }),
    signInWithOtp: async () => ({ error: null }),
  },
  // La session ne voit que SES lignes (les règles de la base) : ici, seulement la table du compte, filtrée par l'appelant.
  from: (nom) => monde().base.from(nom),
});
export const clientService = () => ({
  from: (nom) => monde().base.from(nom),
  auth: { admin: { getUserById: async (id) => ({ data: { user: { id, email: monde().emails?.[id] ?? null } } }), deleteUser: async (id) => { monde().appels.push(`deleteUser:${id}`); return { error: null }; } } },
  storage: { from: () => ({ list: async () => ({ data: [] }), remove: async () => ({}) }) },
});

// ─── nolio.ts, demandes.ts, contexte.ts, demonstrationPorte.ts ────────────────────────────────────────────────────────
export const coachs = () => (process.env.CTS_COACHS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
export const coachConnecte = async () => { monde().appels.push('coachConnecte'); return monde().coach ?? null; };
export const plansDuCompte = async () => monde().plans ?? [];
export const ficheDuCompte = async (compteId) => {
  const f = (monde().base.tables.athletes_coaches ?? []).find((x) => x.compte_id === compteId && x.mode !== 'plan');
  return f ? { id: f.id, coach_id: f.coach_id, nom: f.nom } : null;
};
export const demonstrationOuverte = () => false;

// ─── ecriture.ts (prevenirCoach), espaceAthlete.ts (ouvrirEspace, adresseDuCompte), nolio : des espions ───────────────────
export const prevenirCoach = async (sujet, texte, coachId = null) => { monde().mails.push({ sujet, texte, coachId }); };
export const adresseDuCompte = async (compteId) => monde().emails?.[compteId] ?? null;
export const ouvrirEspace = async (coachId, athlete, email) => {
  monde().appels.push('ouvrirEspace');
  if (monde().ouvrirEspaceEchoue) throw new Error('Brevo 500');
  monde().ouverts.push({ coachId, athlete, email });
  // Comme le vrai : la fiche reçoit le compte relié.
  const f = monde().base.tables.athletes_coaches.find((x) => x.id === athlete.id);
  if (f) f.compte_id = Object.keys(monde().emails).find((k) => monde().emails[k] === email) ?? null;
};
export const sortirDeNolioAvantEffacement = async () => {};
// Nolio : jamais appelé par ce lot ; si quelqu'un l'appelle, le test le voit.
export const appelNolio = async () => { monde().appels.push('appelNolio'); return { statut: 200, corps: null }; };

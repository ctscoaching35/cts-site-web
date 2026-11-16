// Le monde des tests de l'aperçu : Next.js (NextResponse, cookies) et Supabase remplacés par des doublures, sans réseau
// ni base. L'état est dans globalThis.__apercu, posé par chaque test.
export const monde = () => globalThis.__apercu;

export class NextResponse extends Response {
  static json(corps, init = {}) {
    return new NextResponse(JSON.stringify(corps), { ...init, headers: { 'content-type': 'application/json' } });
  }
}
export const cookies = async () => ({ get: (k) => (monde().cookies?.[k] ? { value: monde().cookies[k] } : undefined) });

// Une table apercus_appels en mémoire, avec le sous-ensemble de l'API Supabase que la limite utilise.
export const clientService = () => {
  const m = monde();
  const ligne = () => m.table;
  const resultat = (r) => ({ then: (ok, ko) => Promise.resolve(r).then(ok, ko) });
  return {
    from(nom) {
      m.appels.push(`from:${nom}`);
      if (m.tableAbsente) {
        const erreur = { error: { message: 'relation "public.apercus_appels" does not exist' }, count: null };
        const chaine = { delete: () => ({ lt: () => resultat(erreur) }), select: () => chaine, eq: () => chaine, gte: () => resultat(erreur), insert: () => resultat(erreur), then: (ok, ko) => Promise.resolve(erreur).then(ok, ko) };
        return chaine;
      }
      return {
        delete: () => ({ lt: (_c, v) => { m.purges.push(v); m.table = ligne().filter((l) => l.appele_le >= v); return resultat({ error: null }); } }),
        select: () => {
          const f = {};
          let filtre = ligne();
          f.eq = (c, v) => { filtre = filtre.filter((l) => l[c] === v); return f; };
          f.gte = (c, v) => { filtre = filtre.filter((l) => l[c] >= v); return resultat({ count: filtre.length, error: null }); };
          return f;
        },
        insert: (row) => { m.table.push(row); return resultat({ error: null }); },
      };
    },
  };
};

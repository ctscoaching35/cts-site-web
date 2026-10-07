/**
 * Supabase : comptes, plans et PDF de l'app (cadrage de l'app, D6 et D7 ; supabase/README.md).
 * Les clés vivent dans .env.local, géré par le coach :
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY — publiques, le navigateur les lit ;
 *   SUPABASE_SERVICE_ROLE_KEY — secrète, jamais envoyée au navigateur.
 * Sans elles, l'app reste en démonstration (lib/app/demonstration.ts), en développement seulement.
 */
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// L'adresse du projet sans rien derrière : copiée depuis « Data API », elle finit souvent par
// /rest/v1/, et la connexion répond alors « Invalid path specified in request URL ».
export const origineSupabase = (adresse: string | undefined) => {
  try {
    return adresse ? new URL(adresse.trim()).origin : '';
  } catch {
    return '';
  }
};

const URL_SUPABASE = origineSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL);
const CLE_PUBLIQUE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigure = () => Boolean(URL_SUPABASE && CLE_PUBLIQUE);

// Côté serveur (pages, actions) : la session de l'athlète, lue et rafraîchie dans les cookies.
export async function clientServeur() {
  const magasin = await cookies();
  return createServerClient(URL_SUPABASE, CLE_PUBLIQUE, {
    cookies: {
      getAll: () => magasin.getAll(),
      setAll: (aPoser) => {
        try {
          aPoser.forEach(({ name, value, options }) => magasin.set(name, value, options));
        } catch {
          // Une page ne peut pas écrire de cookie : le proxy (proxy.ts) a déjà rafraîchi la session.
        }
      },
    },
  });
}

// La clé de service : les écritures du serveur (compte au paiement, suppression). Jamais côté
// navigateur — elle passe outre les règles de sécurité des tables.
export function clientService() {
  if (typeof window !== 'undefined') throw new Error('La clé de service ne sert que côté serveur');
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!cle) throw new Error('SUPABASE_SERVICE_ROLE_KEY manque dans l’environnement');
  return createClient(URL_SUPABASE, cle, { auth: { persistSession: false, autoRefreshToken: false } });
}

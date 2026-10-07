import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Le proxy de Next 16 (l'ancien middleware) : avant chaque page de l'app, il rafraîchit la
// session Supabase et réécrit ses cookies. Sans Supabase configuré (démonstration), il ne fait rien.
export async function proxy(request: NextRequest) {
  // L'adresse du projet sans chemin derrière (voir origineSupabase, lib/app/supabase.ts).
  let url = '';
  try {
    url = new URL((process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()).origin;
  } catch {
    url = '';
  }
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !cle) return NextResponse.next();
  let reponse = NextResponse.next({ request });
  const supabase = createServerClient(url, cle, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (aPoser, entetes) => {
        aPoser.forEach(({ name, value }) => request.cookies.set(name, value));
        reponse = NextResponse.next({ request });
        aPoser.forEach(({ name, value, options }) => reponse.cookies.set(name, value, options));
        Object.entries(entetes ?? {}).forEach(([nom, valeur]) => reponse.headers.set(nom, valeur));
      },
    },
  });
  await supabase.auth.getClaims();
  return reponse;
}

export const config = { matcher: ['/app/:path*'] };

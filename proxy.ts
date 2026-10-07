import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_INVITATION, invitationValide } from '@/lib/planAcces';

// Le proxy de Next 16 (l'ancien middleware), avant deux familles de pages.
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/plan')) return invitation(request);
  return session(request);
}

// /plan : le lien d'invitation de la bêta (lib/planAcces.ts) pose son cookie, puis renvoie sur
// l'adresse sans le mot, qui ne reste pas dans la barre d'adresse.
function invitation(request: NextRequest) {
  const mot = request.nextUrl.searchParams.get('invitation');
  if (mot === null) return NextResponse.next();
  const propre = request.nextUrl.clone();
  propre.searchParams.delete('invitation');
  const reponse = NextResponse.redirect(propre);
  if (invitationValide(mot)) {
    reponse.cookies.set(COOKIE_INVITATION, mot, {
      httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:',
      maxAge: 90 * 24 * 3600, path: '/',
    });
  }
  return reponse;
}

// /app : rafraîchit la session Supabase et réécrit ses cookies. Sans Supabase configuré
// (démonstration), ne fait rien.
async function session(request: NextRequest) {
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

export const config = { matcher: ['/app/:path*', '/plan', '/plan/:path*'] };

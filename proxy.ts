import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_INVITATION, invitationValide } from '@/lib/planAcces';
import { COOKIE_JOUR, demonstrationCoachOuverte, jourValide } from '@/lib/app/demonstrationCoachPorte';
import { COOKIE_BIENVENUE, COOKIE_DEMARRAGE } from '@/lib/app/bienvenue';

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

// La démonstration de l'espace coach (lib/app/demonstrationCoach.ts), en développement seulement : ?jour= garde le
// jour simulé dans un cookie, pour cette page et les suivantes (?jour=reel revient au jour par défaut).
function jourSimule(request: NextRequest) {
  // La démonstration de l'app des athlètes (lib/app/demonstration.ts) ne pose plus de cookie ; ?reinitialiser=1 efface
  // ceux que posait l'ancienne (la bienvenue lue, « Pour bien démarrer » masquée), sur tous les ports de ce navigateur.
  if (demonstrationCoachOuverte() && request.nextUrl.searchParams.get('reinitialiser') === '1') {
    const propre = request.nextUrl.clone();
    propre.searchParams.delete('reinitialiser');
    const reponse = NextResponse.redirect(propre);
    reponse.cookies.delete(COOKIE_BIENVENUE);
    reponse.cookies.delete(COOKIE_DEMARRAGE);
    return reponse;
  }
  const jour = request.nextUrl.searchParams.get('jour');
  if (!demonstrationCoachOuverte() || jour === null || !request.nextUrl.pathname.startsWith('/app/coach')) return NextResponse.next();
  if (!jourValide(jour)) request.cookies.delete(COOKIE_JOUR);
  else request.cookies.set(COOKIE_JOUR, jour);
  const reponse = NextResponse.next({ request });
  if (!jourValide(jour)) reponse.cookies.delete(COOKIE_JOUR);
  else reponse.cookies.set(COOKIE_JOUR, jour, { httpOnly: true, sameSite: 'lax', path: '/app/coach' });
  return reponse;
}

// /app : rafraîchit la session Supabase et réécrit ses cookies. Sans Supabase configuré
// (démonstration), ne fait rien, sauf le jour simulé de l'espace coach.
async function session(request: NextRequest) {
  // L'adresse du projet sans chemin derrière (voir origineSupabase, lib/app/supabase.ts).
  let url = '';
  try {
    url = new URL((process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()).origin;
  } catch {
    url = '';
  }
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !cle) return jourSimule(request);
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

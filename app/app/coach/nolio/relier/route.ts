import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_ETAT_NOLIO, coachConnecte, nolioConfigure, urlAutorisation } from '@/lib/app/nolio';

// « Relier mon compte Nolio » : vers la page d'autorisation de Nolio, avec un état aléatoire retenu dix
// minutes, que le retour doit rapporter (contre une liaison forcée depuis un autre site).
export async function GET(request: NextRequest) {
  const coach = await coachConnecte();
  if (!coach || !nolioConfigure()) return NextResponse.redirect(new URL('/app/coach', request.url));
  const etat = crypto.randomUUID();
  const reponse = NextResponse.redirect(urlAutorisation(request.nextUrl.origin, etat));
  reponse.cookies.set(COOKIE_ETAT_NOLIO, etat, {
    httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', maxAge: 600, path: '/app/coach',
  });
  return reponse;
}

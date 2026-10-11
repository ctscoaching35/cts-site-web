import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_ETAT_NOLIO, coachConnecte, relier } from '@/lib/app/nolio';

// Le retour de Nolio (l'adresse déclarée sur le portail API) : l'état doit être celui qu'on a posé, puis le
// code s'échange contre les jetons, gardés côté serveur.
export async function GET(request: NextRequest) {
  const page = (resultat: string) => {
    const reponse = NextResponse.redirect(new URL(`/app/coach?nolio=${resultat}`, request.url));
    reponse.cookies.delete({ name: COOKIE_ETAT_NOLIO, path: '/app/coach' });
    return reponse;
  };
  const coach = await coachConnecte();
  const code = request.nextUrl.searchParams.get('code');
  const etat = request.nextUrl.searchParams.get('state');
  if (!coach) return NextResponse.redirect(new URL('/app/coach', request.url));
  if (!code || !etat || etat !== request.cookies.get(COOKIE_ETAT_NOLIO)?.value) return page('refus');
  try {
    await relier(coach.compteId, code, request.nextUrl.origin);
    return page('relie');
  } catch (e) {
    console.error('Liaison Nolio :', e instanceof Error ? e.message : e);
    return page('erreur');
  }
}

import { NextResponse, type NextRequest } from 'next/server';

// « Suivi des 7 jours » est supprimé (décision coach du 04/11/2026, relecture écran par écran) : les 7 jours de chacun
// sont sur sa page, les signaux du soir dans « Mes athlètes » et « Urgent » (08/11/2026), « Retirer l'accord » dans les
// réglages de sa page. Son adresse renvoie sur l'accueil (une vraie redirection : une page passerait par le chargement de
// l'espace coach).
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/app/coach', request.url), 307);
}

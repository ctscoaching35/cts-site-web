import { NextResponse, type NextRequest } from 'next/server';

// « Suivi des 7 jours » est supprimé (décision coach du 04/11/2026, relecture écran par écran) : les 7 jours de chacun
// sont sur sa fiche, les signaux du soir sur « Cette semaine », « Retirer l'accord » dans les réglages de sa fiche. Son
// adresse renvoie sur « Cette semaine » (une vraie redirection : une page passerait par le chargement de l'espace coach).
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/app/coach', request.url), 307);
}

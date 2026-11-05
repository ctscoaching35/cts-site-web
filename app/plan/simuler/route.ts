import { NextResponse, type NextRequest } from 'next/server';
import { API_URL } from '@/lib/plan';
import { coachConnecte } from '@/lib/app/nolio';
import { enTetesMoteur } from '@/lib/app/cleMoteur';

// La simulation d'un achat (décision coach du 24/10/2026) : le questionnaire public rempli par le coach, connecté en
// coach, part au moteur avec le code du coach (CTS_CLE_COACH), sans paiement. La page de retour range ensuite le plan
// comme après un paiement (rangerLePlan : compte de l'acheteur, e-mail de bienvenue, invitation Nolio), noté à 0 € et
// hors des Chiffres. Le parcours payant se teste à part, au dernier moment.
// X-CTS-Simulation (C7, audit de l'app plan du 03/11/2026) : avec le code du coach, le moteur génère le plan par la voie
// de l'acheteur (un plan rejoint repart du plancher, ses portes jouent), sans paiement.
export async function POST(request: NextRequest) {
  const coach = await coachConnecte();
  if (!coach) return NextResponse.json({ message: 'La simulation est réservée au coach connecté.' }, { status: 403 });
  const cle = process.env.CTS_CLE_COACH;
  if (!cle) return NextResponse.json({ message: 'Le code du coach (CTS_CLE_COACH) manque dans Vercel.' }, { status: 500 });
  const r = await fetch(`${API_URL}/v1/checkout`, { method: 'POST', body: await request.formData(), headers: enTetesMoteur({ 'X-CTS-Coach': cle, 'X-CTS-Simulation': '1' }), cache: 'no-store' });
  const corps = await r.json().catch(() => null);
  if (!r.ok || !corps?.session_id) {
    return NextResponse.json({ message: corps?.message ?? 'Le moteur n’a pas pu préparer le plan : réessaie dans un moment.' }, { status: r.ok ? 502 : r.status });
  }
  return NextResponse.json({ page: `/plan/merci?session_id=${encodeURIComponent(String(corps.session_id))}` });
}

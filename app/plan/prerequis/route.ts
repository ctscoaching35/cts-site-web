import { NextResponse, type NextRequest } from 'next/server';
import { API_URL } from '@/lib/plan';
import { planOuvert } from '@/lib/planAcces';
import { enTetesMoteur } from '@/lib/app/cleMoteur';
import { moteurEstV9 } from '@/lib/app/moteurEnLigne';
import { parametresV9 } from '@/lib/app/moteurV9';
import { retirerIdentite } from '@/lib/apercu';
import { prerequisDeLaReponse, prerequisPourLAchat } from '@/lib/prerequis';

// LES PRÉREQUIS D'UN PLAN, DITS À L'ACHETEUR AVANT LE PAIEMENT (entrée 234 du coach, 25/11/2026 ; lib/prerequis.ts) : le questionnaire de l'acheteur, sans e-mail ni nom ni réponse de santé (le navigateur
// ne les envoie pas), part au moteur v1 (POST /v1/prerequis, route réservée au serveur du site : X-CTS-Cle) sous la forme de ses paramètres (lib/app/moteurV9.ts, parametresV9), et seul ce qui sert aux phrases
// revient. Même porte que le reste de l'achat (planOuvert, sinon 404). Sous la 8.x, ou si le moteur ne répond pas : { prerequis: null }, et le récapitulatif ne dit rien de plus ; l'achat reste possible.
// Rien n'est gardé ici.
const TAILLE_MAX = 20_000;
const DELAI_MS = 5_000;

export async function POST(request: NextRequest) {
  if (!(await planOuvert())) return new NextResponse(null, { status: 404 });
  let intake: Record<string, unknown>;
  try {
    const texte = await request.text();
    if (texte.length > TAILLE_MAX) throw new Error('taille');
    intake = JSON.parse(texte);
    if (!intake || typeof intake !== 'object' || Array.isArray(intake)) throw new Error('intake');
  } catch {
    return NextResponse.json({ error: 'intake', prerequis: null }, { status: 400 });
  }
  if (!(await moteurEstV9().catch(() => false))) return NextResponse.json({ prerequis: null });
  try {
    const r = await fetch(`${API_URL}/v1/prerequis`, {
      method: 'POST', headers: enTetesMoteur({ 'Content-Type': 'application/json' }), body: JSON.stringify({ parametres: parametresV9(retirerIdentite(intake)) }),
      cache: 'no-store', signal: AbortSignal.timeout(DELAI_MS),
    });
    const corps = r.ok ? await r.json().catch(() => null) : null;
    return NextResponse.json({ prerequis: prerequisPourLAchat(prerequisDeLaReponse(corps)) });
  } catch {
    return NextResponse.json({ prerequis: null });
  }
}

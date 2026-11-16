import { NextResponse, type NextRequest } from 'next/server';
import { API_URL } from '@/lib/plan';
import { planOuvert } from '@/lib/planAcces';
import { enTetesMoteur } from '@/lib/app/cleMoteur';
import { apercuPermis } from '@/lib/app/apercuLimite';
import { DELAI_MOTEUR_MS, MESSAGE_APERCU_INDISPONIBLE, MESSAGE_APERCU_LIMITE, retirerIdentite } from '@/lib/apercu';

// L'APERÇU DU PLAN AVANT PAIEMENT (décision du coach du 16/11/2026) : le questionnaire de l'acheteur part au moteur
// (POST /v1/apercu, 8.470) sans e-mail ni nom, et la réponse revient telle quelle. Même porte que le reste de l'achat
// (planOuvert, sinon 404). Jamais d'en-tête du coach : le coaching et la simulation (X-CTS-Coach) n'ont pas d'aperçu.
// 10 aperçus par visiteur et par heure (lib/app/apercuLimite.ts). Rien n'est gardé ici.
export async function POST(request: NextRequest) {
  if (!(await planOuvert())) return new NextResponse(null, { status: 404 });
  let intake: Record<string, unknown>;
  let gpx: FormDataEntryValue | null;
  try {
    const entree = await request.formData();
    const brut = entree.get('intake');
    intake = JSON.parse(typeof brut === 'string' ? brut : '');
    if (!intake || typeof intake !== 'object' || Array.isArray(intake)) throw new Error('intake');
    gpx = entree.get('gpx');
  } catch {
    return NextResponse.json({ error: 'intake', message: MESSAGE_APERCU_INDISPONIBLE }, { status: 400 });
  }
  if (!(await apercuPermis(request.headers))) {
    return NextResponse.json({ error: 'limite', message: MESSAGE_APERCU_LIMITE }, { status: 429 });
  }
  const donnees = new FormData();
  donnees.append('intake', JSON.stringify(retirerIdentite(intake)));
  if (gpx && typeof gpx !== 'string' && gpx.size > 0) donnees.append('gpx', gpx);
  try {
    const r = await fetch(`${API_URL}/v1/apercu`, {
      method: 'POST', body: donnees, headers: enTetesMoteur(), cache: 'no-store', signal: AbortSignal.timeout(DELAI_MOTEUR_MS),
    });
    const corps = await r.json().catch(() => null);
    if (corps === null) return NextResponse.json({ error: 'moteur', message: MESSAGE_APERCU_INDISPONIBLE }, { status: r.ok ? 502 : r.status });
    return NextResponse.json(corps, { status: r.status });
  } catch {
    // Délai dépassé ou réseau : le paiement reste possible.
    return NextResponse.json({ error: 'delai', message: MESSAGE_APERCU_INDISPONIBLE }, { status: 504 });
  }
}

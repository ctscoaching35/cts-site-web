import { accorderRelance, emailValide, retirerRelance } from '@/lib/app/relance';
import { supabaseConfigure } from '@/lib/app/supabase';
import { adresseIp, appelPermis, origineAdmise } from '@/lib/app/porteRelance';

// La case « Envoie-moi un rappel » du questionnaire (lib/app/relance.ts) : cochée, l'accord ; décochée, le retrait.
// A-43 (7B, décision coach du 05/11/2026 au soir) : notre site seulement (l'en-tête Origin), et 20 appels par adresse IP
// et par jour (lib/app/porteRelance.ts).
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!origineAdmise(request.headers.get('origin'), request.headers.get('host'))) return Response.json({ ok: false }, { status: 403 });
  if (!appelPermis(adresseIp(request.headers))) return Response.json({ ok: false }, { status: 429 });
  if (!supabaseConfigure()) return Response.json({ ok: false }, { status: 503 });
  const corps = (await request.json().catch(() => null)) as { email?: unknown; accord?: unknown; precedent?: unknown } | null;
  const email = String(corps?.email ?? '').trim().toLowerCase();
  if (!emailValide(email)) return Response.json({ ok: false }, { status: 400 });
  const precedent = String(corps?.precedent ?? '').trim().toLowerCase();
  if (corps?.accord === true) await accorderRelance(email, emailValide(precedent) ? precedent : undefined);
  else await retirerRelance(email);
  return Response.json({ ok: true });
}

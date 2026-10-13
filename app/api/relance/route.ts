import { accorderRelance, emailValide, retirerRelance } from '@/lib/app/relance';
import { supabaseConfigure } from '@/lib/app/supabase';

// La case « Envoie-moi un rappel » du questionnaire (lib/app/relance.ts) : cochée, l'accord ; décochée, le retrait.
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!supabaseConfigure()) return Response.json({ ok: false }, { status: 503 });
  const corps = (await request.json().catch(() => null)) as { email?: unknown; accord?: unknown; precedent?: unknown } | null;
  const email = String(corps?.email ?? '').trim().toLowerCase();
  if (!emailValide(email)) return Response.json({ ok: false }, { status: 400 });
  const precedent = String(corps?.precedent ?? '').trim().toLowerCase();
  if (corps?.accord === true) await accorderRelance(email, emailValide(precedent) ? precedent : undefined);
  else await retirerRelance(email);
  return Response.json({ ok: true });
}

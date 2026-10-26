import { NextResponse } from 'next/server';
import { codeCourt, lienFicheCourse } from '@/lib/app/ficheCourse';
import { ajouterJours } from '@/lib/app/plan';
import { clientService, supabaseConfigure } from '@/lib/app/supabase';

// Le lien court de la fiche de course (décision coach du 26/10/2026) : le plan dont le code court correspond, parmi
// ceux en route ou finis depuis moins d'un mois, renvoie vers son lien privé (/fiche-course/{jeton}) ; sinon, introuvable.
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[A-Za-z0-9]{8}$/.test(code) || !supabaseConfigure()) return new NextResponse('Introuvable', { status: 404 });
  const depuis = ajouterJours(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date()), -31);
  const { data } = await clientService().from('plans').select('id').not('demarre_le', 'is', null).gte('course_date', depuis);
  const plan = (data ?? []).find((p) => codeCourt(String(p.id)) === code);
  return plan ? NextResponse.redirect(lienFicheCourse(String(plan.id)), 302) : new NextResponse('Introuvable', { status: 404 });
}

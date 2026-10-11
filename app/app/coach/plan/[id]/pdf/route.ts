import { NextResponse, type NextRequest } from 'next/server';
import { objectifCoache } from '@/lib/app/coaching';
import { coachConnecte } from '@/lib/app/nolio';
import { clientService } from '@/lib/app/supabase';

// Le PDF d'un objectif d'athlète coaché (N5), pour que le coach le lui transmette s'il le veut.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const coach = await coachConnecte();
  const { id } = await params;
  const o = coach ? await objectifCoache(coach.compteId, id) : null;
  if (!o?.pdf) return new NextResponse('Introuvable', { status: 404 });
  const { data } = await clientService().storage.from('plans-pdf').download(o.pdf);
  if (!data) return new NextResponse('Introuvable', { status: 404 });
  // Un nom de fichier en ASCII : un en-tête HTTP ne porte pas d'accents.
  const nom = `CTS_Plan_${o.athlete.nom}_${o.plan.course.nom}`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_');
  return new NextResponse(data, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${nom}.pdf"` },
  });
}

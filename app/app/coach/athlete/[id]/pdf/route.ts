import { NextResponse, type NextRequest } from 'next/server';
import { athleteCoache } from '@/lib/app/coaching';
import { coachConnecte } from '@/lib/app/nolio';
import { clientService } from '@/lib/app/supabase';

// Le PDF d'un athlète coaché (N5), pour que le coach le lui transmette s'il le veut.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const coach = await coachConnecte();
  const { id } = await params;
  const a = coach ? await athleteCoache(coach.compteId, id) : null;
  if (!a?.pdf) return new NextResponse('Introuvable', { status: 404 });
  const { data } = await clientService().storage.from('plans-pdf').download(a.pdf);
  if (!data) return new NextResponse('Introuvable', { status: 404 });
  // Un nom de fichier en ASCII : un en-tête HTTP ne porte pas d'accents.
  const nom = `CTS_Plan_${a.coaching.athlete_nom}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_');
  return new NextResponse(data, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${nom}.pdf"` },
  });
}

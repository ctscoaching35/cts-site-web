import { NextResponse } from 'next/server';
import { contexte } from '@/lib/app/contexte';
import { clientService } from '@/lib/app/supabase';

// Le PDF du plan affiché (CTS_NOLIO_CADRAGE.md, T7 : « Mon plan » sur papier), celui joint à l'e-mail de bienvenue.
export async function GET() {
  const ctx = await contexte(Promise.resolve({}));
  if (ctx.demonstration) return new NextResponse('Introuvable', { status: 404 });
  const service = clientService();
  const { data: p } = await service.from('plans').select('pdf_chemin').eq('id', ctx.cle).maybeSingle();
  const { data } = p?.pdf_chemin ? await service.storage.from('plans-pdf').download(p.pdf_chemin) : { data: null };
  if (!data) return new NextResponse('Introuvable', { status: 404 });
  // Un nom de fichier en ASCII : un en-tête HTTP ne porte pas d'accents.
  const nom = `CTS_Plan_${ctx.plan.course.nom}`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_');
  return new NextResponse(data, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${nom}.pdf"` },
  });
}

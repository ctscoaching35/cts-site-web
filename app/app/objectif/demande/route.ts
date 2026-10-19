import { NextResponse, type NextRequest } from 'next/server';
import { site } from '@/lib/content';
import { ficheDuCompte } from '@/lib/app/demandes';
import { prevenirCoach } from '@/lib/app/ecriture';
import { clientServeur, clientService } from '@/lib/app/supabase';

// Un coaché envoie son nouvel objectif à son coach (OM1) : ses réponses et sa trace attendent le coach, prévenu par
// e-mail ; rien ne se génère avant qu'il l'ait relu.
export async function POST(request: NextRequest) {
  const { data } = await (await clientServeur()).auth.getClaims();
  const compteId = data?.claims?.sub as string | undefined;
  const fiche = compteId ? await ficheDuCompte(compteId) : null;
  if (!fiche) return NextResponse.json({ message: 'Réservé aux athlètes coachés.' }, { status: 403 });
  const form = await request.formData();
  let champs: Record<string, unknown>;
  try {
    champs = JSON.parse(String(form.get('intake') ?? ''));
  } catch {
    return NextResponse.json({ message: 'Le questionnaire n’a pas pu être lu. Recharge la page et recommence.' }, { status: 400 });
  }
  const service = clientService();
  const { data: demande, error } = await service.from('objectifs_demandes')
    .insert({ athlete_id: fiche.id, coach_id: fiche.coach_id, champs: { ...champs, email: '' } }).select('id').single();
  if (error || !demande) return NextResponse.json({ message: 'La demande n’a pas pu partir. Réessaie.' }, { status: 500 });
  const gpx = form.get('gpx');
  if (gpx instanceof File && gpx.size > 0 && gpx.size < 15_000_000) {
    const chemin = `demandes/${demande.id}.gpx`;
    const { error: e } = await service.storage.from('plans-pdf').upload(chemin, await gpx.arrayBuffer(), { contentType: 'application/gpx+xml', upsert: true });
    if (!e) await service.from('objectifs_demandes').update({ gpx_chemin: chemin }).eq('id', demande.id);
  }
  await prevenirCoach(`${fiche.nom} demande un nouvel objectif`,
    `${fiche.nom} a rempli le questionnaire de son prochain objectif : ${String(champs.course_nom ?? '')}, le ${String(champs.date_course ?? '')}.\n\n`
      + `Relis-le et lance-le depuis ton espace coach : ${site.url}/app/coach`).catch(() => null);
  return NextResponse.json({ page: '/app/plan?demande=envoyee' });
}

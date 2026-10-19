import { NextResponse, type NextRequest } from 'next/server';
import { API_URL } from '@/lib/plan';
import type { Plan } from '@/lib/app/plan';
import { coachConnecte } from '@/lib/app/nolio';
import { clientService } from '@/lib/app/supabase';

// « Ajouter un athlète » et « Nouvel objectif » (CTS_NOLIO_CADRAGE.md, N1, N2, N5, N9) : le questionnaire rempli
// par le coach part au moteur avec le code du coach (CTS_CLE_COACH), sans paiement ; le plan et son PDF sont
// rangés dans le compte du coach, comme objectif de l'athlète (sa fiche, créée au premier objectif). Aucun compte
// ni e-mail pour l'athlète.
export async function POST(request: NextRequest) {
  const coach = await coachConnecte();
  const cle = process.env.CTS_CLE_COACH;
  if (!coach) return NextResponse.json({ message: 'Réservé au coach.' }, { status: 403 });
  if (!cle) return NextResponse.json({ message: 'Le code du coach (CTS_CLE_COACH) manque dans Vercel.' }, { status: 500 });
  const enTete = { 'X-CTS-Coach': cle };
  const formulaire = await request.formData();
  const athleteDemande = String(formulaire.get('athlete_id') ?? '');
  // OM1 : un objectif demandé par le coaché ; sa trace, gardée avec la demande, part si le coach n'en donne pas d'autre.
  const demandeId = String(formulaire.get('demande_id') ?? '');
  const service0 = clientService();
  const { data: demande } = demandeId
    ? await service0.from('objectifs_demandes').select('id, gpx_chemin').eq('id', demandeId).eq('coach_id', coach.compteId).maybeSingle()
    : { data: null };
  formulaire.delete('demande_id');
  const gpxDonne = formulaire.get('gpx');
  if (demande?.gpx_chemin && !(gpxDonne instanceof File && gpxDonne.size > 0)) {
    const { data: trace } = await service0.storage.from('plans-pdf').download(demande.gpx_chemin);
    if (trace) formulaire.set('gpx', new File([trace], 'trace.gpx', { type: 'application/gpx+xml' }));
  }
  const r1 = await fetch(`${API_URL}/v1/checkout`, { method: 'POST', body: formulaire, headers: enTete, cache: 'no-store' });
  const c1 = await r1.json().catch(() => null);
  if (!r1.ok || !c1?.session_id) {
    return NextResponse.json({ message: c1?.message || 'Le moteur n’a pas accepté le questionnaire.' }, { status: 422 });
  }
  const r2 = await fetch(`${API_URL}/v1/plans`, {
    method: 'POST', headers: { ...enTete, 'Content-Type': 'application/json' },
    body: JSON.stringify({ checkout_session_id: c1.session_id }), cache: 'no-store',
  });
  const c2 = await r2.json().catch(() => null);
  if (!r2.ok || !c2?.donnees_url) {
    return NextResponse.json({ message: c2?.message || 'La génération du plan n’a pas abouti.' }, { status: 502 });
  }
  const donnees: Plan = await (await fetch(`${API_URL}${c2.donnees_url}`, { cache: 'no-store' })).json();
  const pdf = await (await fetch(`${API_URL}${c2.pdf_url}`, { cache: 'no-store' })).arrayBuffer();
  const service = clientService();
  const { data: plan, error } = await service.from('plans').insert({
    compte_id: coach.compteId, course_nom: donnees.course.nom, course_date: donnees.course.date,
    debut_plan: donnees.course.date_debut_plan, schema: donnees.schema, version_moteur: donnees.version_moteur,
    donnees, intake: c2.intake ?? {},
    // L'écriture semaine par semaine (T3, 19/10/2026) : les paramètres du moteur ; le coach démarre l'objectif dans Nolio.
    ...(c2.parametres ? { parametres: c2.parametres, coach_id: coach.compteId } : {}),
  }).select('id').single();
  if (error || !plan) {
    console.error('Plan coaché :', error?.message);
    return NextResponse.json({ message: 'Le plan n’a pas pu être rangé. Réessaie.' }, { status: 500 });
  }
  const chemin = `${coach.compteId}/${plan.id}.pdf`;
  const { error: erreurPdf } = await service.storage.from('plans-pdf').upload(chemin, pdf, { contentType: 'application/pdf', upsert: true });
  if (!erreurPdf) await service.from('plans').update({ pdf_chemin: chemin }).eq('id', plan.id);
  const nom = String(c2.resume?.athlete || donnees.athlete.nom);
  // La fiche de l'athlète : celle d'un nouvel objectif si elle est au coach, sinon une nouvelle.
  let athleteId: string | null = null;
  if (athleteDemande) {
    const { data } = await service.from('athletes_coaches').select('id').eq('id', athleteDemande).eq('coach_id', coach.compteId).maybeSingle();
    athleteId = data?.id ?? null;
  }
  if (!athleteId) {
    const { data } = await service.from('athletes_coaches').insert({ coach_id: coach.compteId, nom }).select('id').single();
    athleteId = data?.id ?? null;
  }
  const { error: erreurCoaching } = athleteId
    ? await service.from('coaching').insert({ plan_id: plan.id, coach_id: coach.compteId, athlete_nom: nom, athlete_id: athleteId })
    : { error: { message: 'fiche de l’athlète non créée' } };
  if (erreurCoaching) {
    console.error('Coaching :', erreurCoaching.message);
    await service.from('plans').delete().eq('id', plan.id);
    return NextResponse.json({ message: 'Le plan n’a pas pu être rangé. Réessaie.' }, { status: 500 });
  }
  if (demande) await service.from('objectifs_demandes').update({ statut: 'validee', plan_id: plan.id }).eq('id', demande.id);
  return NextResponse.json({ page: `/app/coach/plan/${plan.id}` });
}

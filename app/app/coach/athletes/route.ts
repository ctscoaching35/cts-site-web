import { NextResponse, type NextRequest } from 'next/server';
import { API_URL } from '@/lib/plan';
import type { Plan } from '@/lib/app/plan';
import { coachConnecte } from '@/lib/app/nolio';
import { clientService } from '@/lib/app/supabase';

// « Ajouter un athlète » (CTS_NOLIO_CADRAGE.md, N1, N2, N5) : le questionnaire rempli par le coach part au
// moteur avec le code du coach (CTS_CLE_COACH), sans paiement ; le plan et son PDF sont rangés dans le compte
// du coach, avec l'athlète coaché. Aucun compte ni e-mail pour l'athlète.
export async function POST(request: NextRequest) {
  const coach = await coachConnecte();
  const cle = process.env.CTS_CLE_COACH;
  if (!coach) return NextResponse.json({ message: 'Réservé au coach.' }, { status: 403 });
  if (!cle) return NextResponse.json({ message: 'Le code du coach (CTS_CLE_COACH) manque dans Vercel.' }, { status: 500 });
  const enTete = { 'X-CTS-Coach': cle };
  const formulaire = await request.formData();
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
  }).select('id').single();
  if (error || !plan) {
    console.error('Plan coaché :', error?.message);
    return NextResponse.json({ message: 'Le plan n’a pas pu être rangé. Réessaie.' }, { status: 500 });
  }
  const chemin = `${coach.compteId}/${plan.id}.pdf`;
  const { error: erreurPdf } = await service.storage.from('plans-pdf').upload(chemin, pdf, { contentType: 'application/pdf', upsert: true });
  if (!erreurPdf) await service.from('plans').update({ pdf_chemin: chemin }).eq('id', plan.id);
  const { error: erreurCoaching } = await service.from('coaching').insert({
    plan_id: plan.id, coach_id: coach.compteId, athlete_nom: String(c2.resume?.athlete || donnees.athlete.nom),
  });
  if (erreurCoaching) {
    console.error('Coaching :', erreurCoaching.message);
    await service.from('plans').delete().eq('id', plan.id);
    return NextResponse.json({ message: 'Le plan n’a pas pu être rangé. Réessaie.' }, { status: 500 });
  }
  return NextResponse.json({ page: `/app/coach/athlete/${plan.id}` });
}

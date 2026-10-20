import { demarrerObjectif, prevenirCoach } from '@/lib/app/ecriture';
import { signatureNolioValide } from '@/lib/app/nolioWebhook';
import { clientService } from '@/lib/app/supabase';

// Le webhook de Nolio (CTS_NOLIO_CADRAGE.md, P1 à P4) : un acheteur qui rejoint l'équipe déclenche l'envoi de son plan ;
// un refus prévient le coach ; un athlète qui quitte l'équipe ou coupe l'accès (access.ended, obligatoire) n'est plus
// lu, et ce que le site tenait de Nolio sur lui est effacé (conditions de l'API, article 7.2 : sous 30 jours).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Evenement = { id?: string; type?: string; data?: { object?: Record<string, unknown>; context?: Record<string, unknown> } };

export async function POST(request: Request) {
  const corps = await request.text();
  if (!signatureNolioValide(corps, request.headers.get('webhook-signature'), process.env.NOLIO_WEBHOOK_SECRET?.trim() ?? '')) {
    return new Response('Signature refusée', { status: 400 });
  }
  const e = JSON.parse(corps) as Evenement;
  const objet = e.data?.object ?? {};
  const usr = String(objet.user ?? objet.id ?? '');
  if (!/^usr_[A-Za-z0-9]+$/.test(usr)) return Response.json({ recu: true });
  const service = clientService();
  try {
    if (e.type === 'team.member.join' && e.data?.context?.role === 'athlete') {
      const { data: plans } = await service.from('plans').select('id').eq('nolio_athlete_id', usr).eq('nolio_statut', 'invite');
      for (const p of plans ?? []) {
        await service.from('plans').update({ nolio_statut: 'actif' }).eq('id', p.id);
        await demarrerObjectif(p.id as string);
      }
    } else if (e.type === 'team.invitation.refused') {
      const { data: plans } = await service.from('plans').select('id, course_nom').eq('nolio_athlete_id', usr).eq('nolio_statut', 'invite');
      for (const p of plans ?? []) {
        await service.from('plans').update({ nolio_statut: 'refuse' }).eq('id', p.id);
        await prevenirCoach('Plan CTS : invitation Nolio refusée',
          `L’acheteur du plan « ${p.course_nom} » a refusé l’invitation dans ton équipe Nolio. Son plan reste en PDF ; `
          + 'reprends contact avec lui depuis ton espace coach.');
      }
    } else if (e.type === 'team.member.leave' || e.type === 'access.ended') {
      // Plus aucun chemin vers lui : on ne le lit plus, et l'état tiré de Nolio s'efface.
      await service.from('plans').update({ nolio_statut: 'sorti', etat_ecriture: null }).eq('nolio_athlete_id', usr);
      if (e.type === 'access.ended') {
        const { data: plans } = await service.from('plans').select('id').eq('nolio_athlete_id', usr);
        for (const p of plans ?? []) await service.from('semaines_ecrites').update({ journal: [], notes: [] }).eq('plan_id', p.id);
        await service.from('nolio_accords').delete().eq('nolio_athlete_id', usr);
        await service.from('badges').delete().eq('nolio_athlete_id', usr);
      }
    }
    return Response.json({ recu: true });
  } catch (err) {
    // 500 : Nolio réessaie, le traitement reprend (le départ d'un objectif est idempotent).
    console.error(`Webhook Nolio ${e.type} :`, err instanceof Error ? err.message : err);
    return new Response('Traitement en échec', { status: 500 });
  }
}

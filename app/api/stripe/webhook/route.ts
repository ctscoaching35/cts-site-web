import { after } from 'next/server';
import { inviterAcheteur } from '@/lib/app/ecriture';
import { rangerLePlan, signalerAchatNonRange } from '@/lib/app/rangement';
import { signatureValide } from '@/lib/app/stripeWebhook';

// Le webhook de Stripe (lib/app/stripeWebhook.ts) : un paiement réussi range le plan, même si l'acheteur a fermé
// la page avant d'y revenir. Rangement idempotent : avec la page de retour, le premier arrivé range, l'autre reprend.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// La génération du plan par l'API peut prendre plusieurs secondes ; l'invitation Nolio et le départ du plan (sa trame,
// ses questionnaires, sa première semaine) partent après la réponse, dans le même délai.
export const maxDuration = 300;

export async function POST(request: Request) {
  const corps = await request.text();
  if (!signatureValide(corps, request.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET ?? '')) {
    return new Response('Signature refusée', { status: 400 });
  }
  const evenement = JSON.parse(corps) as { type?: string; data?: { object?: { id?: string; payment_status?: string; amount_total?: number } } };
  const session = evenement.data?.object;
  // Un code promo à 100 % (C5, audit de l'app plan du 03/11/2026) : Stripe finit la session sans paiement
  // (« no_payment_required ») ; un montant nul vaut un paiement. Le moteur la reconnaît de même.
  const payee = session?.payment_status === 'paid' || (session?.payment_status === 'no_payment_required' && session.amount_total === 0);
  if (evenement.type !== 'checkout.session.completed' || !payee || !session?.id) {
    return Response.json({ recu: true });
  }
  try {
    const r = await rangerLePlan(session.id, new URL(request.url).origin);
    if (r.aInviter) {
      after(() => inviterAcheteur(r.planId, r.email).catch((e) =>
        console.error(`Invitation Nolio de ${session.id} :`, e instanceof Error ? e.message : e)));
    }
    return Response.json({ range: true });
  } catch (e) {
    // Une erreur rend 500 : Stripe rappelle plus tard, et le rangement reprend où il s'est arrêté. E2 : le coach prévenu
    // au premier échec, une seule fois (la page de retour le signale aussi, sous la même clé).
    console.error(`Webhook Stripe, rangement de ${session.id} :`, e);
    await signalerAchatNonRange(session.id, e);
    return new Response('Rangement en échec', { status: 500 });
  }
}

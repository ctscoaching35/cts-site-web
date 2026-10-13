import { rangerLePlan } from '@/lib/app/rangement';
import { signatureValide } from '@/lib/app/stripeWebhook';

// Le webhook de Stripe (lib/app/stripeWebhook.ts) : un paiement réussi range le plan, même si l'acheteur a fermé
// la page avant d'y revenir. Rangement idempotent : avec la page de retour, le premier arrivé range, l'autre reprend.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// La génération du plan par l'API peut prendre plusieurs secondes.
export const maxDuration = 60;

export async function POST(request: Request) {
  const corps = await request.text();
  if (!signatureValide(corps, request.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET ?? '')) {
    return new Response('Signature refusée', { status: 400 });
  }
  const evenement = JSON.parse(corps) as { type?: string; data?: { object?: { id?: string; payment_status?: string } } };
  const session = evenement.data?.object;
  if (evenement.type !== 'checkout.session.completed' || session?.payment_status !== 'paid' || !session.id) {
    return Response.json({ recu: true });
  }
  try {
    await rangerLePlan(session.id, new URL(request.url).origin);
    return Response.json({ range: true });
  } catch (e) {
    // Une erreur rend 500 : Stripe rappelle plus tard, et le rangement reprend où il s'est arrêté.
    console.error(`Webhook Stripe, rangement de ${session.id} :`, e);
    return new Response('Rangement en échec', { status: 500 });
  }
}

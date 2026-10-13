/**
 * La relance d'un questionnaire commencé sans paiement (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, L3,
 * décision coach du 13/10/2026) : une seule, le lendemain, seulement pour qui l'a demandée sous le champ e-mail.
 * En France, un e-mail commercial à un particulier non client demande son accord (CNIL) : la case le recueille.
 * Seuls l'e-mail et la date de l'accord sont gardés (table relances) ; les réponses restent sur l'appareil.
 * Côté serveur seulement.
 */
import { site } from '@/lib/content';
import { EXPEDITEUR } from './emailBienvenue';
import { clientService } from './supabase';

export const emailValide = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const JOUR_MS = 24 * 3600 * 1000;
// Au-delà, une ligne n'a plus d'objet : effacée, envoyée ou non.
const GARDE_JOURS = 30;

export async function accorderRelance(email: string, precedent?: string) {
  const service = clientService();
  // Une adresse déjà relancée ne l'est pas deux fois : la ligne existante est gardée telle quelle.
  await service.from('relances').upsert({ email }, { onConflict: 'email', ignoreDuplicates: true });
  if (precedent && precedent !== email) await retirerRelance(precedent);
}

// La case décochée, ou l'achat fait : plus de relance.
export async function retirerRelance(email: string) {
  await clientService().from('relances').delete().eq('email', email).is('envoyee_le', null);
}

export function contenuRelance() {
  const lien = `${site.url}/plan`;
  const paragraphe =
    'Tu as commencé à construire ton plan d’entraînement sur cts-coaching.com. Ton plan t’attend : reprends ton questionnaire sur le même appareil et le même navigateur, tes réponses y sont gardées.';
  const signature = 'Juliette et Romain — CTS Coaching';
  const texte = ['Bonjour,', paragraphe, `Reprendre mon questionnaire : ${lien}`, signature].join('\n\n');
  const p = (contenu: string) => `<p style="margin:0 0 16px;line-height:1.55">${contenu}</p>`;
  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:24px 12px;background:#F3F7F0">
<div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px 28px;font-family:Helvetica,Arial,sans-serif;font-size:16px;color:#2F2D4E">
${p('Bonjour,')}
${p(paragraphe)}
<p style="margin:24px 0"><a href="${lien}" style="display:inline-block;background:#0C6E5F;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 24px">Reprendre mon questionnaire</a></p>
<p style="margin:24px 0 0;line-height:1.55;font-weight:bold">${signature}</p>
</div></body></html>`;
  return { sujet: 'Ton plan t’attend', texte, html };
}

async function envoyer(email: string, cle: string) {
  const { sujet, texte, html } = contenuRelance();
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': cle, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender: EXPEDITEUR, replyTo: EXPEDITEUR, to: [{ email }], subject: sujet, textContent: texte, htmlContent: html }),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`Brevo ${r.status}`);
}

// Le passage quotidien : relance les accords de plus de 24 h sans achat, une fois ; efface les lignes de plus
// de 30 jours. Rend le nombre de relances envoyées.
export async function envoyerRelancesDues(maintenant = Date.now()) {
  const service = clientService();
  await service.from('relances').delete().lt('accord_le', new Date(maintenant - GARDE_JOURS * JOUR_MS).toISOString());
  const cle = process.env.BREVO_API_KEY?.trim();
  if (!cle) return 0;
  const { data } = await service.from('relances').select('email')
    .is('envoyee_le', null).lte('accord_le', new Date(maintenant - JOUR_MS).toISOString()).limit(200);
  let envoyees = 0;
  for (const { email } of data ?? []) {
    try {
      await envoyer(email, cle);
      await service.from('relances').update({ envoyee_le: new Date().toISOString() }).eq('email', email);
      envoyees += 1;
    } catch (e) {
      console.error(`Relance de ${email} :`, e);
    }
  }
  return envoyees;
}

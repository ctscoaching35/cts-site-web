/**
 * L'e-mail de bienvenue (cadrage de l'app, D9 : le PDF joint ; texte validé par le coach le
 * 07/10/2026). Envoyé par Brevo (API transactionnelle) une fois par plan rangé, depuis
 * lib/app/rangement.ts. Côté serveur seulement. Sans BREVO_API_KEY, rien ne part. La phrase de la
 * connexion sur un autre appareil est reprise sur décision du coach (07/10/2026, « option 1 »).
 *
 * Les phrases du plan viennent du moteur (cadrage, D3) : la date de début dite par la couverture
 * (« Ta préparation commence le… », ou la semaine rejointe).
 */
import type { Plan } from './plan';

// L'adresse d'envoi des essais (non authentifiée) ; une adresse du domaine cts-coaching.com,
// authentifié dans Brevo, avant l'ouverture (supabase/README.md).
const EXPEDITEUR = {
  name: 'CTS Coaching',
  email: process.env.CTS_EMAIL_EXPEDITEUR?.trim() || 'ctscoaching35@gmail.com',
};

const sansBalises = (texte: string) => texte.replace(/<[^>]+>/g, '');
const echapper = (texte: string) =>
  texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function contenuBienvenue(plan: Plan, lienApp: string) {
  const nom = plan.athlete.nom.trim();
  const { course } = plan;
  const paragraphes = [
    `Ton plan pour ${course.nom}, le ${course.date_lettres}, est prêt. ${sansBalises(plan.couverture.debut)}`,
    'Chaque séance t’y attend au jour le jour, avec le calendrier, ton parcours et les fiches de la bibliothèque. ' +
      'Pour y revenir facilement, ajoute l’app à l’écran d’accueil de ton téléphone : elle te montre comment à ' +
      'la première ouverture. Sur un autre appareil, l’app te demande l’adresse e-mail qui reçoit ce message, ' +
      'puis t’y envoie un code à 6 chiffres pour te connecter.',
    'Ton plan est aussi joint en PDF, à garder ou à imprimer.',
    'Une question sur ton plan ? Réponds simplement à cet e-mail.',
  ];
  const signature = 'Juliette et Romain — CTS Coaching';
  const texte = [
    `Bonjour ${nom},`,
    paragraphes[0],
    `Ouvrir mon plan : ${lienApp}`,
    ...paragraphes.slice(1),
    signature,
  ].join('\n\n');
  const p = (contenu: string) => `<p style="margin:0 0 16px;line-height:1.55">${contenu}</p>`;
  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:24px 12px;background:#F3F7F0">
<div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px 28px;font-family:Helvetica,Arial,sans-serif;font-size:16px;color:#2F2D4E">
${p(`Bonjour ${echapper(nom)},`)}
${p(echapper(paragraphes[0]))}
<p style="margin:24px 0"><a href="${echapper(lienApp)}" style="display:inline-block;background:#0C6E5F;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 24px">Ouvrir mon plan</a></p>
${paragraphes.slice(1).map((x) => p(echapper(x))).join('\n')}
<p style="margin:24px 0 0;line-height:1.55;font-weight:bold">${signature}</p>
</div></body></html>`;
  return { sujet: `Ton plan CTS est prêt — ${course.nom}`, texte, html };
}

export async function envoyerBienvenue(
  email: string,
  plan: Plan,
  lienApp: string,
  pdf: { nom: string; contenu: ArrayBuffer },
) {
  const cle = process.env.BREVO_API_KEY?.trim();
  if (!cle) {
    console.warn(`E-mail de bienvenue non envoyé (${plan.course.nom}) : BREVO_API_KEY absente.`);
    return;
  }
  const { sujet, texte, html } = contenuBienvenue(plan, lienApp);
  const reponse = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': cle, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: EXPEDITEUR,
      replyTo: EXPEDITEUR,
      to: [{ email, name: plan.athlete.nom.trim() }],
      subject: sujet,
      textContent: texte,
      htmlContent: html,
      attachment: [{ name: pdf.nom, content: Buffer.from(pdf.contenu).toString('base64') }],
    }),
    cache: 'no-store',
  });
  if (!reponse.ok) throw new Error(`Brevo ${reponse.status} : ${await reponse.text()}`);
}

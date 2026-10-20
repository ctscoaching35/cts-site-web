/**
 * L'e-mail de bienvenue (cadrage de l'app, D9 : le PDF joint ; texte validé par le coach le
 * 07/10/2026). Envoyé par Brevo (API transactionnelle) une fois par plan rangé, depuis
 * lib/app/rangement.ts. Côté serveur seulement. Sans BREVO_API_KEY, rien ne part. La phrase de la
 * connexion sur un autre appareil est reprise sur décision du coach (07/10/2026, « option 1 »).
 *
 * Les phrases du plan viennent du moteur (cadrage, D3) : la date de début dite par la couverture
 * (« Ta préparation commence le… », ou la semaine rejointe).
 *
 * Un plan écrit semaine par semaine (depuis le 19/10/2026, CTS_NOLIO_CADRAGE.md, P1 et T1) : ses séances vivent
 * dans Nolio, l'invitation part à part, l'app devient son tableau de bord. BROUILLON, à valider par le coach.
 */
import type { Plan } from './plan';

// L'adresse d'envoi des essais (non authentifiée) ; une adresse du domaine cts-coaching.com,
// authentifié dans Brevo, avant l'ouverture (supabase/README.md).
export const EXPEDITEUR = {
  name: 'CTS Coaching',
  email: process.env.CTS_EMAIL_EXPEDITEUR?.trim() || 'ctscoaching35@gmail.com',
};

const sansBalises = (texte: string) => texte.replace(/<[^>]+>/g, '');
const echapper = (texte: string) =>
  texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// nolio : l'adresse où part l'invitation Nolio, pour un plan écrit semaine par semaine ; null pour un plan d'avant.
export function contenuBienvenue(plan: Plan, lienApp: string, nolio: { adresse: string } | null = null) {
  const nom = plan.athlete.nom.trim();
  const { course } = plan;
  const connexion = 'Sur un autre appareil, l’app te demande l’adresse e-mail qui reçoit ce message, puis t’y ' +
    'envoie un code à 6 chiffres pour te connecter.';
  const paragraphes = [
    `Ta préparation pour ${course.nom}, le ${course.date_lettres}, est prête. ${sansBalises(plan.couverture.debut)}`,
    ...(nolio ? [
      'Tes séances vivent dans Nolio, l’application d’entraînement que nous utilisons avec tous nos athlètes. ' +
        `Nolio t’envoie une invitation à rejoindre l’équipe CTS, à ${nolio.adresse} (pense à regarder dans tes ` +
        'indésirables) : accepte-la, et ta préparation s’installe dans ton calendrier Nolio. Chaque dimanche, Nolio te pose ' +
        'quelques questions sur ta semaine à venir, et la semaine suivante s’écrit d’après tes réponses et ta semaine écoulée.',
      'L’app CTS est ton tableau de bord : ta course et le compte à rebours, la vue d’ensemble de ta préparation, ta fiche ' +
        'de course et les fiches de la bibliothèque. Pour y revenir facilement, ajoute-la à l’écran d’accueil de ton ' +
        `téléphone : elle te montre comment à la première ouverture. ${connexion}`,
    ] : [
      'Chaque séance t’y attend au jour le jour, avec le calendrier, ton parcours et les fiches de la bibliothèque. ' +
        'Pour y revenir facilement, ajoute l’app à l’écran d’accueil de ton téléphone : elle te montre comment à ' +
        `la première ouverture. ${connexion}`,
    ]),
    'Ta préparation est aussi jointe en PDF, à garder ou à imprimer.',
    'Une question sur ta préparation ? Réponds simplement à cet e-mail.',
    // La confirmation de l'achat sur un support durable, avec la demande de début immédiat que l'acheteur a cochée
    // avant de payer et son droit de rétractation (Code de la consommation, art. L221-13 et L221-25 ; décision coach du
    // 19/10/2026 : un service, rétractable 14 jours au prorata).
    'Comme tu l’as demandé avant ton paiement, ta préparation a commencé tout de suite. Tu peux te rétracter pendant ' +
      '14 jours à compter de ton paiement, en répondant simplement à cet e-mail : nous te remboursons le prix, moins la ' +
      'part des jours de préparation déjà écoulés (article L221-25 du Code de la consommation). Le formulaire de ' +
      'rétractation est dans nos conditions de vente.',
  ];
  const signature = 'Juliette et Romain — CTS Coaching';
  const bouton = nolio ? 'Ouvrir mon tableau de bord' : 'Ouvrir ma préparation';
  const texte = [
    `Bonjour ${nom},`,
    paragraphes[0],
    `${bouton} : ${lienApp}`,
    ...paragraphes.slice(1),
    signature,
  ].join('\n\n');
  const p = (contenu: string) => `<p style="margin:0 0 16px;line-height:1.55">${contenu}</p>`;
  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:24px 12px;background:#F3F7F0">
<div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px 28px;font-family:Helvetica,Arial,sans-serif;font-size:16px;color:#2F2D4E">
${p(`Bonjour ${echapper(nom)},`)}
${p(echapper(paragraphes[0]))}
<p style="margin:24px 0"><a href="${echapper(lienApp)}" style="display:inline-block;background:#0C6E5F;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 24px">${bouton}</a></p>
${paragraphes.slice(1).map((x) => p(echapper(x))).join('\n')}
<p style="margin:24px 0 0;line-height:1.55;font-weight:bold">${signature}</p>
</div></body></html>`;
  return { sujet: `Ta Préparation CTS est prête — ${course.nom}`, texte, html };
}

export async function envoyerBienvenue(
  email: string,
  plan: Plan,
  lienApp: string,
  pdf: { nom: string; contenu: ArrayBuffer },
  nolio: { adresse: string } | null = null,
) {
  const cle = process.env.BREVO_API_KEY?.trim();
  if (!cle) {
    console.warn(`E-mail de bienvenue non envoyé (${plan.course.nom}) : BREVO_API_KEY absente.`);
    return;
  }
  const { sujet, texte, html } = contenuBienvenue(plan, lienApp, nolio);
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

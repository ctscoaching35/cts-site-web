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
 * dans Nolio, l'invitation part à part, l'app devient son tableau de bord. BROUILLON, à valider par le coach. Sans PDF
 * (décision coach du 21/10/2026 : la préparation est vivante, l'app en montre tout à jour).
 */
import { site } from '@/lib/content';
import { FORMULAIRE_RETRACTATION, vendeur, VERSION_CGV } from '@/lib/vendeur';
import { chargeEnClair, confirmationDemandee, invitationAVenir, type Charge } from './invitation';
import type { Plan } from './plan';

// L'adresse d'envoi : une adresse du domaine cts-coaching.com, authentifié dans Brevo (CTS_EMAIL_EXPEDITEUR dans
// Vercel ; supabase/README.md), sinon celle des essais, non authentifiée.
export const EXPEDITEUR = {
  name: 'CTS Coaching',
  email: process.env.CTS_EMAIL_EXPEDITEUR?.trim() || 'ctscoaching35@gmail.com',
};
// Les réponses vont à la boîte du coach : le domaine n'a pas de boîte mail (aucun enregistrement MX, 22/10/2026).
export const REPONSE = { name: 'CTS Coaching', email: 'ctscoaching35@gmail.com' };

// LA MENTION DU VENDEUR AU PIED DES E-MAILS (A-42, audits du 05/11/2026 : l'entrepreneur individuel se dit « EI », art.
// L526-22 du code de commerce), sous la signature de chaque e-mail à un acheteur.
export const PIED_LEGAL = `${vendeur.nomCommercial} — ${vendeur.nom}, ${vendeur.forme}, ${vendeur.adresse}, SIRET ${vendeur.siret}.`;
export const piedHtml = () => `<p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#5E5C78">${echapper(PIED_LEGAL)}</p>`;

const sansBalises = (texte: string) => texte.replace(/<[^>]+>/g, '');
const echapper = (texte: string) =>
  texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const enLettres = (iso: string) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
  .format(new Date(`${iso}T12:00:00Z`));
const lendemain = (iso: string) => new Date(Date.parse(`${iso}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const euros = (centimes: number) => (centimes / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }).replace(/\u202f|\u00a0/g, ' ');
const dateParis = (horodatage: string) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric' })
  .format(new Date(horodatage)).replace(/^1 /, '1er ');

// LA COMMANDE (J1, audits du 05/11/2026 ; art. L221-13 du code de la consommation : la confirmation du contrat sur un
// support durable, avec ses caractéristiques essentielles, son prix, l'identité du vendeur, les conditions de vente et le
// formulaire de rétractation). montantCentimes : ce que Stripe a encaissé, code promo déduit (le prix de la formule en
// mode test, 0 pour un achat simulé par le coach) ; payeLe : l'horodatage du paiement ; dureeMois : la formule.
export type Commande = { montantCentimes: number; payeLe: string; dureeMois: number | null };

// Les lignes de la commande, en texte (le même ordre dans le HTML). Pure : sondée à part.
export function lignesDeCommande(plan: Plan, commande: Commande, premiereSeance: string): string[] {
  const { course } = plan;
  const debut = course.date_debut_plan ?? '';
  const formule = `Préparation CTS${commande.dureeMois ? ` — ${commande.dureeMois} mois` : ''}, pour ${course.nom}, le ${course.date_lettres}`;
  return [
    `Ta formule : ${formule}.`,
    `Ta préparation : ${debut && debut >= premiereSeance ? `du ${enLettres(debut)}` : `rejointe en route, à partir du ${enLettres(premiereSeance)}`} `
      + `jusqu’à ta course, puis ta récupération ; ta première séance : le ${enLettres(premiereSeance)}.`,
    `Payée le ${dateParis(commande.payeLe)} : ${euros(commande.montantCentimes)}, TVA non applicable (article 293 B du code général `
      + 'des impôts), en une fois, sans abonnement.',
    `Vendue par ${vendeur.nom}, ${vendeur.forme}, sous le nom commercial ${vendeur.nomCommercial}, ${vendeur.adresse}, `
      + `SIRET ${vendeur.siret}, ${vendeur.email}.`,
    `Les conditions générales de vente acceptées avant ton paiement (version du ${VERSION_CGV}) : ${site.url}/cgv`,
  ];
}

// nolio : l'adresse où part l'invitation Nolio, pour un plan écrit semaine par semaine ; null pour un plan d'avant.
// aujourdhui : le jour de l'achat (Paris). commande (J1) : sa commande, en tête ; le formulaire de rétractation, en bas.
// L'e-mail juste (V3, audit de l'app plan du 03/11/2026) : « Bonjour » au prénom, une seule fois « Ta préparation », et
// la date de sa première séance (le lendemain de l'achat, C9, ou le premier lundi d'une préparation qui commence plus
// tard) à la place de « a commencé tout de suite ». L'invitation Nolio part le lundi de la semaine qui précède le départ,
// ou tout de suite s'il tombe dans les 7 jours (décision coach du 04/11/2026 au soir, lib/app/invitation.ts) ; un achat
// fait plus de 3 semaines avant elle : ce jour-là, l'app lui demande si sa charge a changé. « Déplace-la d'abord dans ton
// calendrier Nolio » (même décision : Nolio ne relie une activité à sa séance que le même jour). Une course reportée : il
// répond à cet e-mail (PL6).
export function contenuBienvenue(plan: Plan, lienApp: string, nolio: { adresse: string } | null = null,
  aujourdhui = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date()), commande: Commande | null = null) {
  const nom = plan.athlete.nom.trim();
  const prenom = nom.split(/\s+/)[0] ?? '';
  const { course } = plan;
  const debutPlan = course.date_debut_plan ?? '';
  const premiereSeance = debutPlan > lendemain(aujourdhui) ? debutPlan : lendemain(aujourdhui);
  const inviteLe = nolio ? invitationAVenir(debutPlan, aujourdhui) : null;
  const confirmer = Boolean(nolio && confirmationDemandee(debutPlan, aujourdhui));
  const connexion = 'Sur un autre appareil, l’app te demande l’adresse e-mail qui reçoit ce message, puis t’y ' +
    'envoie un code à 6 chiffres pour te connecter.';
  const paragraphes = [
    `Tout est prêt pour ${course.nom}, le ${course.date_lettres}. ${sansBalises(plan.couverture.debut)}`,
    ...(nolio ? [
      'Tes séances vivent dans Nolio, l’application d’entraînement que nous utilisons avec tous nos athlètes. ' +
        // Les deux réponses de Nolio à l'invitation (décision coach du 20/10/2026) : un compte existant l'accepte, une
        // adresse inconnue reçoit un compte créé, déjà dans l'équipe.
        `Nolio t’écrira ${inviteLe ? `le ${enLettres(inviteLe)}, une semaine avant ta première semaine, ` : ''}à ${nolio.adresse} (pense à regarder dans tes indésirables) : si tu as déjà un compte Nolio, une ` +
        'invitation à rejoindre l’équipe CTS, à accepter ; sinon, les identifiants du compte qu’il vient de te créer, déjà ' +
        'dans l’équipe. Ta première semaine s’installe dans ton calendrier Nolio la veille de son début.' +
        (confirmer ? ' Le jour de ton invitation, ton app CTS te demandera aussi si ce que tu cours a changé depuis ton achat ' +
          '(ton volume par semaine, ta plus longue sortie) : ta première semaine s’écrira sur ta réponse.' : '') +
        ' Chaque samedi, Nolio te pose quelques questions sur ta semaine à venir, et la semaine suivante s’écrit le dimanche ' +
        'soir d’après tes réponses et ta semaine écoulée. Tu cours une séance un autre jour ? Déplace-la d’abord dans ton ' +
        'calendrier Nolio.',
      'L’app CTS est ton tableau de bord : ta course et le compte à rebours, la vue d’ensemble de ta préparation, ta fiche ' +
        'de course et les fiches de la bibliothèque. Pour y revenir facilement, ajoute-la à l’écran d’accueil de ton ' +
        `téléphone : elle te montre comment à la première ouverture. ${connexion}`,
    ] : [
      'Chaque séance t’y attend au jour le jour, avec le calendrier, ton parcours et les fiches de la bibliothèque. ' +
        'Pour y revenir facilement, ajoute l’app à l’écran d’accueil de ton téléphone : elle te montre comment à ' +
        `la première ouverture. ${connexion}`,
    ]),
    ...(nolio ? [] : ['Ta préparation est aussi jointe en PDF, à garder ou à imprimer.']),
    'Ta course change de date, ou une question sur le service ? Réponds simplement à cet e-mail.',
    // La confirmation de l'achat sur un support durable, avec la demande de début immédiat que l'acheteur a cochée
    // avant de payer et son droit de rétractation (Code de la consommation, art. L221-13 et L221-25 ; décision coach du
    // 19/10/2026 : un service, rétractable 14 jours au prorata).
    `Comme tu l’as demandé avant ton paiement, ton accès a commencé tout de suite ; ta première séance est le ${enLettres(premiereSeance)}. Tu peux te rétracter pendant ` +
      '14 jours à compter de ton paiement, sans avoir à te justifier, en répondant simplement à cet e-mail ou avec le ' +
      'formulaire ci-dessous : nous te remboursons le prix, moins la part des jours de préparation déjà écoulés (article ' +
      'L221-25 du code de la consommation).',
  ];
  const signature = 'Juliette et Romain — CTS Coaching';
  const bouton = nolio ? 'Ouvrir mon tableau de bord' : 'Ouvrir ma préparation';
  const bonjour = prenom ? `Bonjour ${prenom},` : 'Bonjour,';
  // J1 : la commande en tête, le formulaire de rétractation au bout, mot pour mot celui des conditions de vente.
  const lignes = commande ? lignesDeCommande(plan, commande, premiereSeance) : [];
  const formulaire = [FORMULAIRE_RETRACTATION.titre, FORMULAIRE_RETRACTATION.consigne, FORMULAIRE_RETRACTATION.destinataire,
    ...FORMULAIRE_RETRACTATION.lignes];
  const texte = [
    bonjour,
    ...(lignes.length ? [`Ta commande\n${lignes.map((l) => `- ${l}`).join('\n')}`] : []),
    paragraphes[0],
    `${bouton} : ${lienApp}`,
    ...paragraphes.slice(1),
    formulaire.join('\n'),
    signature,
    PIED_LEGAL,
  ].join('\n\n');
  const p = (contenu: string) => `<p style="margin:0 0 16px;line-height:1.55">${contenu}</p>`;
  const lien = (l: string) => echapper(l).replace(`${site.url}/cgv`, `<a href="${site.url}/cgv" style="color:#0C6E5F">${site.url}/cgv</a>`);
  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:24px 12px;background:#F3F7F0">
<div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px 28px;font-family:Helvetica,Arial,sans-serif;font-size:16px;color:#2F2D4E">
${p(echapper(bonjour))}
${lignes.length ? `<div style="margin:0 0 20px;padding:16px 18px;border:1px solid #D6DBD2;background:#F7F9F5">
<p style="margin:0 0 8px;font-weight:bold">Ta commande</p>
${lignes.map((l) => `<p style="margin:0 0 6px;font-size:14px;line-height:1.5">${lien(l)}</p>`).join('\n')}
</div>` : ''}
${p(echapper(paragraphes[0]))}
<p style="margin:24px 0"><a href="${echapper(lienApp)}" style="display:inline-block;background:#0C6E5F;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 24px">${bouton}</a></p>
${paragraphes.slice(1).map((x) => p(echapper(x))).join('\n')}
<div style="margin:8px 0 20px;padding:14px 16px;border:1px solid #D6DBD2;font-size:14px;line-height:1.5">
${formulaire.map((l, i) => `<p style="margin:0 0 6px${i === 0 ? ';font-weight:bold' : ''}">${echapper(l)}</p>`).join('\n')}
</div>
<p style="margin:24px 0 0;line-height:1.55;font-weight:bold">${signature}</p>
${piedHtml()}
</div></body></html>`;
  return { sujet: commande ? `Ta commande est confirmée : ta Préparation CTS pour ${course.nom}` : `Ta Préparation CTS est prête — ${course.nom}`, texte, html };
}

// aujourdhui : le jour de l'achat (Paris), pour un renvoi par le passage quotidien (J1) ; aujourd'hui sinon. Rend false
// sans clé Brevo (rien n'est parti), true quand Brevo l'a pris ; une erreur sinon.
export async function envoyerBienvenue(
  email: string,
  plan: Plan,
  lienApp: string,
  pdf: { nom: string; contenu: ArrayBuffer } | null,
  nolio: { adresse: string } | null = null,
  commande: Commande | null = null,
  aujourdhui?: string,
): Promise<boolean> {
  const cle = process.env.BREVO_API_KEY?.trim();
  if (!cle) {
    console.warn(`E-mail de bienvenue non envoyé (${plan.course.nom}) : BREVO_API_KEY absente.`);
    return false;
  }
  const { sujet, texte, html } = contenuBienvenue(plan, lienApp, nolio, aujourdhui, commande);
  const reponse = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': cle, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: EXPEDITEUR,
      replyTo: REPONSE,
      to: [{ email, name: plan.athlete.nom.trim() }],
      subject: sujet,
      textContent: texte,
      htmlContent: html,
      ...(pdf ? { attachment: [{ name: pdf.nom, content: Buffer.from(pdf.contenu).toString('base64') }] } : {}),
    }),
    cache: 'no-store',
  });
  if (!reponse.ok) throw new Error(`Brevo ${reponse.status} : ${await reponse.text()}`);
  return true;
}

// La relance d'une invitation Nolio pas encore acceptée, trois jours après l'achat (décision coach du 21/10/2026 :
// « relance puis alerte ») ; lib/app/ecriture.ts, relancerInvitations. BROUILLON validé par le coach le 21/10/2026.
export function contenuRelanceInvitation(nom: string, lienApp: string) {
  const prenom = nom.trim().split(/\s+/)[0] ?? '';
  const paragraphes = [
    'Tes séances n’ont pas encore pu arriver : Nolio attend que tu acceptes son invitation à rejoindre l’équipe CTS. '
      + 'Elle est arrivée par e-mail à l’adresse de ton achat, ou à celle de ton compte Nolio (pense à regarder dans tes '
      + 'indésirables). Dès que tu l’acceptes, ta préparation s’installe dans ton calendrier Nolio.',
    'Tu ne la trouves pas ? Réponds simplement à cet e-mail : nous t’en renvoyons une.',
  ];
  const signature = 'Juliette et Romain — CTS Coaching';
  const bouton = 'Ouvrir mon tableau de bord';
  const bonjour = prenom ? `Bonjour ${prenom},` : 'Bonjour,';
  const texte = [bonjour, ...paragraphes, `${bouton} : ${lienApp}`, signature, PIED_LEGAL].join('\n\n');
  const p = (contenu: string) => `<p style="margin:0 0 16px;line-height:1.55">${contenu}</p>`;
  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:24px 12px;background:#F3F7F0">
<div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px 28px;font-family:Helvetica,Arial,sans-serif;font-size:16px;color:#2F2D4E">
${p(echapper(bonjour))}
${paragraphes.map((x) => p(echapper(x))).join('\n')}
<p style="margin:24px 0"><a href="${echapper(lienApp)}" style="display:inline-block;background:#0C6E5F;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 24px">${bouton}</a></p>
<p style="margin:24px 0 0;line-height:1.55;font-weight:bold">${signature}</p>
${piedHtml()}
</div></body></html>`;
  return { sujet: 'Ta Préparation CTS t’attend dans Nolio', texte, html };
}

export async function envoyerRelanceInvitation(email: string, nom: string, lienApp: string) {
  const cle = process.env.BREVO_API_KEY?.trim();
  if (!cle) {
    console.warn('Relance de l’invitation non envoyée : BREVO_API_KEY absente.');
    return;
  }
  const { sujet, texte, html } = contenuRelanceInvitation(nom, lienApp);
  const reponse = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': cle, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: EXPEDITEUR, replyTo: REPONSE, to: [{ email, name: nom.trim() || email }],
      subject: sujet, textContent: texte, htmlContent: html,
    }),
    cache: 'no-store',
  });
  if (!reponse.ok) throw new Error(`Brevo ${reponse.status} : ${await reponse.text()}`);
}

// LE RAPPEL DE LA CONFIRMATION DE CHARGE (décision coach du 04/11/2026 au soir, « A » ; lib/app/confirmation.ts) : le
// samedi qui précède le départ, à l'acheteur qui n'a pas répondu à la carte de son app. Sans réponse, rien ne bloque.
// BROUILLON, à valider par le coach.
export function contenuRappelConfirmation(nom: string, lienApp: string, charge: Charge) {
  const prenom = nom.trim().split(/\s+/)[0] ?? '';
  const paragraphes = [
    `Ta préparation commence lundi. À ton achat, tu nous disais ${chargeEnClair(charge)}. C’est toujours vrai ?`,
    'Réponds dans ton app CTS d’ici dimanche 18 h : « Oui », ou corrige en quelques secondes. Ta première semaine '
      + 's’écrit dimanche soir sur ta réponse ; sans réponse, elle part de tes réponses de l’achat.',
  ];
  const signature = 'Juliette et Romain — CTS Coaching';
  const bouton = 'Répondre dans mon app';
  const bonjour = prenom ? `Bonjour ${prenom},` : 'Bonjour,';
  const texte = [bonjour, ...paragraphes, `${bouton} : ${lienApp}`, signature, PIED_LEGAL].join('\n\n');
  const p = (contenu: string) => `<p style="margin:0 0 16px;line-height:1.55">${contenu}</p>`;
  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:24px 12px;background:#F3F7F0">
<div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px 28px;font-family:Helvetica,Arial,sans-serif;font-size:16px;color:#2F2D4E">
${p(echapper(bonjour))}
${paragraphes.map((x) => p(echapper(x))).join('\n')}
<p style="margin:24px 0"><a href="${echapper(lienApp)}" style="display:inline-block;background:#0C6E5F;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 24px">${bouton}</a></p>
<p style="margin:24px 0 0;line-height:1.55;font-weight:bold">${signature}</p>
${piedHtml()}
</div></body></html>`;
  return { sujet: 'Avant ta première semaine : ce que tu cours a-t-il changé ?', texte, html };
}

export async function envoyerRappelConfirmation(email: string, nom: string, lienApp: string, charge: Charge) {
  const cle = process.env.BREVO_API_KEY?.trim();
  if (!cle) {
    console.warn('Rappel de la confirmation non envoyé : BREVO_API_KEY absente.');
    return;
  }
  const { sujet, texte, html } = contenuRappelConfirmation(nom, lienApp, charge);
  const reponse = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': cle, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: EXPEDITEUR, replyTo: REPONSE, to: [{ email, name: nom.trim() || email }],
      subject: sujet, textContent: texte, htmlContent: html,
    }),
    cache: 'no-store',
  });
  if (!reponse.ok) throw new Error(`Brevo ${reponse.status} : ${await reponse.text()}`);
}

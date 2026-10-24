/**
 * Après le paiement : ranger le plan dans le compte de l'athlète (cadrage de l'app, D4 à D6 ;
 * bêta privée du 07/10/2026). Côté serveur seulement — la clé de service y sert.
 *
 * 1. L'API rend le plan d'une session payée (POST /v1/plans, idempotent), ses données, son PDF.
 * 2. Le compte est retrouvé, ou créé confirmé, sur l'e-mail du questionnaire : on s'y reconnecte
 *    ensuite par code, comme tout compte. Supabase fabrique un lien de connexion, sans l'envoyer.
 * 3. L'achat (unique par session de paiement), puis le plan figé et son PDF sont rangés une seule
 *    fois : une page rechargée ne range rien de plus, et un rangement interrompu se reprend. La page de
 *    retour et le webhook de Stripe (app/api/stripe/webhook) appellent tous deux cette fonction, parfois au
 *    même instant : un plan par achat (index plans_un_par_achat), le second appel reprend le premier.
 * 4. L'e-mail de bienvenue part avec le PDF, par l'appel qui a rangé le plan, donc une fois.
 * 5. Un plan écrit semaine par semaine (ses paramètres, moteur 8.325) attend son invitation dans l'équipe Nolio du coach
 *    (CTS_NOLIO_CADRAGE.md, P1 à P4) : l'appelant la lance après sa réponse (lib/app/ecriture.ts, inviterAcheteur).
 */
import type { EmailOtpType } from '@supabase/supabase-js';
import { API_URL } from '@/lib/plan';
import { compteDuCoach } from './ecriture';
import { envoyerBienvenue } from './emailBienvenue';
import { retirerRelance } from './relance';
import type { Plan } from './plan';
import { clientService } from './supabase';

// La connexion sans code ne vaut que dans l'heure qui suit l'achat : un lien de retour de paiement
// retrouvé plus tard dans un historique ne connecte personne.
const SANS_CODE_PENDANT_MS = 60 * 60 * 1000;

export const MESSAGE_RANGEMENT =
  'Ta préparation est prête, mais elle n’a pas pu être rangée dans ton compte, et ton paiement est bien enregistré. ' +
  'Écris-nous par le formulaire de contact de cts-coaching.com en donnant ce lien : Juliette ou Romain te ' +
  'répondent sous 48 h.';

// Une phrase de l'API écrite pour l'athlète (refus, échec de génération) : la page la montre telle quelle.
export class ErreurAchat extends Error {}

async function lire(chemin: string | null) {
  if (!chemin) throw new Error('plan sans données');
  const reponse = await fetch(`${API_URL}${chemin}`, { cache: 'no-store' });
  if (!reponse.ok) throw new Error(`${chemin} : ${reponse.status}`);
  return reponse;
}

// Le nom du PDF donné par l'API (« CTS_Plan_<nom>.pdf »).
const nomDuPdf = (reponse: Response) =>
  /filename="?([^";]+)"?/.exec(reponse.headers.get('content-disposition') ?? '')?.[1] ?? 'CTS_Plan.pdf';

// origine : l'adresse du site (https://cts-coaching.com), pour le lien de l'e-mail de bienvenue.
// Un achat simulé par le coach (« coach_… », décision coach du 24/10/2026) : relu avec le code du coach, noté à 0 €.
const SIMULE = 'coach_';
export async function rangerLePlan(sessionId: string, origine: string) {
  const simule = sessionId.startsWith(SIMULE);
  const reponse = await fetch(`${API_URL}/v1/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(simule && process.env.CTS_CLE_COACH ? { 'X-CTS-Coach': process.env.CTS_CLE_COACH } : {}) },
    body: JSON.stringify({ checkout_session_id: sessionId }),
    cache: 'no-store',
  });
  const corps = await reponse.json().catch(() => null);
  if (!reponse.ok || !corps) throw new ErreurAchat(corps?.message ?? MESSAGE_RANGEMENT);

  const service = clientService();
  const email = String(corps.resume.email).trim().toLowerCase();
  const { error: erreurCreation } = await service.auth.admin.createUser({ email, email_confirm: true });
  if (erreurCreation && erreurCreation.code !== 'email_exists') throw new Error(`compte : ${erreurCreation.message}`);
  const { data: lien, error: erreurLien } = await service.auth.admin.generateLink({ type: 'magiclink', email });
  if (erreurLien || !lien.user) throw new Error(`lien de connexion : ${erreurLien?.message ?? 'sans utilisateur'}`);
  const compteId = lien.user.id;
  const { error: erreurCompte } = await service.from('comptes').upsert({ id: compteId, nom: corps.resume.athlete });
  if (erreurCompte) throw new Error(`comptes : ${erreurCompte.message}`);

  const trouverAchat = () =>
    service.from('achats').select('id, paye_le').eq('stripe_session', sessionId).maybeSingle();
  let { data: achat } = await trouverAchat();
  if (!achat) {
    const { data: nouvel, error } = await service
      .from('achats')
      // Le montant réellement payé, code promo déduit (CTS_LANCEMENT_CADRAGE.md, L6) ; le prix de la formule en mode test.
      .insert({
        compte_id: compteId, stripe_session: sessionId,
        montant_centimes: simule ? 0 : corps.resume.montant_paye_centimes ?? Math.round(corps.resume.prix_eur * 100),
      })
      .select('id, paye_le')
      .single();
    // 23505 : rangé à l'instant par un autre appel (un second onglet).
    if (error && error.code !== '23505') throw new Error(`achats : ${error.message}`);
    achat = nouvel ?? (await trouverAchat()).data;
  }
  if (!achat) throw new Error('achat introuvable');
  // L'achat fait, plus de relance du questionnaire (L3).
  await retirerRelance(email).catch((e) => console.error(`Relance de l'achat ${sessionId} :`, e));

  const { data: plans, error: erreurPlans } = await service.from('plans').select('id, achat_id').eq('compte_id', compteId);
  if (erreurPlans) throw new Error(`plans : ${erreurPlans.message}`);
  let planId = plans.find((p) => p.achat_id === achat.id)?.id;
  if (!planId) {
    const donnees: Plan = await (await lire(corps.donnees_url)).json();
    // Une préparation vivante n'a plus de PDF (décision coach du 21/10/2026) : ni rangé, ni joint à l'e-mail.
    const reponsePdf = corps.parametres ? null : await lire(corps.pdf_url);
    const pdf = reponsePdf ? await reponsePdf.arrayBuffer() : null;
    const { data: plan, error } = await service
      .from('plans')
      .insert({
        compte_id: compteId,
        achat_id: achat.id,
        course_nom: donnees.course.nom,
        course_date: donnees.course.date,
        debut_plan: donnees.course.date_debut_plan,
        schema: donnees.schema,
        version_moteur: donnees.version_moteur,
        donnees,
        intake: corps.intake ?? {},
        // L'écriture semaine par semaine (T3) : les paramètres du moteur ; l'invitation Nolio à faire (P1), avec
        // l'adresse de son compte Nolio s'il l'a donnée ; son accord de lecture (T5).
        ...(corps.parametres ? {
          parametres: corps.parametres, nolio_statut: 'a_inviter', coach_id: await compteDuCoach(),
          nolio_email: corps.acheteur?.nolio_email ?? null,
          accord_lecture_le: corps.acheteur?.accord_lecture ? new Date().toISOString() : null,
        } : {}),
      })
      .select('id')
      .single();
    if (error?.code === '23505') {
      // Rangé à l'instant par l'autre appel (la page de retour ou le webhook) : il range aussi le PDF et
      // envoie l'e-mail ; celui-ci reprend son plan.
      const { data: deja } = await service.from('plans').select('id').eq('achat_id', achat.id).maybeSingle();
      if (!deja) throw new Error('plans : plan de l’achat introuvable');
      planId = deja.id;
    } else if (error || !plan) {
      throw new Error(`plans : ${error?.message}`);
    } else {
      planId = plan.id;
      if (pdf) {
        const chemin = `${compteId}/${plan.id}.pdf`;
        const { error: erreurPdf } = await service.storage
          .from('plans-pdf')
          .upload(chemin, pdf, { contentType: 'application/pdf', upsert: true });
        if (erreurPdf) throw new Error(`PDF : ${erreurPdf.message}`);
        await service.from('plans').update({ pdf_chemin: chemin }).eq('id', plan.id);
      }
      // Le plan est rangé : un e-mail qui échoue ne le défait pas, il se signale dans le journal.
      try {
        await envoyerBienvenue(email, donnees, `${origine}/app`, reponsePdf && pdf ? { nom: nomDuPdf(reponsePdf), contenu: pdf } : null,
          corps.parametres ? { adresse: corps.acheteur?.nolio_email || email } : null);
      } catch (e) {
        console.error(`E-mail de bienvenue de l'achat ${sessionId} :`, e);
      }
    }
  }

  // SANS CODE, SEULEMENT DANS UN COMPTE QUE CET ACHAT VIENT D'OUVRIR. L'e-mail du questionnaire n'est
  // pas prouvé : un compte qui portait déjà un autre plan (un achat d'avant, ou l'e-mail de
  // quelqu'un d'autre tapé au questionnaire) s'ouvre avec le code reçu sur cette adresse.
  const compteNeuf = plans.every((p) => p.achat_id === achat.id);
  return {
    planId,
    email,
    aInviter: Boolean(corps.parametres),
    jeton: lien.properties.hashed_token,
    type: lien.properties.verification_type as EmailOtpType,
    sansCode: compteNeuf && Date.now() - Date.parse(achat.paye_le) < SANS_CODE_PENDANT_MS,
  };
}

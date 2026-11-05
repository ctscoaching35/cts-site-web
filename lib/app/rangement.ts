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
 * 4. L'e-mail de bienvenue part avec le PDF, par l'appel qui a rangé le plan, donc une fois. Il est la confirmation de
 *    la commande (J1, audits du 05/11/2026 : formule, prix payé, dates, vendeur, CGV, formulaire de rétractation) ; un
 *    envoi qui échoue prévient le coach et se refait chaque jour (renvoyerLesConfirmations), 14 jours au plus.
 * 6. Payé mais pas rangé (E2, audits du 05/11/2026) : la page dit ce qui est vrai (le paiement est enregistré, la
 *    préparation arrive par e-mail), et le coach est prévenu au premier échec (signalerIncidentAchat), une seule fois.
 * 5. Un plan écrit semaine par semaine (ses paramètres, moteur 8.325) attend son invitation dans l'équipe Nolio du coach
 *    (CTS_NOLIO_CADRAGE.md, P1 à P4) : l'appelant la lance après sa réponse (lib/app/ecriture.ts, inviterAcheteur).
 */
import type { EmailOtpType } from '@supabase/supabase-js';
import { API_URL } from '@/lib/plan';
import { compteDuCoach, prevenirCoach } from './ecriture';
import { envoyerBienvenue, type Commande } from './emailBienvenue';
import { retirerRelance } from './relance';
import type { Plan } from './plan';
import { site } from '@/lib/content';
import { clientService } from './supabase';
import { enTetesMoteur } from './cleMoteur';

// La connexion sans code ne vaut que dans l'heure qui suit l'achat : un lien de retour de paiement
// retrouvé plus tard dans un historique ne connecte personne.
const SANS_CODE_PENDANT_MS = 60 * 60 * 1000;

// E2 (audits du 05/11/2026) : le message vrai d'un paiement que le site n'a pas pu ranger. Validé par le coach le
// 05/11/2026 au soir (CTS_TEXTES_A_VALIDER.md, L) : l'adresse e-mail au lieu du formulaire de contact.
export const MESSAGE_RANGEMENT =
  'Ton paiement est bien enregistré. Ta préparation n’a pas encore pu être rangée dans ton compte : le site réessaie, et ' +
  'tu la reçois par e-mail dès qu’elle est prête. Nous sommes prévenus. Sans e-mail de notre part d’ici quelques heures, ' +
  'écris-nous à ctscoaching35@gmail.com avec l’adresse e-mail de ton achat : nous te répondons sous 48 h.';

// Une phrase de l'API écrite pour l'athlète (refus, échec de génération) : la page la montre telle quelle. statut : la
// réponse du moteur (402 : pas encore payé ; 404 : session inconnue ; rien de payé à signaler au coach).
export class ErreurAchat extends Error {
  constructor(message: string, public statut: number | null = null) {
    super(message);
  }
}

// LE COACH PRÉVENU D'UN INCIDENT D'ACHAT (E2 et J1, audits du 05/11/2026) : un achat payé pas rangé, ou une confirmation
// de commande qui n'est pas partie ; une seule fois par clé (la table achats_incidents, migration du 05/11/2026 : sans
// elle, à chaque échec). Ni le nom ni l'e-mail de l'acheteur dans la clé ; la session de paiement suffit à le retrouver
// dans Stripe.
export async function signalerIncidentAchat(cle: string, sujet: string, texte: string) {
  const { data, error } = await clientService().from('achats_incidents')
    .upsert({ stripe_session: cle }, { onConflict: 'stripe_session', ignoreDuplicates: true }).select('stripe_session');
  if (!error && !data?.length) return;
  await prevenirCoach(sujet, texte);
}

// Le premier échec du rangement d'un achat payé (la page de retour et le webhook de Stripe, qui le retentent) : le coach
// le sait avant l'acheteur. Pas pour un paiement pas encore confirmé (402), une session inconnue (404) ou un achat simulé.
export async function signalerAchatNonRange(sessionId: string, e: unknown) {
  if (sessionId.startsWith(SIMULE) || (e instanceof ErreurAchat && (e.statut === 402 || e.statut === 404))) return;
  const raison = e instanceof Error ? e.message : String(e);
  await signalerIncidentAchat(sessionId, 'Plan CTS : un achat payé n’a pas pu être rangé',
    `Un paiement est enregistré (session Stripe ${sessionId}), mais le site n’a pas pu ranger sa préparation dans le compte `
    + `de l’acheteur : ${raison} Le site réessaie à chaque retour sur sa page, et Stripe rappelle le site pendant trois `
    + 'jours. Si rien n’arrive, retrouve le paiement dans Stripe par cette session, et écris à l’acheteur : il a lu que son '
    + 'paiement est enregistré et que sa préparation arrive par e-mail.').catch((x) => console.error(`Incident d’achat ${sessionId} :`, x instanceof Error ? x.message : x));
}

async function lire(chemin: string | null) {
  if (!chemin) throw new Error('plan sans données');
  const reponse = await fetch(`${API_URL}${chemin}`, { cache: 'no-store', headers: enTetesMoteur() });
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
    headers: enTetesMoteur({ 'Content-Type': 'application/json', ...(simule && process.env.CTS_CLE_COACH ? { 'X-CTS-Coach': process.env.CTS_CLE_COACH } : {}) }),
    body: JSON.stringify({ checkout_session_id: sessionId }),
    cache: 'no-store',
  });
  const corps = await reponse.json().catch(() => null);
  if (!reponse.ok || !corps) throw new ErreurAchat(corps?.message ?? MESSAGE_RANGEMENT, reponse.status);

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
      // Le plan est rangé : un e-mail qui échoue ne le défait pas. J1 : c'est la confirmation de la commande ; partie, sa
      // date se garde ; en échec, le coach est prévenu et le passage quotidien la refait (renvoyerLesConfirmations).
      const commande: Commande = {
        montantCentimes: simule ? 0 : corps.resume.montant_paye_centimes ?? Math.round(corps.resume.prix_eur * 100),
        payeLe: achat.paye_le, dureeMois: Number(corps.resume.duree_mois) || null,
      };
      try {
        const parti = await envoyerBienvenue(email, donnees, `${origine}/app`, reponsePdf && pdf ? { nom: nomDuPdf(reponsePdf), contenu: pdf } : null,
          corps.parametres ? { adresse: corps.acheteur?.nolio_email || email } : null, commande);
        if (parti) await service.from('plans').update({ bienvenue_envoyee_le: new Date().toISOString() }).eq('id', plan.id);
      } catch (e) {
        console.error(`E-mail de bienvenue de l'achat ${sessionId} :`, e);
        if (!simule) {
          await signalerIncidentAchat(`${sessionId}:bienvenue`, 'Plan CTS : une confirmation de commande n’est pas partie',
            `L’e-mail de bienvenue et de confirmation de commande d’un achat (session Stripe ${sessionId}, plan « ${donnees.course.nom} ») `
            + 'n’est pas parti. Le site le renvoie chaque soir, 14 jours au plus ; sa préparation, elle, est rangée.')
            .catch((x) => console.error(`Incident de l’e-mail ${sessionId} :`, x instanceof Error ? x.message : x));
        }
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

// LE RENVOI DE LA CONFIRMATION DE COMMANDE (J1, audits du 05/11/2026) : chaque jour, les plans achetés ces 14 derniers
// jours dont l'e-mail de bienvenue n'est pas parti (bienvenue_envoyee_le, migration du 05/11/2026 ; sans elle, rien ne se
// renvoie) ; l'e-mail dit le jour de l'achat, pas celui du renvoi. Sans clé Brevo, rien ne part.
export const JOURS_RENVOI_CONFIRMATION = 14;
export async function renvoyerLesConfirmations(): Promise<{ plan: string; quoi: string; erreur?: string }[]> {
  const service = clientService();
  const { data, error } = await service.from('plans')
    .select('id, compte_id, donnees, intake, parametres, nolio_email, cree_le, achat_id, achats(montant_centimes, paye_le, stripe_session)')
    .is('bienvenue_envoyee_le', null).not('achat_id', 'is', null)
    .gte('cree_le', new Date(Date.now() - JOURS_RENVOI_CONFIRMATION * 86400_000).toISOString());
  if (error || !data?.length) return [];
  const comptes: { plan: string; quoi: string; erreur?: string }[] = [];
  for (const p of data) {
    const achat = (Array.isArray(p.achats) ? p.achats[0] : p.achats) as { montant_centimes: number; paye_le: string; stripe_session: string } | null;
    if (!achat || String(achat.stripe_session).startsWith(SIMULE)) continue;
    try {
      const { data: u } = await service.auth.admin.getUserById(String(p.compte_id));
      const email = u?.user?.email;
      if (!email) continue;
      const jourAchat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(achat.paye_le));
      const parti = await envoyerBienvenue(email, p.donnees as Plan, `${site.url}/app`, null,
        p.parametres ? { adresse: String(p.nolio_email || email) } : null,
        { montantCentimes: achat.montant_centimes, payeLe: achat.paye_le, dureeMois: Number((p.intake as Record<string, unknown> | null)?.duree_mois) || null },
        jourAchat);
      if (!parti) continue;
      await service.from('plans').update({ bienvenue_envoyee_le: new Date().toISOString() }).eq('id', p.id);
      comptes.push({ plan: String(p.id), quoi: 'confirmation de commande renvoyée' });
    } catch (e) {
      comptes.push({ plan: String(p.id), quoi: 'confirmation de commande pas encore partie', erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  return comptes;
}

// LES ACHATS GARDÉS 10 ANS, PUIS EFFACÉS (3A, décision coach du 05/11/2026 au soir ; la politique de confidentialité :
// « la date, le montant payé et la référence du paiement, gardés 10 ans pour notre comptabilité »). Chaque jour, le
// passage quotidien efface les lignes de la table achats payées il y a plus de 10 ans, d'après leur date de paiement
// (achats.paye_le). Rien d'autre : ni compte, ni plan. Un plan encore là garde tout ; seul son lien à l'achat effacé se
// vide (plans.achat_id, « on delete set null », migration du 07/10/2026), comme quand un compte s'efface avant son achat.
// Sans bruit : une ligne au compte rendu du passage quand un achat part ou que l'effacement échoue, rien sinon.
export const ANS_GARDE_ACHATS = 10;
export function limiteDesAchats(maintenant = new Date()): string {
  const limite = new Date(maintenant);
  limite.setUTCFullYear(limite.getUTCFullYear() - ANS_GARDE_ACHATS);
  return limite.toISOString();
}
export async function effacerLesAchatsEchus(maintenant = new Date()): Promise<{ plan: string; quoi: string; erreur?: string }[]> {
  const { data, error } = await clientService().from('achats').delete().lt('paye_le', limiteDesAchats(maintenant)).select('id');
  if (error) return [{ plan: '', quoi: `achats de plus de ${ANS_GARDE_ACHATS} ans non effacés`, erreur: error.message }];
  const n = data?.length ?? 0;
  return n ? [{ plan: '', quoi: `${n} achat${n > 1 ? 's' : ''} de plus de ${ANS_GARDE_ACHATS} ans effacé${n > 1 ? 's' : ''}` }] : [];
}

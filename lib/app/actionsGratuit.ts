'use server';
/**
 * Les actions de l'app gratuite (lot A1) : le code de connexion (la création du compte n'est permise qu'ici, jamais dans
 * le parcours des acheteurs), ce que le nouveau compte garde de la session du visiteur, les tests d'un compte gratuit.
 * Les lignes du compte s'écrivent avec SA session (les règles de la base : chacun ne touche que les siennes) ; seule la
 * ligne `comptes` (la clé des tables) est posée par le serveur.
 */
import { revalidatePath } from 'next/cache';
import { lireAcces } from './acces';
import { gratuitOuvert } from './gratuit';
import { listeBranchee, retirerDeLaListe } from './listeEmail';
import { majListeSiInscrit, synchroniserListe } from './listeGratuit';
import { rangerDossier } from './rangerDossier';
import { aDesFcGardees, calculer, saisieSure, sansLaFc, testsSurs, type TestsGratuits } from './profilGratuit';
import { assurerCompte } from './compteGratuit';
import { clientServeur } from './supabase';

export type EtatGratuit = { ok: boolean; message: string };

const aujourdhui = () => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());

// Le code à 6 chiffres par e-mail. Seule porte de création de compte sans achat ; fermée en mode « coupe » (et sans le
// lien secret en mode « invitation »). Le message est le même qu'un compte existe ou non.
export async function demanderCodeGratuit(email: string): Promise<EtatGratuit> {
  if (!(await gratuitOuvert())) return { ok: false, message: 'La connexion n’est pas ouverte pour l’instant.' };
  const adresse = String(email ?? '').trim().toLowerCase();
  if (adresse.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse))
    return { ok: false, message: 'Cette adresse e-mail ne semble pas valide.' };
  const { error } = await (await clientServeur()).auth.signInWithOtp({ email: adresse, options: { shouldCreateUser: true } });
  if (error) {
    if (error.status === 429 || /rate|limit|seconds/i.test(error.message))
      return { ok: false, message: 'Trop de codes demandés d’un coup : attends une minute, puis redemande-le.' };
    console.error('Code de l’app gratuite :', error.message);
    return { ok: false, message: 'Le code n’est pas parti. Réessaie dans un moment.' };
  }
  return { ok: true, message: '' };
}

type Ligne = { tests: TestsGratuits; consentement_fc_le: string | null; liste_email_le: string | null };
async function ligneDuCompte(compteId: string): Promise<Ligne | null> {
  const { data } = await (await clientServeur()).from('profils_gratuits').select('tests, consentement_fc_le, liste_email_le')
    .eq('compte_id', compteId).maybeSingle();
  return data ? { tests: testsSurs(data.tests), consentement_fc_le: data.consentement_fc_le ?? null,
    liste_email_le: data.liste_email_le ?? null } : null;
}

// Juste après la connexion par code : ce que le visiteur avait sous les yeux, et son accord à la liste e-mail, entrent dans
// son compte, dans la même session. Un compte qui n'est pas gratuit (un acheteur, un coaché) ne reçoit rien : ses tests
// vivent ailleurs. Le navigateur efface alors son brouillon.
export async function garderApresConnexion(entree: { saisie: unknown; liste: boolean; consentementFc: boolean; dossier?: unknown }):
  Promise<EtatGratuit & { gratuit: boolean }> {
  const acces = await lireAcces();
  if (acces.cas !== 'gratuit' || !acces.compteId) return { ok: true, message: '', gratuit: false };
  try {
    await assurerCompte(acces.compteId);
    const existant = await ligneDuCompte(acces.compteId);
    const jour = aujourdhui();
    const saisie = saisieSure(entree.saisie);
    const calcul = calculer(saisie, jour);
    const accordFc = Boolean(entree.consentementFc || existant?.consentement_fc_le);
    // Ce qui entre : ses tests de la session (sans la FC sans accord) par-dessus ce que le compte avait, test par test.
    const nouveaux = calcul.ok ? (accordFc ? calcul.tests : sansLaFc(calcul.tests)) : {};
    const tests = { ...(existant?.tests ?? {}), ...nouveaux };
    const maintenant = new Date().toISOString();
    const { error } = await (await clientServeur()).from('profils_gratuits').upsert({
      compte_id: acces.compteId,
      tests,
      consentement_fc_le: existant?.consentement_fc_le ?? (entree.consentementFc && calcul.ok && aDesFcGardees(calcul.tests) ? maintenant : null),
      liste_email_le: existant?.liste_email_le ?? (entree.liste ? maintenant : null),
      maj_le: maintenant,
    }, { onConflict: 'compte_id' });
    if (error) throw new Error(error.message);
    // La liste e-mail (Brevo) : inscrit avec ce que l'app connaît ; un échec ne bloque rien (journalisé, réessayé au prochain
    // changement du profil).
    if (acces.email && (existant?.liste_email_le || entree.liste)) await synchroniserListe(acces.compteId, acces.email);
  } catch (e) {
    console.error('Garder le profil du visiteur :', e instanceof Error ? e.message : e);
    return { ok: false, message: 'Ton compte est ouvert, mais ton profil n’a pas pu être gardé. Refais ton test depuis ton profil.', gratuit: true };
  }
  // Son dossier de course (lot B), s'il en avait un sous les yeux : il entre dans son compte, après son profil (la liste e-mail
  // a ainsi sa prochaine course). Un échec ne défait pas le profil : il est dit.
  if (entree.dossier) {
    try {
      const r = await rangerDossier(acces.compteId, acces.email, entree.dossier);
      if (!r.ok) return { ok: false, message: r.message, gratuit: true };
    } catch (e) {
      console.error('Garder le dossier du visiteur :', e instanceof Error ? e.message : e);
      return { ok: false, message: 'Ton compte est ouvert, mais ton dossier de course n’a pas pu être gardé. Refais-le depuis tes courses.', gratuit: true };
    }
  }
  // Pas de revalidatePath ici : l'écran « Me connecter » doit rester sur « C’est gardé » (le recharger, avec une session,
  // le renverrait à l'accueil).
  return { ok: true, message: '', gratuit: true };
}

// Les tests d'un compte gratuit (le formulaire du profil) : le profil entier, tel que le formulaire le montre. La FC ne
// se garde qu'avec l'accord, donné une fois (comme « Tes zones » des acheteurs).
export async function enregistrerProfilGratuit(entree: { saisie: unknown; consentementFc: boolean }): Promise<EtatGratuit> {
  const acces = await lireAcces();
  if (acces.cas !== 'gratuit' || !acces.compteId) return { ok: false, message: 'Ta session a expiré : reconnecte-toi.' };
  const calcul = calculer(saisieSure(entree.saisie), aujourdhui());
  if (!calcul.ok) return { ok: false, message: calcul.message };
  try {
    const existant = await ligneDuCompte(acces.compteId);
    const avecFc = aDesFcGardees(calcul.tests);
    if (avecFc && !existant?.consentement_fc_le && !entree.consentementFc)
      return { ok: false, message: 'Coche la case pour que City to Summit garde tes valeurs : sans ton accord, rien n’est enregistré.' };
    await assurerCompte(acces.compteId);
    const maintenant = new Date().toISOString();
    const { error } = await (await clientServeur()).from('profils_gratuits').upsert({
      compte_id: acces.compteId, tests: calcul.tests,
      consentement_fc_le: existant?.consentement_fc_le ?? (avecFc ? maintenant : null), maj_le: maintenant,
    }, { onConflict: 'compte_id' });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error('Tes tests (compte gratuit) :', e instanceof Error ? e.message : e);
    return { ok: false, message: 'L’enregistrement n’a pas abouti. Réessaie dans un moment.' };
  }
  // Ses attributs suivent chez Brevo, s'il est inscrit ; un échec ne bloque rien.
  if (acces.email) await majListeSiInscrit(acces.compteId, acces.email);
  revalidatePath('/app', 'layout');
  return { ok: true, message: 'C’est enregistré.' };
}

// La case « les e-mails de City to Summit » de Compte : s'inscrire ou se désinscrire. La date de l'accord est gardée avec le
// profil (liste_email_le), vide sans accord. Se désinscrire : le contact quitte la liste chez Brevo ; la date ne s'efface que
// quand Brevo a répondu (ou que la liste n'est pas branchée : rien n'a jamais été envoyé), pour qu'une désinscription ratée
// ne passe jamais pour faite.
export async function changerListeEmail(inscrit: boolean): Promise<EtatGratuit & { inscrit: boolean }> {
  const acces = await lireAcces();
  if (acces.cas !== 'gratuit' || !acces.compteId || !acces.email) return { ok: false, message: 'Ta session a expiré : reconnecte-toi.', inscrit: !inscrit };
  try {
    const supabase = await clientServeur();
    const existant = await ligneDuCompte(acces.compteId);
    const maintenant = new Date().toISOString();
    if (inscrit) {
      await assurerCompte(acces.compteId);
      const { error } = await supabase.from('profils_gratuits').upsert({
        compte_id: acces.compteId, tests: existant?.tests ?? {},
        consentement_fc_le: existant?.consentement_fc_le ?? null, liste_email_le: existant?.liste_email_le ?? maintenant, maj_le: maintenant,
      }, { onConflict: 'compte_id' });
      if (error) throw new Error(error.message);
      await synchroniserListe(acces.compteId, acces.email);
    } else {
      if (listeBranchee() && !(await retirerDeLaListe(acces.email)))
        return { ok: false, inscrit: true, message: 'La désinscription n’a pas abouti. Réessaie dans un moment, ou utilise le lien de désinscription en bas d’un de nos e-mails.' };
      if (existant) {
        const { error } = await supabase.from('profils_gratuits').update({ liste_email_le: null, maj_le: maintenant }).eq('compte_id', acces.compteId);
        if (error) throw new Error(error.message);
      }
    }
  } catch (e) {
    console.error('Liste e-mail (compte gratuit) :', e instanceof Error ? e.message : e);
    return { ok: false, message: 'Ça n’a pas abouti. Réessaie dans un moment.', inscrit: !inscrit };
  }
  revalidatePath('/app/compte');
  return { ok: true, inscrit, message: inscrit ? 'C’est noté : tu recevras les e-mails de City to Summit.' : 'C’est noté : tu ne recevras plus nos e-mails.' };
}

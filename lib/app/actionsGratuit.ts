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
import { aDesFcGardees, calculer, saisieSure, sansLaFc, testsSurs, type Experience, type TestsGratuits } from './profilGratuit';
import { clientServeur, clientService } from './supabase';

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

// La clé des tables du compte gratuit : sa ligne `comptes` (posée au besoin, sans toucher à un compte existant).
async function assurerCompte(compteId: string) {
  const { error } = await clientService().from('comptes').upsert({ id: compteId, nom: '' }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw new Error(`comptes : ${error.message}`);
}

type Ligne = { experience: Experience | null; tests: TestsGratuits; consentement_fc_le: string | null; liste_email_le: string | null };
async function ligneDuCompte(compteId: string): Promise<Ligne | null> {
  const { data } = await (await clientServeur()).from('profils_gratuits').select('experience, tests, consentement_fc_le, liste_email_le')
    .eq('compte_id', compteId).maybeSingle();
  return data ? { experience: data.experience ?? null, tests: testsSurs(data.tests), consentement_fc_le: data.consentement_fc_le ?? null,
    liste_email_le: data.liste_email_le ?? null } : null;
}

// Juste après la connexion par code : ce que le visiteur avait sous les yeux, et son accord à la liste e-mail, entrent dans
// son compte, dans la même session. Un compte qui n'est pas gratuit (un acheteur, un coaché) ne reçoit rien : ses tests
// vivent ailleurs. Le navigateur efface alors son brouillon.
export async function garderApresConnexion(entree: { saisie: unknown; liste: boolean; consentementFc: boolean }):
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
      experience: saisie.experience ?? existant?.experience ?? null,
      tests,
      consentement_fc_le: existant?.consentement_fc_le ?? (entree.consentementFc && calcul.ok && aDesFcGardees(calcul.tests) ? maintenant : null),
      liste_email_le: existant?.liste_email_le ?? (entree.liste ? maintenant : null),
      maj_le: maintenant,
    }, { onConflict: 'compte_id' });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error('Garder le profil du visiteur :', e instanceof Error ? e.message : e);
    return { ok: false, message: 'Ton compte est ouvert, mais ton profil n’a pas pu être gardé. Refais ton test depuis ton profil.', gratuit: true };
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
      return { ok: false, message: 'Coche la case pour que CTS garde tes valeurs : sans ton accord, rien n’est enregistré.' };
    await assurerCompte(acces.compteId);
    const maintenant = new Date().toISOString();
    const { error } = await (await clientServeur()).from('profils_gratuits').upsert({
      compte_id: acces.compteId, experience: calcul.experience, tests: calcul.tests,
      consentement_fc_le: existant?.consentement_fc_le ?? (avecFc ? maintenant : null), maj_le: maintenant,
    }, { onConflict: 'compte_id' });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error('Tes tests (compte gratuit) :', e instanceof Error ? e.message : e);
    return { ok: false, message: 'L’enregistrement n’a pas abouti. Réessaie dans un moment.' };
  }
  revalidatePath('/app', 'layout');
  return { ok: true, message: 'C’est enregistré.' };
}

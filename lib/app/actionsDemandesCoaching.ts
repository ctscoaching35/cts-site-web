'use server';
/**
 * Les gestes de la demande de coaching (app gratuite, lot A2, décisions du coach du 16/11/2026) : pour le compte gratuit,
 * envoyer sa demande (le contrôle est fait ici, côté serveur : jamais cru sur parole), l'effacer ; pour le coach, l'accepter
 * ou la classer « sans suite ». Rien n'est écrit dans Nolio.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { lireAcces } from './acces';
import { lireDemande, objectifEnClair, QUESTIONS_COACHING } from './coachingRegles';
import { coachDesDemandes, demandeParId, jointesDuCompte, poserLaDemande } from './demandesCoaching';
import { ficheDuCompte } from './demandes';
import { prevenirCoach } from './ecriture';
import { adresseDuCompte, ouvrirEspace } from './espaceAthlete';
import { coachConnecte } from './nolio';
import { clientServeur, clientService } from './supabase';
import { site } from '@/lib/content';

export type EtatDemande = { ok: boolean; message: string };

const anneeParis = () => Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric' }).format(new Date()));

// Envoyer (ou mettre à jour) sa demande. Un compte gratuit seulement : un coaché, un acheteur, un visiteur n'ont pas ce geste.
export async function envoyerDemandeCoaching(entree: unknown): Promise<EtatDemande> {
  const acces = await lireAcces();
  if (acces.cas !== 'gratuit' || !acces.compteId) return { ok: false, message: 'Ta session a expiré : reconnecte-toi.' };
  const supabase = await clientServeur();
  const { data: courses } = await supabase.from('courses_gratuites').select('id, nom, course_date, distance_km, dplus_m').eq('compte_id', acces.compteId);
  const lue = lireDemande(entree, {
    experienceConnue: null, // l'expérience du profil n'existe plus dans l'app gratuite : la demande la redemande
    anneeCourante: anneeParis(),
    coursesDuCompte: (courses ?? []).map((c) => ({ id: String(c.id), nom: String(c.nom), date: c.course_date ?? null,
      distance_km: c.distance_km == null ? null : Number(c.distance_km), dplus_m: c.dplus_m ?? null })),
  });
  if (!lue.ok) return { ok: false, message: lue.message };
  const { data: avant } = await supabase.from('demandes_coaching').select('id').eq('compte_id', acces.compteId).maybeSingle();
  try {
    await poserLaDemande(acces.compteId, lue.demande);
  } catch (e) {
    console.error('Demande de coaching :', e instanceof Error ? e.message : e);
    return { ok: false, message: 'Ta demande n’est pas partie. Réessaie dans un moment.' };
  }
  // Le coach est prévenu à chaque demande : le prénom, la ville, l'objectif ; rien de la santé ni du téléphone.
  const r = lue.demande.reponses;
  await prevenirCoach(
    `${avant ? 'Demande de coaching mise à jour' : 'Demande de coaching'} : ${r.nom.split(' ')[0]}, ${r.ville}`,
    [`${avant ? 'Une demande de coaching a été mise à jour' : 'Nouvelle demande de coaching'} : ${r.nom}, ${r.ville}.`,
      `Objectif : ${r.objectif ? objectifEnClair(r.objectif) : 'non précisé'}.`, '', `À lire dans ton espace : ${site.url}/app/coach/demandes`].join('\n'),
  ).catch((e) => console.error('Prévenir le coach (demande) :', e instanceof Error ? e.message : e));
  revalidatePath('/app/compte');
  revalidatePath('/app/coaching');
  return { ok: true, message: QUESTIONS_COACHING.apres };
}

// « Effacer ma demande » : le compte efface la sienne (les règles de la base : seulement la sienne).
export async function effacerMaDemande(): Promise<EtatDemande> {
  const acces = await lireAcces();
  if (acces.cas !== 'gratuit' || !acces.compteId) return { ok: false, message: 'Ta session a expiré : reconnecte-toi.' };
  const { error } = await (await clientServeur()).from('demandes_coaching').delete().eq('compte_id', acces.compteId);
  if (error) {
    console.error('Effacer ma demande :', error.message);
    return { ok: false, message: 'L’effacement n’a pas abouti. Réessaie dans un moment.' };
  }
  revalidatePath('/app/compte');
  revalidatePath('/app/coaching');
  return { ok: true, message: QUESTIONS_COACHING.compte.efface };
}

// ─── Le coach ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// « Accepter » : la fiche du coaché (nom, ses FC et sa VC du profil gratuit si son consentement FC est donné), son espace ouvert
// (l'invitation de coaché, comme « Inviter dans l'app »), la demande passée en « acceptée » reliée à la fiche, puis la page de
// l'athlète, où « Son entrée » montre la suite (Nolio, objectif). RIEN n'est écrit dans Nolio.
export async function accepterDemande(demandeId: string): Promise<EtatDemande> {
  const coach = await coachConnecte();
  if (!coach || !coachDesDemandes(coach)) return { ok: false, message: 'Ta session a expiré : reconnecte-toi.' };
  const d = await demandeParId(demandeId);
  if (!d || d.statut !== 'ouverte') return { ok: false, message: 'Cette demande n’est plus ouverte : elle est déjà traitée ou effacée.' };
  const email = await adresseDuCompte(d.compte_id);
  if (!email) return { ok: false, message: 'Ce compte n’a plus d’adresse e-mail : impossible d’ouvrir son espace.' };
  if (await ficheDuCompte(d.compte_id)) return { ok: false, message: 'Ce compte a déjà une fiche de coaché.' };
  const nom = String(d.reponses.nom ?? '').trim();
  if (!nom) return { ok: false, message: 'Cette demande n’a pas de nom : relis-la.' };

  // Ses repères du profil gratuit : sa vitesse critique toujours (le profil gratuit la garde sans consentement), ses FC et
  // l'allure de son test de la parole seulement avec son consentement FC.
  const joint = await jointesDuCompte(d.compte_id);
  const jour = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const reperes: Record<string, number> = {};
  if (joint.tests.vc) {
    reperes.vc_ms = Math.round(joint.tests.vc.vc_ms * 1000) / 1000;
    reperes.d_prime_m = Math.round(joint.tests.vc.d_prime_m);
  }
  if (joint.consentementFc) {
    if (joint.tests.parole) {
      reperes.fc_seuil1 = joint.tests.parole.fc_seuil1;
      if (joint.tests.parole.v_seuil1_ms !== null) reperes.v_seuil1_ms = joint.tests.parole.v_seuil1_ms;
    }
    if (joint.tests.fc2) reperes.fc_seuil2 = joint.tests.fc2.fc_seuil2;
  }
  const sources = Object.fromEntries((['fc_seuil1', 'vc_ms', 'fc_seuil2'] as const).filter((k) => k in reperes)
    .map((k) => [k, { le: jour, source: 'athlete' }]));

  const service = clientService();
  const { data: fiche, error } = await service.from('athletes_coaches')
    .insert({ coach_id: coach.compteId, nom, ...reperes, reperes_sources: sources }).select('id').single();
  if (error || !fiche) {
    console.error('Fiche depuis une demande :', error?.message);
    return { ok: false, message: 'La fiche n’a pas pu être créée. Réessaie dans un moment.' };
  }
  const athleteId = String(fiche.id);
  try {
    await ouvrirEspace(coach.compteId, { id: athleteId, nom }, email);
  } catch (e) {
    console.error(`Espace de la demande ${demandeId} :`, e instanceof Error ? e.message : e);
    // Rien à moitié : la fiche créée pour rien repart, la demande reste ouverte.
    await service.from('athletes_coaches').delete().eq('id', athleteId);
    return { ok: false, message: 'L’espace n’a pas pu s’ouvrir : rien n’est changé, réessaie dans un moment.' };
  }
  const { error: erreurDemande } = await service.from('demandes_coaching')
    .update({ statut: 'acceptee', traitee_le: new Date().toISOString(), athlete_id: athleteId }).eq('id', demandeId).eq('statut', 'ouverte');
  if (erreurDemande) console.error('Demande acceptée, statut non écrit :', erreurDemande.message);
  revalidatePath('/app/coach', 'layout');
  redirect(`/app/coach/athlete/${athleteId}`);
}

// « Sans suite » : la demande s'efface tout de suite (le coach l'a dit à la personne à l'appel) ; aucun e-mail ne part.
export async function demandeSansSuite(demandeId: string): Promise<EtatDemande> {
  const coach = await coachConnecte();
  if (!coach || !coachDesDemandes(coach)) return { ok: false, message: 'Ta session a expiré : reconnecte-toi.' };
  const { error } = await clientService().from('demandes_coaching').delete().eq('id', demandeId).eq('statut', 'ouverte');
  if (error) {
    console.error('Demande sans suite :', error.message);
    return { ok: false, message: 'L’effacement n’a pas abouti. Réessaie dans un moment.' };
  }
  revalidatePath('/app/coach', 'layout');
  redirect('/app/coach/demandes');
}

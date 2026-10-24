'use server';
/**
 * Les gestes de l'espace coach (CTS_NOLIO_CADRAGE.md, N1 à N9, V4) : sur la fiche d'un athlète, son nom Nolio et
 * ses valeurs (N8) ; sur un objectif, l'envoi d'une semaine puis sa mise à jour (V4) ; retirer un objectif ou un
 * athlète. Chaque geste revérifie le coach et que l'athlète ou l'objectif est à lui.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { accordDeLAthlete, envoyerSemaine, ficheAthlete, marquerTestsLus, mettreAJourSemaine, objectifCoache } from './coaching';
import { fermerEspace, ouvrirEspace } from './espaceAthlete';
import { objectifEcrit, retirerDeNolio, zonesDeLaFicheVersNolio, zonesVersNolio } from './ecriture';
import { athletesNolio, coachConnecte } from './nolio';
import { usrAcheteurs } from './acheteurs';
import { retirerFiche, supprimerPlans } from './retrait';
import { lireAllure } from './allureCoach';
import { clientService } from './supabase';

export type EtatCoach = { message: string; ok: boolean } | null;

// Sa programmation (décision coach du 20/10/2026, « tableau de bord complet ») : automatique, le moteur écrit ses
// semaines chaque dimanche ; à la main, le coach les écrit dans Nolio, le moteur n'écrit rien et l'app reste son tableau
// de bord. Ce qui est déjà dans Nolio y reste.
export async function changerProgrammation(athleteId: string, programmation: 'auto' | 'main'): Promise<void> {
  const coach = await coachConnecte();
  if (!coach || (programmation !== 'auto' && programmation !== 'main')) return;
  const { error } = await clientService().from('athletes_coaches').update({ programmation }).eq('id', athleteId).eq('coach_id', coach.compteId);
  if (error) console.error(`Programmation de ${athleteId} :`, error.message);
  revalidatePath('/app', 'layout');
}

// « Réglé » sur un point d'« À regarder » (décision coach du 24/10/2026) : ce point-là ne revient jamais ; un nouveau
// point du même genre s'affiche (espaceCoach.ARegarder.cle).
export async function marquerRegle(cle: string): Promise<void> {
  const coach = await coachConnecte();
  if (!coach || !cle) return;
  const { error } = await clientService().from('a_regarder_regles').upsert({ coach_id: coach.compteId, cle: cle.slice(0, 500) });
  if (error) console.error(`Point réglé ${cle} :`, error.message);
  revalidatePath('/app/coach', 'layout');
}

// « Créer sa fiche » (décision coach du 22/10/2026) : un athlète de son équipe Nolio sans fiche ici, sa fiche créée d'un
// clic, déjà reliée à Nolio, sans objectif ; ses dimanches partent au passage de 18 h 30 et son objectif se crée ensuite
// depuis sa fiche (« Son entrée », sa course Nolio déjà remplie). Le coach lui-même, « (toi) » dans Nolio (décision coach
// du 24/10/2026) : sa fiche de test, « (test) », pour vivre l'app d'un coaché sur son propre Nolio.
export async function creerFicheDepuisNolio(nolioId: string): Promise<void> {
  const coach = await coachConnecte();
  if (!coach || !/^usr_[A-Za-z0-9]+$/.test(nolioId)) return;
  const service = clientService();
  const { data: deja } = await service.from('athletes_coaches').select('id').eq('coach_id', coach.compteId)
    .eq('nolio_athlete_id', nolioId).maybeSingle();
  let id = deja?.id as string | undefined;
  if (!id) {
    // Son nom tel que Nolio le donne, et seulement un athlète de son équipe (ou le coach), jamais un acheteur de plan.
    const membre = (await athletesNolio()).find((x) => x.id === nolioId);
    if (!membre || (await usrAcheteurs(coach.compteId)).has(nolioId)) return;
    const nom = membre.name.replace(/\(toi\)$/, '(test)');
    const { data, error } = await service.from('athletes_coaches')
      .insert({ coach_id: coach.compteId, nom, nolio_athlete_id: nolioId }).select('id').single();
    if (error || !data) {
      console.error('Fiche depuis Nolio :', error?.message);
      return;
    }
    id = data.id as string;
  }
  revalidatePath('/app/coach');
  redirect(`/app/coach/athlete/${id}`);
}

export async function associerNolio(athleteId: string, form: FormData): Promise<void> {
  const coach = await coachConnecte();
  // L'identifiant d'un athlète dans l'API v2 de Nolio : « usr_… ».
  const nolioId = String(form.get('nolio_id') ?? '');
  if (!coach || !/^usr_[A-Za-z0-9]+$/.test(nolioId)) return;
  await clientService().from('athletes_coaches').update({ nolio_athlete_id: nolioId }).eq('id', athleteId).eq('coach_id', coach.compteId);
  revalidatePath(`/app/coach/athlete/${athleteId}`);
}

// N8 : FC au seuil 1, vitesse critique (en allure, min/km), FC au seuil 2 ; un champ vide efface la valeur.
export async function enregistrerValeurs(athleteId: string, _e: EtatCoach, form: FormData): Promise<EtatCoach> {
  const coach = await coachConnecte();
  if (!coach) return { ok: false, message: 'Ta session a expiré : reconnecte-toi.' };
  const lire = (cle: string, min: number, max: number) => {
    const brut = String(form.get(cle) ?? '').trim().replace(',', '.');
    if (!brut) return { valeur: null, ok: true };
    const n = Number(brut);
    return Number.isFinite(n) && n >= min && n <= max ? { valeur: n, ok: true } : { valeur: null, ok: false };
  };
  const fc1 = lire('fc_seuil1', 80, 220);
  const fc2 = lire('fc_seuil2', 80, 230);
  // L'allure, de 2:15 à 11:00 min/km (de 27 à 5,4 km/h).
  const brutAllure = String(form.get('vc_allure') ?? '').trim();
  const allure = brutAllure ? lireAllure(brutAllure) : null;
  const vcOk = !brutAllure || (allure !== null && allure >= 135 && allure <= 660);
  // L'allure au seuil 1, le palier du test de la parole, de 2:30 à 12:00 min/km (moteur 8.320).
  const brutS1 = String(form.get('vs1_allure') ?? '').trim();
  const allureS1 = brutS1 ? lireAllure(brutS1) : null;
  const s1Ok = !brutS1 || (allureS1 !== null && allureS1 >= 150 && allureS1 <= 720);
  if (!fc1.ok || !vcOk || !fc2.ok || !s1Ok)
    return { ok: false, message: 'Une valeur ne semble pas juste : FC entre 80 et 230, allures en min/km (par exemple 6:00 au seuil 1, 4:10 pour la vitesse critique).' };
  if (fc1.valeur !== null && fc2.valeur !== null && fc2.valeur <= fc1.valeur)
    return { ok: false, message: 'La FC au seuil 2 doit être plus haute que la FC au seuil 1.' };
  // Vider les champs reste toujours possible ; garder une valeur demande son accord (E3).
  const aGarder = [fc1.valeur, allure, allureS1, fc2.valeur].some((v) => v !== null);
  if (aGarder && !(await accordDeLAthlete(coach.compteId, athleteId)))
    return { ok: false, message: 'Pas encore son accord : associe-le à Nolio, envoie-lui le message d’accord, puis coche « Accord reçu » dans le Suivi quand il a répondu oui.' };
  const avant = await ficheAthlete(coach.compteId, athleteId);
  const { error } = await clientService().from('athletes_coaches').update({
    fc_seuil1: fc1.valeur === null ? null : Math.round(fc1.valeur),
    vc_ms: allure === null ? null : Math.round((1000 / allure) * 1000) / 1000,
    v_seuil1_ms: allureS1 === null ? null : Math.round((1000 / allureS1) * 1000) / 1000,
    fc_seuil2: fc2.valeur === null ? null : Math.round(fc2.valeur),
  }).eq('id', athleteId).eq('coach_id', coach.compteId);
  if (error) return { ok: false, message: 'L’enregistrement n’a pas abouti. Réessaie.' };
  // La source de chaque repère changé (saisi par le coach), après la migration du 19/10/2026 seulement.
  if (avant) {
    const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
    const nouveau: Record<string, number | null> = {
      fc_seuil1: fc1.valeur === null ? null : Math.round(fc1.valeur), fc_seuil2: fc2.valeur === null ? null : Math.round(fc2.valeur),
      vc_ms: allure === null ? null : Math.round((1000 / allure) * 1000) / 1000,
    };
    const sources = { ...avant.reperes_sources } as Record<string, unknown>;
    let change = false;
    for (const cle of ['fc_seuil1', 'vc_ms', 'fc_seuil2'] as const) {
      if (nouveau[cle] === avant[cle]) continue;
      change = true;
      if (nouveau[cle] === null) delete sources[cle];
      else sources[cle] = { le: jour, source: 'coach' };
    }
    if (change) await clientService().from('athletes_coaches').update({ reperes_sources: sources }).eq('id', athleteId).eq('coach_id', coach.compteId);
    // Un test de la parole ou de FC au seuil 2 en attente de lecture : la valeur du coach le clôt.
    if (nouveau.fc_seuil1 !== null && nouveau.fc_seuil1 !== avant.fc_seuil1) await marquerTestsLus(avant, 'parole', { fc_seuil1: nouveau.fc_seuil1 }, 'coach');
    if (nouveau.fc_seuil2 !== null && nouveau.fc_seuil2 !== avant.fc_seuil2) await marquerTestsLus(avant, 'fc_seuil2', { fc_seuil2: nouveau.fc_seuil2 }, 'coach');
  }
  revalidatePath(`/app/coach/athlete/${athleteId}`);
  // ZN1 : les mêmes zones dans son Nolio, d'après son objectif écrit semaine par semaine le plus récent.
  const fiche = await ficheAthlete(coach.compteId, athleteId);
  const dernier = fiche?.objectifs[fiche.objectifs.length - 1];
  const o = dernier ? await objectifEcrit(dernier.plan_id).catch(() => null) : null;
  // Sans objectif (décision coach du 20/10/2026, « tableau de bord complet ») : les zones de sa fiche.
  const soucis = o ? await zonesVersNolio(o) : dernier ? [] : await zonesDeLaFicheVersNolio(athleteId);
  return { ok: true, message: `C’est enregistré. Les prochaines semaines envoyées partiront avec ces valeurs.${soucis.length ? ` Zones Nolio : ${soucis.join(' ; ')}.` : ''}` };
}

// T6 : inviter un athlète coaché dans l'app ; « Retirer l'accès » délie son compte de sa fiche.
export async function inviterDansLApp(athleteId: string, _e: EtatCoach, form: FormData): Promise<EtatCoach> {
  const coach = await coachConnecte();
  if (!coach) return { ok: false, message: 'Ta session a expiré : reconnecte-toi.' };
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: 'Cette adresse ne se lit pas.' };
  const a = await ficheAthlete(coach.compteId, athleteId);
  if (!a) return { ok: false, message: 'Athlète introuvable.' };
  try {
    await ouvrirEspace(coach.compteId, a, email);
  } catch (e) {
    console.error(`Espace de l'athlète ${athleteId} :`, e instanceof Error ? e.message : e);
    return { ok: false, message: e instanceof Error && e.message.startsWith('C’est') ? e.message : 'L’invitation n’a pas abouti : réessaie dans un moment.' };
  }
  revalidatePath(`/app/coach/athlete/${athleteId}`);
  return { ok: true, message: `C’est parti : ${email} reçoit le lien de l’app, et s’y connecte par un code.` };
}

export async function retirerAcces(athleteId: string): Promise<void> {
  const coach = await coachConnecte();
  if (!coach) return;
  await fermerEspace(coach.compteId, athleteId);
  revalidatePath(`/app/coach/athlete/${athleteId}`);
}

export async function envoyer(planId: string, numero: string, _e: EtatCoach): Promise<EtatCoach> {
  const coach = await coachConnecte();
  if (!coach) return { ok: false, message: 'Ta session a expiré : reconnecte-toi.' };
  try {
    const envoye = await envoyerSemaine(coach.compteId, planId, numero);
    revalidatePath(`/app/coach/plan/${planId}`);
    return { ok: true, message: `Envoyé dans Nolio : ${envoye}.` };
  } catch (e) {
    console.error(`Envoi Nolio ${planId} ${numero} :`, e instanceof Error ? e.message : e);
    return { ok: false, message: e instanceof Error ? e.message : 'L’envoi n’a pas abouti.' };
  }
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

// V4 : mettre à jour une semaine envoyée ; le bilan dit ce qui a changé et ce qui est resté tel que le coach l'a fait.
export async function mettreAJour(planId: string, numero: string, _e: EtatCoach): Promise<EtatCoach> {
  const coach = await coachConnecte();
  if (!coach) return { ok: false, message: 'Ta session a expiré : reconnecte-toi.' };
  try {
    const b = await mettreAJourSemaine(coach.compteId, planId, numero);
    revalidatePath(`/app/coach/plan/${planId}`);
    const fait = [b.remplacees && `${pluriel(b.remplacees, 'séance')} mise${b.remplacees > 1 ? 's' : ''} à jour`,
      b.ajoutees && `${pluriel(b.ajoutees, 'séance')} ajoutée${b.ajoutees > 1 ? 's' : ''}`,
      b.retirees && `${pluriel(b.retirees, 'séance')} retirée${b.retirees > 1 ? 's' : ''}`,
      b.notes && `${pluriel(b.notes, 'note')} de repos ajoutée${b.notes > 1 ? 's' : ''}`,
      b.bandeau && `bandeau « ${b.bandeau} » ajouté`].filter(Boolean).join(', ');
    const garde = b.gardees.length ? ` Gardé${b.gardees.length > 1 ? 'es' : 'e'} telle${b.gardees.length > 1 ? 's' : ''} quelle${b.gardees.length > 1 ? 's' : ''} : ${b.gardees.join(', ')}.` : '';
    return { ok: true, message: `${fait ? `${fait.charAt(0).toUpperCase()}${fait.slice(1)} dans Nolio.` : 'Rien à changer dans Nolio.'}${garde}` };
  } catch (e) {
    console.error(`Mise à jour Nolio ${planId} ${numero} :`, e instanceof Error ? e.message : e);
    return { ok: false, message: e instanceof Error ? e.message : 'La mise à jour n’a pas abouti.' };
  }
}

// Retirer un objectif : son plan et son PDF partent. Écrit semaine par semaine, ce qu'il a posé dans Nolio et qui est
// encore à venir en part aussi (décision coach du 19/10/2026) ; le passé reste. Envoyé en entier (avant le 19/10/2026),
// ce qui est dans Nolio y reste.
export async function retirerObjectif(planId: string): Promise<void> {
  const coach = await coachConnecte();
  if (!coach) return;
  const o = await objectifCoache(coach.compteId, planId);
  if (!o) return;
  const soucis = await retirerDeNolio(planId).catch((e) => [e instanceof Error ? e.message : String(e)]);
  if (soucis.length) console.error(`Retrait de ${planId} : resté dans Nolio — ${soucis.join(' ; ')}`);
  // Une demande de retrait de l'athlète en attente (décision coach du 20/10/2026) : faite.
  await clientService().from('objectifs_demandes').update({ statut: 'validee' }).eq('plan_id', planId).eq('statut', 'a_valider');
  await supprimerPlans(coach.compteId, [planId]);
  revalidatePath('/app/coach');
  redirect(`/app/coach/athlete/${o.athlete.id}`);
}

// Garder un objectif dont l'athlète a demandé le retrait (décision coach du 20/10/2026) : sa demande est refusée.
export async function garderObjectif(demandeId: string): Promise<void> {
  const coach = await coachConnecte();
  if (!coach) return;
  await clientService().from('objectifs_demandes').update({ statut: 'retiree' }).eq('id', demandeId)
    .eq('coach_id', coach.compteId).eq('statut', 'a_valider').not('plan_id', 'is', null);
  revalidatePath('/app/coach');
}

// Retirer un athlète : sa fiche, ses objectifs et leurs PDF partent ; ce qui est dans Nolio y reste.
export async function retirerAthlete(athleteId: string): Promise<void> {
  const coach = await coachConnecte();
  if (!coach) return;
  const a = await ficheAthlete(coach.compteId, athleteId);
  if (!a) return;
  await retirerFiche(coach.compteId, athleteId, a.objectifs.map((o) => o.plan_id));
  revalidatePath('/app/coach');
  redirect('/app/coach');
}

// PO1 (décision coach du 19/10/2026) : le profil d'un athlète coaché, modifié à part de ses objectifs, sur sa fiche ;
// le questionnaire court du prochain objectif le reprend. Le moteur revérifie tout à la génération.
export async function enregistrerProfil(athleteId: string, _e: EtatCoach, form: FormData): Promise<EtatCoach> {
  const coach = await coachConnecte();
  if (!coach) return { ok: false, message: 'Ta session a expiré : reconnecte-toi.' };
  const { lireProfil } = await import('./profilEntrainement');
  const lu = lireProfil(form, 'son');
  if ('erreur' in lu) return { ok: false, message: lu.erreur };
  const { error } = await clientService().from('athletes_coaches').update({ profil: lu.profil })
    .eq('id', athleteId).eq('coach_id', coach.compteId);
  if (error) return { ok: false, message: 'L’enregistrement n’a pas abouti : la migration du 19/10/2026 est-elle passée ?' };
  revalidatePath(`/app/coach/athlete/${athleteId}`);
  // Sa préparation en cours le reprend par « Modifier l'objectif » (décision coach du 23/10/2026).
  return { ok: true, message: 'C’est enregistré. Ses prochains objectifs partent de ce profil ; « Modifier » sur son objectif en cours le lui donne aussi.' };
}

// Le test de vitesse critique d'un coaché, saisi par son coach (décision coach du 19/10/2026 : quand l'athlète ne le
// fait pas, ou que la lecture automatique dans Nolio n'a pas abouti) : ses deux efforts (durée, distance), le même
// calcul que dans l'app (lib/app/zones.ts, vitesseCritique), la date du test. La VC et la D′ (son profil de coureur,
// AP4) vont sur sa fiche, sa source « test saisi par le coach » ; un test écrit dans ses semaines et pas encore lu
// est marqué lu, pour que la lecture automatique ne revienne pas dessus ; ses zones Nolio suivent (ZN1).
export async function enregistrerTestVc(athleteId: string, _e: EtatCoach, form: FormData): Promise<EtatCoach> {
  const coach = await coachConnecte();
  if (!coach) return { ok: false, message: 'Ta session a expiré : reconnecte-toi.' };
  const { lireDistance, lireDuree, vitesseCritique } = await import('./zones');
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const le = String(form.get('le') ?? '') || jour;
  const ilYA60 = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(le) || le > jour || le < ilYA60) return { ok: false, message: 'La date du test doit tomber dans les deux derniers mois.' };
  const efforts = [1, 2].map((i) => ({
    duree_s: lireDuree(String(form.get(`duree${i}`) ?? '')),
    distance_m: lireDistance(String(form.get(`distance${i}`) ?? '')),
  }));
  if (efforts.some((e) => e.duree_s === null || e.distance_m === null))
    return { ok: false, message: 'Entre la durée (12 ou 12:00) et la distance (3150 m ou 3,15 km) de chaque effort.' };
  const vc = vitesseCritique(efforts[0] as { duree_s: number; distance_m: number }, efforts[1] as { duree_s: number; distance_m: number });
  if ('erreur' in vc) return { ok: false, message: vc.erreur };
  if (!(await accordDeLAthlete(coach.compteId, athleteId)))
    return { ok: false, message: 'Pas encore son accord : associe-le à Nolio, envoie-lui le message d’accord, puis coche « Accord reçu » dans le Suivi quand il a répondu oui.' };
  const fiche = await ficheAthlete(coach.compteId, athleteId);
  if (!fiche) return { ok: false, message: 'Athlète introuvable.' };
  const vc_ms = Math.round(vc.vc_ms * 1000) / 1000;
  const d_prime_m = Math.round(vc.d_prime_m);
  const service = clientService();
  const { error } = await service.from('athletes_coaches').update({
    vc_ms, d_prime_m, reperes_sources: { ...fiche.reperes_sources, vc_ms: { le, source: 'test_coach' } },
  }).eq('id', athleteId).eq('coach_id', coach.compteId);
  if (error) return { ok: false, message: 'L’enregistrement n’a pas abouti. Réessaie.' };
  // Les tests de vitesse critique écrits dans ses semaines, pas encore lus : lus, par le coach.
  await marquerTestsLus(fiche, 'vitesse_critique', { vc_ms, d_prime_m, le }, 'coach');
  revalidatePath(`/app/coach/athlete/${athleteId}`);
  const dernier = fiche.objectifs[fiche.objectifs.length - 1];
  const o = dernier ? await objectifEcrit(dernier.plan_id).catch(() => null) : null;
  const soucis = o ? await zonesVersNolio(o, { vc_ms, d_prime_m }) : dernier ? [] : await zonesDeLaFicheVersNolio(athleteId);
  const { allure } = await import('./zones');
  return { ok: true, message: `C’est enregistré : vitesse critique à ${allure(vc_ms)}/km. Ses prochaines semaines et ses zones la prennent en repère.${soucis.length ? ` Zones Nolio : ${soucis.join(' ; ')}.` : ''}` };
}

// Le mode de l'athlète (décision coach du 23/10/2026) : « Passer en coaching » (depuis un plan acheté ou sa fiche en mode
// plan) et « Passer en plan » (depuis sa fiche), après la semaine en cours (lib/app/modes.ts).
export type EtatMode = { ok: boolean; message: string; athleteId?: string } | null;
const enPhrases = (soucis: string[]) => (soucis.length ? ` Dans Nolio, à faire à la main : ${soucis.join(' ; ')}.` : '');

export async function basculerEnCoaching(source: { planId: string } | { athleteId: string }, _e: EtatMode): Promise<EtatMode> {
  const coach = await coachConnecte();
  if (!coach) return { ok: false, message: 'Ta session a expiré : reconnecte-toi.' };
  const { passerEnCoaching } = await import('./modes');
  try {
    const { athleteId, soucis } = await passerEnCoaching(coach.compteId, source);
    revalidatePath('/app/coach');
    revalidatePath('/app/coach/chiffres');
    revalidatePath(`/app/coach/athlete/${athleteId}`);
    return { ok: true, athleteId, message: `C’est fait : mode coaching. Son plan acheté ne s’écrit plus après cette semaine et sa sortie de l’équipe est annulée ; crée son objectif depuis sa fiche.${enPhrases(soucis)}` };
  } catch (e) {
    console.error('Passer en coaching :', e instanceof Error ? e.message : e);
    return { ok: false, message: e instanceof Error && e.message.startsWith('C’est') ? e.message : 'Le passage n’a pas abouti : réessaie dans un moment.' };
  }
}

export async function basculerEnPlan(athleteId: string, _e: EtatMode): Promise<EtatMode> {
  const coach = await coachConnecte();
  if (!coach) return { ok: false, message: 'Ta session a expiré : reconnecte-toi.' };
  const { passerEnPlan } = await import('./modes');
  try {
    const soucis = await passerEnPlan(coach.compteId, athleteId);
    revalidatePath('/app/coach');
    revalidatePath('/app/coach/chiffres');
    revalidatePath(`/app/coach/athlete/${athleteId}`);
    return { ok: true, athleteId, message: `C’est fait : mode plan. Son coaching s’arrête après cette semaine ; un plan qu’il a acheté démarre lundi.${enPhrases(soucis)}` };
  } catch (e) {
    console.error('Passer en plan :', e instanceof Error ? e.message : e);
    return { ok: false, message: e instanceof Error && e.message.startsWith('C’est') ? e.message : 'Le passage n’a pas abouti : réessaie dans un moment.' };
  }
}

'use server';
/**
 * « Tes zones » : enregistrer ou effacer le profil d'un plan (cadrage §7.1). La session est vérifiée,
 * le plan doit être à l'athlète (les règles de la base ne lui montrent que les siens), puis le serveur
 * écrit avec la clé de service, comme pour le reste. La FC n'est gardée qu'avec le consentement
 * explicite de l'athlète (Z2) ; un consentement déjà donné pour ce plan vaut pour les tests suivants. Un coaché garde
 * ses tests sur sa fiche (décision coach du 20/10/2026, « ça doit être vivant »).
 */
import { revalidatePath } from 'next/cache';
import { accordDeLAthlete, ficheAthlete, marquerTestsLus } from './coaching';
import { ficheDuCompte } from './demandes';
import { objectifEcrit, zonesVersNolio } from './ecriture';
import { clientServeur, clientService } from './supabase';
import { lireDistance, lireDuree, vitesseCritique } from './zones';

export type EtatZones = { message: string; ok: boolean } | null;

const aujourdhui = () => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());

async function enregistrer(planId: string, consentement: boolean, valeurs: Record<string, unknown>): Promise<EtatZones> {
  const supabase = await clientServeur();
  const { data: session } = await supabase.auth.getClaims();
  const compteId = session?.claims?.sub;
  if (!compteId) return { ok: false, message: 'Ta session a expiré : reconnecte-toi.' };
  const coache = await enregistrerSurLaFiche(compteId, planId, valeurs);
  if (coache) return coache;
  const { data: plan } = await supabase.from('plans').select('id').eq('id', planId).maybeSingle();
  if (!plan) return { ok: false, message: 'Ce plan n’est pas dans ton compte.' };
  const { data: existant } = await supabase.from('zones').select('plan_id').eq('plan_id', planId).maybeSingle();
  if (!existant && !consentement)
    return { ok: false, message: 'Coche la case pour que CTS garde tes valeurs : sans ton accord, rien n’est enregistré.' };
  const { error } = await clientService()
    .from('zones')
    .upsert({ plan_id: planId, compte_id: compteId, ...valeurs, maj_le: new Date().toISOString() });
  if (error) {
    console.error(`Tes zones, plan ${planId} :`, error.message);
    return { ok: false, message: 'L’enregistrement n’a pas abouti. Réessaie dans un moment.' };
  }
  // ZN1 : les mêmes zones dans Nolio, pour un plan écrit semaine par semaine.
  const o = await objectifEcrit(planId).catch(() => null);
  if (o) await zonesVersNolio(o).catch(() => null);
  revalidatePath('/app', 'layout');
  return { ok: true, message: 'C’est enregistré : tes séances affichent leurs nouveaux repères.' };
}

// Le test d'un coaché, sur sa fiche (décision coach du 20/10/2026) : avec l'accord donné à son coach (E3), sa source
// « saisi par l'athlète » ; ses zones suivent tout de suite (l'app et Nolio, ZN1), ses séances à partir de la semaine
// écrite le dimanche suivant (la semaine en cours ne se réécrit pas). Un test écrit dans ses semaines et pas encore lu
// est marqué lu, pour que la lecture dans Nolio ne revienne pas dessus. null : ce plan n'est pas l'un de ses objectifs.
async function enregistrerSurLaFiche(compteId: string, planId: string, valeurs: Record<string, unknown>): Promise<EtatZones> {
  const service = clientService();
  const moi = await ficheDuCompte(compteId);
  const { data: lien } = moi
    ? await service.from('coaching').select('plan_id').eq('plan_id', planId).eq('athlete_id', moi.id).maybeSingle() : { data: null };
  const fiche = lien && moi ? await ficheAthlete(moi.coach_id, moi.id) : null;
  if (!fiche || !moi) return null;
  if (!(await accordDeLAthlete(moi.coach_id, moi.id)))
    return { ok: false, message: 'Ton coach attend encore ton accord pour garder tes repères : réponds oui à son message, puis reviens ici.' };
  const le = aujourdhui();
  const r3 = (x: unknown) => Math.round(Number(x) * 1000) / 1000;
  const sources = { ...fiche.reperes_sources };
  const maj: Record<string, unknown> = {};
  const lus: ['parole' | 'vitesse_critique' | 'fc_seuil2', Record<string, unknown>][] = [];
  if (typeof valeurs.fc_seuil1 === 'number') {
    const v1 = valeurs.v_seuil1_ms === null ? null : r3(valeurs.v_seuil1_ms);
    Object.assign(maj, { fc_seuil1: valeurs.fc_seuil1, v_seuil1_ms: v1 });
    sources.fc_seuil1 = { le, source: 'athlete' };
    lus.push(['parole', { fc_seuil1: valeurs.fc_seuil1, v_seuil1_ms: v1 }]);
  }
  if (typeof valeurs.vc_ms === 'number') {
    Object.assign(maj, { vc_ms: r3(valeurs.vc_ms), d_prime_m: Math.round(Number(valeurs.d_prime_m)) });
    sources.vc_ms = { le, source: 'athlete' };
    lus.push(['vitesse_critique', { vc_ms: maj.vc_ms, d_prime_m: maj.d_prime_m, le }]);
  }
  if (typeof valeurs.fc_seuil2 === 'number') {
    maj.fc_seuil2 = valeurs.fc_seuil2;
    sources.fc_seuil2 = { le, source: 'athlete' };
    lus.push(['fc_seuil2', { fc_seuil2: valeurs.fc_seuil2 }]);
  }
  const { error } = await service.from('athletes_coaches').update({ ...maj, reperes_sources: sources })
    .eq('id', moi.id).eq('coach_id', moi.coach_id);
  if (error) {
    console.error(`Tes zones, fiche ${moi.id} :`, error.message);
    return { ok: false, message: 'L’enregistrement n’a pas abouti. Réessaie dans un moment.' };
  }
  for (const [cle, resultat] of lus) await marquerTestsLus(fiche, cle, resultat, 'athlete');
  const o = await objectifEcrit(planId).catch(() => null);
  if (o) await zonesVersNolio(o).catch(() => null);
  revalidatePath('/app', 'layout');
  return { ok: true, message: 'C’est enregistré, ton coach le voit : tes zones changent dès maintenant, tes séances à partir de la semaine écrite dimanche.' };
}

const lireFc = (brut: FormDataEntryValue | null) => {
  const fc = Number(String(brut ?? '').trim());
  return Number.isInteger(fc) && fc >= 80 && fc <= 220 ? fc : null;
};

// L'allure du palier, en deux champs (minutes, secondes) par km, comme le calculateur : un clavier de téléphone
// en chiffres n'a pas de « : ». undefined si les deux sont vides, null si elle est illisible ou hors de 2:30 à 12:00.
const lireAllurePalier = (form: FormData) => {
  const m = String(form.get('allure_min') ?? '').trim();
  const sec = String(form.get('allure_sec') ?? '').trim();
  if (!m && !sec) return undefined;
  if (!/^\d{1,2}$/.test(m) || !/^\d{0,2}$/.test(sec) || Number(sec || 0) > 59) return null;
  const t = Number(m) * 60 + Number(sec || 0);
  return t >= 150 && t <= 720 ? Math.round((1000 / t) * 1000) / 1000 : null;
};

export async function enregistrerParole(planId: string, _e: EtatZones, form: FormData): Promise<EtatZones> {
  const fc = lireFc(form.get('fc'));
  if (fc === null) return { ok: false, message: 'Entre ta FC en battements par minute, entre 80 et 220.' };
  const v = lireAllurePalier(form);
  if (v === null) return { ok: false, message: 'Écris ton allure en minutes et secondes, entre 2:30 et 12:00 par km : par exemple 6 et 00 pour 6:00/km.' };
  return enregistrer(planId, form.get('consentement') === 'on', {
    fc_seuil1: fc, fc_seuil1_le: aujourdhui(), v_seuil1_ms: v ?? null,
  });
}

export async function enregistrerFcSeuil2(planId: string, _e: EtatZones, form: FormData): Promise<EtatZones> {
  const fc = lireFc(form.get('fc'));
  if (fc === null) return { ok: false, message: 'Entre ta FC en battements par minute, entre 80 et 220.' };
  return enregistrer(planId, form.get('consentement') === 'on', { fc_seuil2: fc, fc_seuil2_le: aujourdhui() });
}

export async function enregistrerVitesseCritique(planId: string, _e: EtatZones, form: FormData): Promise<EtatZones> {
  const efforts = [1, 2].map((i) => ({
    duree_s: lireDuree(String(form.get(`duree${i}`) ?? '')),
    distance_m: lireDistance(String(form.get(`distance${i}`) ?? '')),
  }));
  if (efforts.some((e) => e.duree_s === null || e.distance_m === null))
    return { ok: false, message: 'Entre la durée (12 ou 12:00) et la distance (3150 m ou 3,15 km) de chaque effort.' };
  const [a, b] = efforts as { duree_s: number; distance_m: number }[];
  const vc = vitesseCritique(a, b);
  if ('erreur' in vc) return { ok: false, message: vc.erreur };
  return enregistrer(planId, form.get('consentement') === 'on', {
    vc_ms: vc.vc_ms, d_prime_m: vc.d_prime_m, vc_efforts: [a, b], vc_le: aujourdhui(),
  });
}

export async function effacerZones(planId: string): Promise<void> {
  const supabase = await clientServeur();
  const { data: session } = await supabase.auth.getClaims();
  const { data: plan } = await supabase.from('plans').select('id').eq('id', planId).maybeSingle();
  if (!session?.claims?.sub || !plan) return;
  await clientService().from('zones').delete().eq('plan_id', planId).eq('compte_id', session.claims.sub);
  revalidatePath('/app', 'layout');
}

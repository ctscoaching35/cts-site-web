/**
 * Le week-end de chaque athlète dans Nolio (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur) : « Ta semaine prochaine » le
 * samedi à 8 h, pour lui laisser le week-end (décision coach du 24/10/2026 ; le dimanche avant), lu par le passage du
 * dimanche soir ; le Hooper le dimanche à 8 h, le bilan de sa semaine. UNE SEMAINE À LA FOIS (décision coach du 23/10/2026, « juste pour la semaine suivante ») : chaque
 * soir, le passage met en place le dimanche qui vient, un seul de chaque, sans récurrence — pour tout coaché relié à
 * Nolio (en automatique, à la main ou sans objectif ; sa question ouverte, « Une information à remonter à ton coach ? »,
 * facultative ; le Hooper toujours) et pour tout acheteur dont la préparation est en route (le Hooper avec son accord de
 * lecture), indépendamment de l'écriture des séances. Ce que Nolio a déjà ce dimanche-là est gardé ; tout autre
 * « Ta semaine prochaine » ou Hooper du dimanche, ce jour-là ou après, part : les doubles, et les séries récurrentes
 * d'avant (posées sur 26 semaines jusqu'au 23/10/2026), à partir du dimanche suivant. Chaque nuit, avec l'accord de
 * lecture, un mot écrit à la question ouverte se note sur sa fiche, sa date seulement : « À regarder » et l'e-mail du
 * soir le disent, le texte se lit dans Nolio. Côté serveur seulement.
 */
import { destinataire } from './coaching';
import { QUESTIONNAIRE_SEMAINE, type Compte } from './ecriture';
import { appelNolio, listeNolio, refusNolio } from './nolio';
import { ajouterJours } from './plan';
import { clientService } from './supabase';

export const QUESTION_OUVERTE = 'Une information à remonter à ton coach ?';
// Sur la fiche d'un coaché : son dimanche en place (dimanche, et jusqua, sa date, pour son entrée), ses deux questionnaires,
// le dernier mot écrit à la question ouverte.
export type DimanchesCoache = { dimanche?: string; semaine?: string | null; hooper?: string | null; jusqua?: string; mot_le?: string | null;
  mot_note?: string | null };

const aujourdhuiParis = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
// Le premier dimanche strictement après cette date.
const dimancheApres = (iso: string) => ajouterJours(iso, 7 - ((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7) - 1 || 7);
const jourDe = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).getUTCDay();
const estDimanche = (iso: string) => jourDe(iso) === 0;
// Le samedi (le questionnaire) ou le dimanche (le Hooper, et le questionnaire d'avant le 24/10/2026).
const duWeekEnd = (iso: string) => jourDe(iso) === 6 || jourDe(iso) === 0;

// Le questionnaire des coachés : celui de tous, et la question ouverte au bout.
const questionnaireCoache = () => ({
  ...QUESTIONNAIRE_SEMAINE,
  items: [...QUESTIONNAIRE_SEMAINE.items, { question: QUESTION_OUVERTE, type: 'long_text', is_mandatory: false }],
});

type QuizPrevu = { id: string; name?: string; quiz_type?: string; date_start: string; recurrence?: { id?: string } | null };
const genreDu = (q: QuizPrevu) => (q.name === QUESTIONNAIRE_SEMAINE.name ? 'semaine'
  : q.quiz_type === 'hooper' || /hooper/i.test(q.name ?? '') ? 'hooper' : null);

let cadreHooper: Promise<string | null> | null = null;
const leCadreHooper = () => (cadreHooper ??= listeNolio<{ id: string; scope?: string }>('library/quiz_frames/?quiz_type=hooper')
  .then((c) => (c.find((x) => x.scope === 'nolio') ?? c[0])?.id ?? null).catch(() => { cadreHooper = null; return null; }));

export type Dimanche = { dimanche: string; semaine: string | null; hooper: string | null; retires: number; soucis: string[] };

// Le week-end qui vient d'un athlète : ses questionnaires en place (gardés, ou posés), le reste retiré. garder : les
// identifiants qu'il avait déjà, préférés s'ils tombent ce week-end-là. Le questionnaire va le samedi ; le samedi même
// (passé 8 h), celui du week-end est gardé, samedi ou dimanche, et un manquant se pose le dimanche.
export async function poserLeDimanche(usr: string, { coache, avecHooper, garder = [] }: {
  coache: boolean; avecHooper: boolean; garder?: (string | null | undefined)[];
}): Promise<Dimanche> {
  const d = await destinataire(usr);
  const qui = d.moi ? '' : `athlete=${d.usr}`;
  const aujourdhui = aujourdhuiParis();
  const dimanche = dimancheApres(aujourdhui);
  const samedi = ajouterJours(dimanche, -1);
  const tous = (await listeNolio<QuizPrevu>(`planned/quizzes/?date_from=${samedi}&date_to=${ajouterJours(dimanche, 7 * 60)}${qui ? `&${qui}` : ''}`))
    .filter((q) => (genreDu(q) === 'semaine' && duWeekEnd(q.date_start)) || (genreDu(q) === 'hooper' && estDimanche(q.date_start)))
    .sort((a, b) => a.date_start.localeCompare(b.date_start));
  const gardes = new Set(garder.filter(Boolean));
  const res: Dimanche = { dimanche, semaine: null, hooper: null, retires: 0, soucis: [] };
  const pour = (corps: Record<string, unknown>) => (d.moi ? corps : { ...corps, athletes: [d.usr] });
  for (const genre of ['semaine', 'hooper'] as const) {
    const duGenre = tous.filter((q) => genreDu(q) === genre);
    const jours = genre === 'hooper' ? [dimanche] : samedi > aujourdhui ? [samedi] : [samedi, dimanche];
    const duJour = duGenre.filter((q) => jours.includes(q.date_start.slice(0, 10)));
    const voulu = genre === 'semaine' || avecHooper;
    const garde = voulu ? (duJour.find((q) => gardes.has(q.id)) ?? duJour[0]) : undefined;
    if (garde) res[genre] = garde.id;
    else if (voulu) {
      const cadre = genre === 'hooper' ? await leCadreHooper() : null;
      const corps: Record<string, unknown> = genre === 'semaine' ? (coache ? questionnaireCoache() : QUESTIONNAIRE_SEMAINE) : { quiz_frame: cadre };
      if (genre === 'semaine' || cadre) {
        const r = await appelNolio('POST', 'planned/quizzes/', pour({ ...corps, date_start: jours[jours.length - 1], hour_start: '08:00' })).catch(() => null);
        if (r && (r.statut === 201 || r.statut === 200)) res[genre] = String(r.corps?.id ?? '');
        else res.soucis.push(r ? refusNolio(r, genre === 'semaine' ? 'le questionnaire du samedi' : 'le Hooper du dimanche') : `${genre} : Nolio injoignable`);
      }
    }
    // Le reste part : une autre série dès son occurrence de ce week-end, celle du gardé à partir du week-end suivant, un
    // questionnaire seul de ce genre (un questionnaire du dimanche d'avant le 24/10/2026, une fois son samedi posé).
    const series = new Set<string>();
    for (const q of duGenre) {
      if (garde && q.id === garde.id) continue;
      const rec = q.recurrence?.id;
      if (rec && series.has(rec)) continue;
      if (rec) series.add(rec);
      const x = await appelNolio('DELETE', `planned/quizzes/${q.id}/${rec ? '?recurrence_action=following' : ''}${qui ? `${rec ? '&' : '?'}${qui}` : ''}`).catch(() => null);
      if (x && (x.statut === 204 || x.statut === 200 || x.statut === 404)) res.retires += 1;
      else res.soucis.push(x ? refusNolio(x, `un ${genre === 'semaine' ? 'questionnaire' : 'Hooper'} du week-end en trop`) : 'un week-end en trop : Nolio injoignable');
    }
  }
  return res;
}

// Chaque jour : le dimanche qui vient de chaque coaché relié à Nolio (sa fiche, en mode coaching) et de chaque acheteur
// dont la préparation est en route et la course après ce dimanche (un seul par athlète, même avec deux plans). EN TEMPS
// COMPTÉ (24/10/2026 : retirer les séries d'avant de 18 coachés a pris les 5 minutes du passage, les 6 derniers et tout ce
// qui suivait coupés) : au-delà de budgetMs, le reste le soir suivant ; d'abord les fiches dont le week-end qui vient
// n'est pas encore en place, les séries d'avant en tête.
const REMIS = 'week-end remis au soir suivant';
export async function programmerLesDimanches(budgetMs = 120_000): Promise<Compte[]> {
  const debut = Date.now();
  const service = clientService();
  const { data: toutes, error } = await service.from('athletes_coaches').select('*').not('nolio_athlete_id', 'is', null);
  // Avant la migration du 21/10/2026, la colonne n'existe pas : rien à faire.
  if (error || toutes?.some((f) => !('questionnaires' in f))) return [];
  const prochain = dimancheApres(aujourdhuiParis());
  const rang = (f: { questionnaires?: DimanchesCoache | null }) => (!f.questionnaires?.dimanche ? 0 : f.questionnaires.dimanche !== prochain ? 1 : 2);
  // Un athlète en mode plan (décision coach du 23/10/2026) a le dimanche de son plan acheté.
  const fiches = (toutes ?? []).filter((f) => f.mode !== 'plan').sort((a, b) => rang(a) - rang(b));
  const comptes: Compte[] = [];
  const faits = new Set<string>();
  for (const f of fiches) {
    const usr = String(f.nolio_athlete_id ?? '');
    if (!/^usr_/.test(usr) || faits.has(usr)) continue;
    faits.add(usr);
    if (Date.now() - debut > budgetMs) {
      comptes.push({ plan: '', quoi: REMIS });
      continue;
    }
    const avant = (f.questionnaires ?? null) as DimanchesCoache | null;
    try {
      const r = await poserLeDimanche(usr, { coache: true, avecHooper: true, garder: [avant?.semaine, avant?.hooper] });
      const suite: DimanchesCoache = { dimanche: r.dimanche, jusqua: r.semaine ? r.dimanche : avant?.jusqua, semaine: r.semaine, hooper: r.hooper,
        mot_le: avant?.mot_le ?? null, mot_note: avant?.mot_note ?? null };
      await service.from('athletes_coaches').update({ questionnaires: suite }).eq('id', f.id);
      comptes.push({ plan: '', quoi: `dimanche du ${r.dimanche} en place${r.hooper ? '' : ' (sans Hooper)'}${r.retires ? ` ; ${r.retires} en trop retiré${r.retires > 1 ? 's' : ''}` : ''}`,
        ...(r.soucis.length ? { erreur: r.soucis.join(' ; ') } : {}) });
    } catch (e) {
      comptes.push({ plan: '', quoi: 'dimanche non posé', erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  const dimanche = prochain;
  const { data: plans } = await service.from('plans').select('id, coach_id, nolio_athlete_id, accord_lecture_le')
    .eq('nolio_statut', 'actif').not('demarre_le', 'is', null).not('parametres', 'is', null).gt('course_date', dimanche);
  const { data: coaching } = await service.from('coaching').select('plan_id');
  const coaches = new Set((coaching ?? []).map((c) => c.plan_id as string));
  for (const p of (plans ?? []).filter((x) => !coaches.has(x.id as string))) {
    const usr = String(p.nolio_athlete_id ?? '');
    if (!/^usr_/.test(usr) || faits.has(usr)) continue;
    faits.add(usr);
    if (Date.now() - debut > budgetMs) {
      comptes.push({ plan: p.id as string, quoi: REMIS });
      continue;
    }
    comptes.push(await dimancheDuPlan(p as PlanAchete));
  }
  return comptes;
}

// Le dimanche qui vient d'un acheteur, pour son plan (au départ, à son accord de lecture, et chaque soir) : noté dans
// nolio_envois (« questionnaires »), pour qu'un retrait de l'objectif ou de l'accord le retrouve.
type PlanAchete = { id: string; coach_id: string | null; nolio_athlete_id: string | null; accord_lecture_le: string | null };
export async function dimancheDuPlan(p: PlanAchete): Promise<Compte> {
  const service = clientService();
  try {
    const usr = String(p.nolio_athlete_id ?? '');
    if (!/^usr_/.test(usr)) return { plan: p.id, quoi: 'dimanche non posé : pas encore dans Nolio' };
    const { data: e } = await service.from('nolio_envois').select('seances').eq('plan_id', p.id).eq('semaine', 'questionnaires').maybeSingle();
    const avant = ((e?.seances ?? []) as { nolio_id?: string | null }[]).map((x) => x.nolio_id);
    const r = await poserLeDimanche(usr, { coache: false, avecHooper: Boolean(p.accord_lecture_le), garder: avant });
    const poses = [
      ...(r.semaine ? [{ jour_id: 'questionnaire:semaine', nolio_id: r.semaine, genre: 'note' }] : []),
      ...(r.hooper ? [{ jour_id: 'questionnaire:hooper', nolio_id: r.hooper, genre: 'note' }] : []),
    ];
    if (p.coach_id) {
      await service.from('nolio_envois').upsert({ plan_id: p.id, semaine: 'questionnaires', coach_id: p.coach_id, seances: poses,
        envoye_le: new Date().toISOString() });
    }
    return { plan: p.id, quoi: `dimanche du ${r.dimanche} en place${r.retires ? ` ; ${r.retires} en trop retiré${r.retires > 1 ? 's' : ''}` : ''}`,
      ...(r.soucis.length ? { erreur: r.soucis.join(' ; ') } : {}) };
  } catch (e) {
    return { plan: p.id, quoi: 'dimanche non posé', erreur: e instanceof Error ? e.message : String(e) };
  }
}

// Chaque nuit, avec l'accord de lecture : un mot écrit à la question ouverte ces deux derniers jours se note (sa date,
// jamais son texte). qui : le paramètre d'athlète de Nolio (vide pour le coach lui-même).
export async function noterLeMot(ficheIds: string[], qui: string): Promise<void> {
  if (!ficheIds.length) return;
  const aujourdhui = aujourdhuiParis();
  const resultats = await listeNolio<{ id: string; name?: string; date_start: string; items?: { question: string; value: unknown }[] }>(
    `real/quiz_results/?date_from=${ajouterJours(aujourdhui, -2)}&date_to=${aujourdhui}${qui}`).catch(() => []);
  const mot = resultats.filter((r) => r.name === QUESTIONNAIRE_SEMAINE.name
    && (r.items ?? []).some((i) => i.question === QUESTION_OUVERTE && typeof i.value === 'string' && i.value.trim()))
    .map((r) => r.date_start.slice(0, 10)).sort().pop();
  if (!mot) return;
  const service = clientService();
  const { data: fiches } = await service.from('athletes_coaches').select('id, questionnaires').in('id', ficheIds);
  for (const f of fiches ?? []) {
    const serie = (f.questionnaires ?? {}) as DimanchesCoache;
    if (serie.mot_le && serie.mot_le >= mot) continue;
    await service.from('athletes_coaches').update({ questionnaires: { ...serie, mot_le: mot, mot_note: new Date().toISOString() } }).eq('id', f.id);
  }
}

// Son dimanche retiré de Nolio (décision coach du 23/10/2026 : passé en mode plan, il a celui de son plan acheté) : ses
// questionnaires à venir, et ce qui reste d'une série d'avant ; la fiche l'oublie, le passage quotidien le repose s'il
// revient en coaching. Ce qui n'a pas pu partir, en phrases.
export async function retirerLesDimanches(ficheId: string): Promise<string[]> {
  const service = clientService();
  const { data: f } = await service.from('athletes_coaches').select('*').eq('id', ficheId).maybeSingle();
  const usr = String(f?.nolio_athlete_id ?? '');
  if (!f || !/^usr_/.test(usr)) return [];
  const d = await destinataire(usr);
  const qui = d.moi ? '' : `athlete=${d.usr}`;
  const demain = ajouterJours(aujourdhuiParis(), 1);
  const avenir = (await listeNolio<QuizPrevu>(`planned/quizzes/?date_from=${demain}&date_to=${ajouterJours(demain, 7 * 60)}${qui ? `&${qui}` : ''}`)
    .catch(() => [] as QuizPrevu[])).filter((q) => genreDu(q) && duWeekEnd(q.date_start))
    .sort((a, b) => a.date_start.localeCompare(b.date_start));
  const soucis: string[] = [];
  const series = new Set<string>();
  for (const q of avenir) {
    const rec = q.recurrence?.id;
    if (rec && series.has(rec)) continue;
    if (rec) series.add(rec);
    const x = await appelNolio('DELETE', `planned/quizzes/${q.id}/${rec ? '?recurrence_action=following' : ''}${qui ? `${rec ? '&' : '?'}${qui}` : ''}`).catch(() => null);
    if (!x || (x.statut !== 204 && x.statut !== 200 && x.statut !== 404)) soucis.push(x ? refusNolio(x, 'ses questionnaires du dimanche') : 'ses questionnaires du dimanche : Nolio injoignable');
  }
  if (!soucis.length) await service.from('athletes_coaches').update({ questionnaires: null }).eq('id', ficheId);
  return soucis;
}

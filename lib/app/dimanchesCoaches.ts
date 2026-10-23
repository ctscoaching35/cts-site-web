/**
 * Le dimanche de chaque coaché (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur ; décision coach du 21/10/2026, « une série
 * par coaché ») : « Ta semaine prochaine », avec la question ouverte des coachés (« Une information à remonter à ton
 * coach ? », facultative), et le Hooper, chaque dimanche à 8 h, pour tout coaché relié à Nolio — en programmation
 * automatique, à la main ou sans objectif —, par séries de 26 semaines (Nolio veut une fin), que le passage quotidien
 * renouvelle quatre semaines avant leur fin. Ses objectifs ne posent plus les leurs (ecriture.programmerQuestionnaires,
 * acheteurs seulement). Chaque nuit, avec l'accord de lecture, un mot écrit à la question ouverte se note sur sa fiche,
 * sa date seulement : « À regarder » et l'e-mail du soir le disent, le texte se lit dans Nolio. Côté serveur seulement.
 */
import { destinataire } from './coaching';
import { QUESTIONNAIRE_SEMAINE, type Compte } from './ecriture';
import { appelNolio, listeNolio, refusNolio } from './nolio';
import { ajouterJours } from './plan';
import { clientService } from './supabase';

export const QUESTION_OUVERTE = 'Une information à remonter à ton coach ?';
const SEMAINES = 26;
const MARGE_J = 28;
export type DimanchesCoache = { semaine?: string; hooper?: string | null; jusqua?: string; mot_le?: string | null; mot_note?: string | null };

const aujourdhuiParis = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
// Le premier dimanche strictement après cette date.
const dimancheApres = (iso: string) => ajouterJours(iso, 7 - ((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7) - 1 || 7);

// Le questionnaire des coachés : celui de tous, et la question ouverte au bout.
const questionnaireCoache = () => ({
  ...QUESTIONNAIRE_SEMAINE,
  items: [...QUESTIONNAIRE_SEMAINE.items, { question: QUESTION_OUVERTE, type: 'long_text', is_mandatory: false }],
});

// Chaque jour : la série de chaque coaché relié à Nolio, posée s'il n'en a pas, renouvelée quatre semaines avant sa fin.
export async function programmerLesDimanches(): Promise<Compte[]> {
  const service = clientService();
  const { data: toutes, error } = await service.from('athletes_coaches').select('*').not('nolio_athlete_id', 'is', null);
  // Avant la migration du 21/10/2026, la colonne n'existe pas : rien à faire.
  if (error || toutes?.some((f) => !('questionnaires' in f))) return [];
  // Un athlète en mode plan (décision coach du 23/10/2026) n'a plus sa série : celle de son plan acheté la remplace.
  const fiches = (toutes ?? []).filter((f) => f.mode !== 'plan');
  const aujourdhui = aujourdhuiParis();
  const comptes: Compte[] = [];
  let hooper: string | null | undefined;
  for (const f of fiches ?? []) {
    const usr = String(f.nolio_athlete_id ?? '');
    const serie = (f.questionnaires ?? null) as DimanchesCoache | null;
    if (!/^usr_/.test(usr) || (serie?.jusqua && serie.jusqua > ajouterJours(aujourdhui, MARGE_J))) continue;
    try {
      const d = await destinataire(usr);
      const premier = dimancheApres(serie?.jusqua && serie.jusqua > aujourdhui ? serie.jusqua : aujourdhui);
      const recurrence = { frequency: 'weekly', weekdays: [7], period_count: SEMAINES };
      const pour = (corps: Record<string, unknown>) => (d.moi ? corps : { ...corps, athletes: [d.usr] });
      const q = await appelNolio('POST', 'planned/quizzes/', pour({ ...questionnaireCoache(), date_start: premier, hour_start: '08:00', recurrence }));
      if (q.statut !== 201 && q.statut !== 200) throw new Error(refusNolio(q, 'le questionnaire du dimanche'));
      if (hooper === undefined) {
        const cadres = await listeNolio<{ id: string; scope?: string }>('library/quiz_frames/?quiz_type=hooper').catch(() => []);
        hooper = (cadres.find((c) => c.scope === 'nolio') ?? cadres[0])?.id ?? null;
      }
      const h = hooper
        ? await appelNolio('POST', 'planned/quizzes/', pour({ quiz_frame: hooper, date_start: premier, hour_start: '08:00', recurrence })).catch(() => null)
        : null;
      const suite: DimanchesCoache = {
        semaine: String(q.corps?.id ?? ''), hooper: h && (h.statut === 201 || h.statut === 200) ? String(h.corps?.id ?? '') : null,
        jusqua: ajouterJours(premier, 7 * (SEMAINES - 1)), mot_le: serie?.mot_le ?? null, mot_note: serie?.mot_note ?? null,
      };
      await service.from('athletes_coaches').update({ questionnaires: suite }).eq('id', f.id);
      comptes.push({ plan: '', quoi: `dimanches posés jusqu’au ${suite.jusqua}${suite.hooper ? '' : ' (sans Hooper)'}` });
    } catch (e) {
      comptes.push({ plan: '', quoi: 'dimanches non posés', erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  return comptes;
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

// Sa série retirée de Nolio, à partir de son prochain dimanche (décision coach du 23/10/2026 : passé en mode plan, il a
// celle de son plan acheté) ; la fiche l'oublie, le passage quotidien la repose s'il revient en coaching. Ce qui n'a pas
// pu partir, en phrases.
export async function retirerLesDimanches(ficheId: string): Promise<string[]> {
  const service = clientService();
  const { data: f } = await service.from('athletes_coaches').select('*').eq('id', ficheId).maybeSingle();
  const serie = (f?.questionnaires ?? null) as DimanchesCoache | null;
  const usr = String(f?.nolio_athlete_id ?? '');
  if (!f || !serie || !/^usr_/.test(usr)) return [];
  const d = await destinataire(usr);
  const qui = d.moi ? '' : `athlete=${d.usr}`;
  const series = new Set<string>();
  for (const id of [serie.semaine, serie.hooper].filter((x): x is string => Boolean(x))) {
    const r = await appelNolio('GET', `planned/quizzes/${id}/${qui ? `?${qui}` : ''}`).catch(() => null);
    const rec = r?.statut === 200 ? (r.corps?.recurrence as { id?: string } | null | undefined)?.id : undefined;
    if (rec) series.add(rec);
  }
  const demain = ajouterJours(aujourdhuiParis(), 1);
  type Quiz = { id: string; date_start: string; recurrence?: { id?: string } | null };
  const avenir = (await listeNolio<Quiz>(`planned/quizzes/?date_from=${demain}&date_to=${serie.jusqua ?? ajouterJours(demain, 7 * SEMAINES)}${qui ? `&${qui}` : ''}`)
    .catch(() => [] as Quiz[])).filter((q) => q.date_start.slice(0, 10) >= demain).sort((a, b) => a.date_start.localeCompare(b.date_start));
  const soucis: string[] = [];
  for (const rec of series) {
    const premier = avenir.find((q) => q.recurrence?.id === rec);
    if (!premier) continue;
    const r = await appelNolio('DELETE', `planned/quizzes/${premier.id}/?recurrence_action=following${qui ? `&${qui}` : ''}`).catch(() => null);
    if (!r || (r.statut !== 204 && r.statut !== 200 && r.statut !== 404)) soucis.push(r ? refusNolio(r, 'ses questionnaires du dimanche') : 'ses questionnaires du dimanche : Nolio injoignable');
  }
  if (!soucis.length) await service.from('athletes_coaches').update({ questionnaires: null }).eq('id', ficheId);
  return soucis;
}

/**
 * LE COACHÉ PROGRAMMÉ À LA MAIN REÇOIT LUI AUSSI SON POINT DU DIMANCHE (demande du coach du 26/11/2026 : « comme mes athlètes route, j'aimerais qu'ils reçoivent quand même leur Hooper et leur questionnaire de fin
 * de semaine du dimanche ; je m'appuie dessus pour leur programmation »), sous la 9.x. Le même « Ton point du dimanche » (version normale, sans question de séances clés : rien n'est écrit pour lui), posé le dimanche
 * matin pour midi, et le même rappel de 19 h s'il n'a pas répondu. Le moteur n'écrit toujours rien pour lui, et le rappel d'une séance non remontée ne le concerne pas. Le Hooper, lui, était déjà posé
 * (lib/app/dimanchesCoaches.ts). Ses réponses se lisent dans Nolio (lib/app/lectureDuPoint.ts), sans être gardées ; ses signaux du soir (fatigue, sensations,
 * effort) se gardent comme ceux des autres, avec son accord. La base ne garde que le questionnaire posé et le jour du rappel (athletes_coaches.questionnaires). Côté serveur.
 */
import { enAttenteDeProfil, estAncien } from './anciens';
import { destinataire } from './coaching';
import { HEURE_D_ENVOI, questionnaireDuDimanche } from './dimancheV9';
import type { Compte } from './ecriture';
import type { DimanchesCoache } from './hooperDuDimanche';
import { reponsesAuPoint } from './lectureDuPoint';
import { appelNolio, refusNolio } from './nolio';
import { texteDuRappelV9 } from './rappelDimancheV9';
import { relireEtGarder, seuilsSuivi } from './suivi';
import { clientService } from './supabase';

type Fiche = { id: string; coach_id: string; nolio_athlete_id: string; questionnaires?: DimanchesCoache | null };

// Ceux que le coach programme à la main : reliés à Nolio, en coaching, ni anciens ni fiche créée d'elle-même dont le profil attend (la règle du Hooper).
export const estALaMain = (f: { programmation?: unknown; mode?: unknown; ancien_le?: unknown; en_attente_profil?: unknown; nolio_athlete_id?: unknown }): boolean =>
  f.programmation === 'main' && f.mode !== 'plan' && !estAncien(f) && !enAttenteDeProfil(f) && /^usr_/.test(String(f.nolio_athlete_id ?? ''));

async function lesFiches(): Promise<Fiche[]> {
  const { data, error } = await clientService().from('athletes_coaches').select('*').not('nolio_athlete_id', 'is', null);
  if (error) throw new Error(`fiches à la main : ${error.message}`);
  const vus = new Set<string>();
  return ((data ?? []) as (Fiche & Record<string, unknown>)[]).filter((f) => {
    if (!estALaMain(f) || vus.has(f.nolio_athlete_id)) return false;
    vus.add(f.nolio_athlete_id);
    return true;
  });
}

const aSonAccord = async (f: Fiche): Promise<boolean> => {
  const { data } = await clientService().from('nolio_accords').select('accord_le').eq('coach_id', f.coach_id).eq('nolio_athlete_id', f.nolio_athlete_id).maybeSingle();
  return Boolean(data);
};
const garder = async (f: Fiche, plus: Partial<DimanchesCoache>) => {
  const { data } = await clientService().from('athletes_coaches').select('questionnaires').eq('id', f.id).maybeSingle();
  const { error } = await clientService().from('athletes_coaches').update({ questionnaires: { ...((data?.questionnaires ?? {}) as DimanchesCoache), ...plus } }).eq('id', f.id);
  if (error) throw new Error(`fiche : ${error.message}`);
};

async function pourChacun(budgetMs: number, quoi: string, faire: (f: Fiche) => Promise<string | null>): Promise<Compte[]> {
  const debut = Date.now();
  const comptes: Compte[] = [];
  let fiches: Fiche[];
  try {
    fiches = await lesFiches();
  } catch (e) {
    return [{ plan: '', quoi, erreur: e instanceof Error ? e.message : String(e), coache: true }];
  }
  for (const f of fiches) {
    if (Date.now() - debut > budgetMs) {
      comptes.push({ plan: '', quoi: `${quoi} : temps épuisé`, coache: true });
      break;
    }
    try {
      const fait = await faire(f);
      if (fait) comptes.push({ plan: '', quoi: `à la main : ${fait}`, coache: true });
    } catch (e) {
      comptes.push({ plan: '', quoi, erreur: e instanceof Error ? e.message : String(e), coache: true });
    }
  }
  return comptes;
}

// Le dimanche matin : « Ton point du dimanche », posé une fois, pour midi.
export const poserLesPointsALaMain = (jour: string, budgetMs = 60_000): Promise<Compte[]> => pourChacun(budgetMs, 'point du dimanche à la main non posé', async (f) => {
  if (f.questionnaires?.point?.jour === jour) return null;
  const d = await destinataire(f.nolio_athlete_id);
  const quiz = questionnaireDuDimanche({ version: 'normale', coache: true, accord: await aSonAccord(f) });
  const r = await appelNolio('POST', 'planned/quizzes/', { ...quiz, date_start: jour, hour_start: HEURE_D_ENVOI, ...(d.moi ? {} : { athletes: [d.usr] }) });
  if (r.statut !== 201 && r.statut !== 200) throw new Error(refusNolio(r, 'le questionnaire du dimanche'));
  await garder(f, { point: { jour, nolio_id: String(r.corps?.id ?? '') || null } });
  return 'point du dimanche posé';
});

// Le dimanche vers 19 h : le même rappel, à qui n'a pas répondu à son point posé ce matin ; un seul par dimanche (le jour se note avant l'envoi).
export const rappelerLesALaMain = (jour: string, heure: string, budgetMs = 60_000): Promise<Compte[]> => pourChacun(budgetMs, 'rappel à la main non programmé', async (f) => {
  const pose = f.questionnaires?.point;
  if (pose?.jour !== jour || f.questionnaires?.rappel === jour) return null;
  if ((await reponsesAuPoint(f.nolio_athlete_id, jour, jour, pose.nolio_id)).length) return null;
  const d = await destinataire(f.nolio_athlete_id);
  await garder(f, { rappel: jour });
  const r = await appelNolio('POST', 'planned/messages/', { description: texteDuRappelV9(true), date_start: jour, hour_start: heure, show_to_the_athlete: false, ...(d.moi ? {} : { athletes: [d.usr] }) });
  if (r.statut !== 201 && r.statut !== 200) {
    await garder(f, { rappel: null });
    throw new Error(refusNolio(r, 'le rappel du dimanche'));
  }
  return `rappel programmé à ${heure}`;
});

// Chaque soir : ses signaux de la semaine, avec son accord seulement, gardés comme ceux des athlètes dont la semaine s'écrit (le passage du soir ne lit que ces derniers).
export async function signauxDesALaMain(budgetMs = 40_000, aujourdhui = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date())): Promise<Compte[]> {
  let seuils: Awaited<ReturnType<typeof seuilsSuivi>>;
  try {
    seuils = await seuilsSuivi();
  } catch (e) {
    return [{ plan: '', quoi: 'signaux à la main non lus', erreur: e instanceof Error ? e.message : String(e), coache: true }];
  }
  return pourChacun(budgetMs, 'signaux à la main non lus', async (f) => {
    if (!(await aSonAccord(f))) return null;
    const d = await destinataire(f.nolio_athlete_id);
    await relireEtGarder(f.coach_id, f.nolio_athlete_id, d.moi, seuils, aujourdhui);
    return 'signaux lus';
  });
}

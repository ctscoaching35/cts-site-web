/**
 * Les badges, côté serveur (CTS_NOLIO_CADRAGE.md, BG1 à BG3, décisions coach du 20/10/2026) : chaque nuit, pour chaque
 * athlète qui a donné son accord de lecture, ses séances de course et de trail réalisées sont lues dans Nolio — tout son
 * historique la première fois, année par année, puis les deux derniers mois (une séance importée en retard compte
 * encore) — et ses badges recomptés (badges.ts). Seuls les badges et les totaux par mois sont gardés (table badges),
 * effacés avec l'accord. Une tâche à part du passage du dimanche : une erreur ici ne touche jamais à ses semaines.
 */
import { ajouterSeances, ETAT_VIDE, type Activite, type EtatBadges } from './badges';
import type { Contexte } from './contexte';
import { objectifAffiche } from './ecriture';
import { listeNolio, moiNolio, nolioConfigure, SPORTS_COURSE } from './nolio';
import { ajouterJours } from './plan';
import { clientService } from './supabase';

const PREMIERE_ANNEE = 2010;
const aujourdhuiParis = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());

type Reel = {
  id: string; date_start: string; sport?: string | null; duration?: { value?: number } | null;
  elevation_gain?: { value?: number } | null; distance?: { value?: number; unit?: string } | number | null;
};

// La distance d'une séance en km, quelle que soit son unité ; sans unité, des mètres au-delà de 300.
function enKm(d: Reel['distance']): number | null {
  if (d === null || d === undefined) return null;
  const v = typeof d === 'number' ? d : d.value;
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const unite = typeof d === 'number' ? '' : String(d.unit ?? '').toLowerCase();
  if (unite === 'km') return v;
  if (unite === 'm') return v / 1000;
  if (unite === 'mi') return v * 1.609344;
  return v > 300 ? v / 1000 : v;
}

async function seances(usr: string, moi: boolean, du: string, au: string): Promise<Activite[]> {
  const reels = await listeNolio<Reel>(`real/trainings/?date_from=${du}&date_to=${au}`
    + `&fields=id,date_start,sport,duration,elevation_gain,distance${moi ? '' : `&athlete=${usr}`}`);
  return reels.filter((r) => SPORTS_COURSE.includes(String(r.sport))).map((r) => ({
    id: r.id, date: r.date_start.slice(0, 10), km: enKm(r.distance),
    min: typeof r.duration?.value === 'number' ? r.duration.value / 60 : null,
    dplus: typeof r.elevation_gain?.value === 'number' ? r.elevation_gain.value : null,
  }));
}

// Les athlètes dont l'app lit les séances : les coachés qui ont donné leur accord, les acheteurs qui l'ont coché.
async function athletesAvecAccord(): Promise<string[]> {
  const service = clientService();
  const { data: accords } = await service.from('nolio_accords').select('nolio_athlete_id');
  const { data: acheteurs } = await service.from('plans').select('nolio_athlete_id')
    .not('accord_lecture_le', 'is', null).not('nolio_athlete_id', 'is', null);
  return [...new Set([...(accords ?? []), ...(acheteurs ?? [])].map((x) => String(x.nolio_athlete_id ?? '')))]
    .filter((x) => x && !/^\d+$/.test(x));
}

export type CompteBadges = { athlete: string; quoi: string; erreur?: string };
const REMIS = 'remis à la nuit suivante';

export async function calculerBadges(budgetMs = 240_000): Promise<CompteBadges[]> {
  if (!nolioConfigure()) return [];
  const debut = Date.now();
  const service = clientService();
  const moi = (await moiNolio()).id;
  const hier = ajouterJours(aujourdhuiParis(), -1);
  const annee = Number(hier.slice(0, 4));
  const comptes: CompteBadges[] = [];
  for (const usr of await athletesAvecAccord()) {
    if (Date.now() - debut > budgetMs) {
      comptes.push({ athlete: usr, quoi: REMIS });
      continue;
    }
    try {
      const { data: ligne, error } = await service.from('badges').select('debloques, mois').eq('nolio_athlete_id', usr).maybeSingle();
      if (error) throw new Error(error.message);
      let etat: EtatBadges;
      if (!ligne) {
        const toutes: Activite[] = [];
        for (let an = PREMIERE_ANNEE; an <= annee; an += 1) {
          toutes.push(...await seances(usr, usr === moi, `${an}-01-01`, an === annee ? hier : `${an}-12-31`));
        }
        etat = ajouterSeances(ETAT_VIDE, toutes, null);
      } else {
        const depuis = `${ajouterJours(`${hier.slice(0, 7)}-01`, -1).slice(0, 7)}-01`;
        etat = ajouterSeances(ligne as EtatBadges, await seances(usr, usr === moi, depuis, hier), depuis.slice(0, 7));
      }
      const { error: e } = await service.from('badges').upsert({ nolio_athlete_id: usr, ...etat, maj_le: new Date().toISOString() });
      if (e) throw new Error(e.message);
      comptes.push({ athlete: usr, quoi: `${Object.keys(etat.debloques).length} badges` });
    } catch (e) {
      comptes.push({ athlete: usr, quoi: 'non calculé', erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  return comptes;
}

// Les badges de l'athlète affiché : accord donné (calculés ou pas encore), ou non.
export type MesBadges = { accord: boolean; etat: EtatBadges | null };
export async function mesBadges(ctx: Contexte): Promise<MesBadges> {
  if (ctx.demonstration) return { accord: true, etat: badgesDeDemonstration(ctx.jour) };
  try {
    // Un coaché sans objectif : celui de sa fiche, avec son accord.
    const o = ctx.sansObjectif
      ? (ctx.fiche?.nolio ? { nolioAthlete: ctx.fiche.nolio, accordLecture: ctx.fiche.accord } : null)
      : await objectifAffiche(ctx.cle);
    if (!o?.nolioAthlete || !o.accordLecture) return { accord: false, etat: null };
    const { data } = await clientService().from('badges').select('debloques, mois').eq('nolio_athlete_id', o.nolioAthlete).maybeSingle();
    return { accord: true, etat: (data as EtatBadges | null) ?? null };
  } catch {
    return { accord: false, etat: null };
  }
}

// La démonstration : un coureur aux quelques années de trail, une sortie de 2 000 m D+ il y a deux jours.
function badgesDeDemonstration(jour: string): EtatBadges {
  const a = (id: string, date: string, km: number, min: number, dplus: number) => ({ id, date, km, min, dplus });
  const histoire: Activite[] = [a('1', '2019-03-10', 20.3, 118, 350), a('2', '2019-10-06', 31, 190, 900),
    a('3', '2020-07-12', 24, 175, 1150), a('4', '2021-04-18', 42.4, 238, 520), a('5', '2023-06-24', 52, 395, 1900)];
  for (let i = 0; i < 160; i += 1) histoire.push(a(`p${i}`, ajouterJours('2019-01-07', i * 7), 20, 115, 260));
  histoire.push(a('n', ajouterJours(jour, -2), 28, 230, 2050));
  return ajouterSeances(ETAT_VIDE, histoire.filter((x) => x.date <= jour), null);
}

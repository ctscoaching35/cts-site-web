/**
 * L'accueil de l'espace coach (maquette validée par le coach le 19/10/2026) : ses athlètes, chacun avec son prochain
 * objectif, sa semaine, l'état de sa préparation (la jauge de l'athlète, T4), Nolio et l'app ; et « À regarder »,
 * ce qui attend le coach, d'abord : les objectifs demandés, les ajustements des 7 derniers jours, les objectifs à
 * démarrer, les comptes Nolio à associer. Tout vient de la base (rien n'est lu dans Nolio à l'ouverture) : les signaux
 * des séances restent dans « Suivi des 7 jours ». Côté serveur seulement.
 */
import { athletesCoaches, type FicheAthlete } from './coaching';
import { demandesDuCoach, type Demande } from './demandes';
import type { LigneTrame, Realise } from './ecriture';
import { ajouterJours } from './plan';
import { clientService } from './supabase';
import { jaugeDuPlan, type Verdict } from './tableau';

export type LigneAthlete = {
  id: string; nom: string; usr: string | null; nolio: boolean; accord: boolean; app: boolean;
  objectif: { plan_id: string; course_nom: string; course_date: string; demarre: boolean; prevu: string | null;
    semaine: number | null; total: number | null; verdict: Verdict | null; ecrit: boolean } | null;
  ensuite: { texte: string; ton: 'rien' | 'action' | 'alerte'; href: string };
};
type DemandeAthlete = Demande & { nom: string };
export type ARegarder = { genre: 'demande' | 'ajustement' | 'demarrer' | 'nolio'; athlete: string; texte: string; action: string; href: string };
export type VueCoach = { athletes: LigneAthlete[]; aRegarder: ARegarder[]; demandes: DemandeAthlete[]; enRoute: number };

const aujourdhui = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());

export async function vueDuCoach(coachId: string): Promise<VueCoach> {
  const service = clientService();
  const jour = aujourdhui();
  const fiches = await athletesCoaches(coachId);
  const demandes = await demandesDuCoach(coachId).catch(() => [] as DemandeAthlete[]);
  // Le prochain objectif de chaque athlète, sinon le dernier couru.
  const prochain = (a: FicheAthlete) => a.objectifs.find((o) => o.course_date >= jour) ?? a.objectifs[a.objectifs.length - 1] ?? null;
  const ids = fiches.map(prochain).filter(Boolean).map((o) => o!.plan_id);
  const { data: plans } = ids.length
    ? await service.from('plans').select('id, parametres, demarre_le, depart_prevu, trame, course_date').in('id', ids)
    : { data: [] };
  const { data: lignes } = ids.length
    ? await service.from('semaines_ecrites').select('plan_id, numero, realise, journal, bilan, sans_ajustement, ecrite_le').in('plan_id', ids)
    : { data: [] };
  const usrs = fiches.map((a) => a.nolio_athlete_id).filter((x): x is string => Boolean(x));
  const { data: accords } = usrs.length
    ? await service.from('nolio_accords').select('nolio_athlete_id').eq('coach_id', coachId).in('nolio_athlete_id', usrs)
    : { data: [] };
  const avecAccord = new Set((accords ?? []).map((x) => String(x.nolio_athlete_id)));
  const parPlan = new Map((plans ?? []).map((p) => [p.id as string, p]));

  const aRegarder: ARegarder[] = demandes.map((d) => ({
    genre: 'demande', athlete: d.nom, action: 'Relire et lancer ›', href: `/app/coach/nouveau?athlete=${d.athlete_id}&demande=${d.id}`,
    texte: `demande ${String(d.champs.course_nom ?? 'un objectif')}${d.champs.date_course ? `, le ${String(d.champs.date_course).split('-').reverse().join('/')}` : ''}.`,
  }));
  const athletes: LigneAthlete[] = fiches.map((a) => {
    const o = prochain(a);
    const p = o ? parPlan.get(o.plan_id) : undefined;
    const semaines = (lignes ?? []).filter((l) => l.plan_id === o?.plan_id);
    const realises = semaines.map((l) => l.realise as Realise | null).filter((r): r is Realise => Boolean(r))
      .sort((x, y) => Number(x.numero.slice(1)) - Number(y.numero.slice(1)));
    const trame = ((p?.trame as { semaines?: LigneTrame[] } | null)?.semaines ?? null);
    const jauge = trame ? jaugeDuPlan(trame, realises, jour) : null;
    // Les ajustements écrits ces 7 derniers jours, que le coach peut relire et annuler.
    for (const l of semaines) {
      const journal = (l.journal ?? []) as unknown[];
      if (journal.length && !l.sans_ajustement && String(l.ecrite_le).slice(0, 10) >= ajouterJours(jour, -7)) {
        aRegarder.push({ genre: 'ajustement', athlete: a.nom, action: 'Relire l’ajustement ›', href: `/app/coach/plan/${o!.plan_id}`,
          texte: l.bilan ? String(l.bilan) : `un ajustement dans sa semaine ${String(l.numero).slice(1)}.` });
      }
    }
    const demarre = Boolean(p?.demarre_le);
    const ecrit = Boolean(p?.parametres);
    const avenir = Boolean(o && o.course_date >= jour);
    const demande = demandes.find((d) => d.athlete_id === a.id);
    let ensuite: LigneAthlete['ensuite'];
    if (demande) ensuite = { texte: 'Objectif demandé', ton: 'action', href: `/app/coach/nouveau?athlete=${a.id}&demande=${demande.id}` };
    else if (!o || !avenir) ensuite = { texte: 'Nouvel objectif', ton: 'action', href: `/app/coach/athlete/${a.id}` };
    else if (!a.nolio_athlete_id) ensuite = { texte: 'Associer Nolio', ton: 'action', href: `/app/coach/athlete/${a.id}` };
    else if (ecrit && !demarre && !p?.depart_prevu) ensuite = { texte: 'À démarrer', ton: 'action', href: `/app/coach/plan/${o.plan_id}` };
    else if (jauge?.verdict && jauge.verdict.ton !== 'bien') ensuite = { texte: 'Lui écrire', ton: 'alerte', href: `/app/coach/athlete/${a.id}` };
    else ensuite = { texte: 'Rien à faire', ton: 'rien', href: `/app/coach/athlete/${a.id}` };
    if (o && avenir && ecrit && !demarre && !p?.depart_prevu && a.nolio_athlete_id) {
      aRegarder.push({ genre: 'demarrer', athlete: a.nom, action: 'Démarrer ›', href: `/app/coach/plan/${o.plan_id}`,
        texte: `${o.course_nom} n’est pas encore démarré dans Nolio.` });
    }
    if (o && avenir && !a.nolio_athlete_id) {
      aRegarder.push({ genre: 'nolio', athlete: a.nom, action: 'Associer ›', href: `/app/coach/athlete/${a.id}`,
        texte: 'son compte Nolio n’est pas encore associé à sa fiche.' });
    }
    return {
      id: a.id, nom: a.nom, usr: a.nolio_athlete_id, nolio: Boolean(a.nolio_athlete_id), accord: Boolean(a.nolio_athlete_id && avecAccord.has(a.nolio_athlete_id)),
      app: Boolean(a.compte_id),
      objectif: o ? { plan_id: o.plan_id, course_nom: o.course_nom, course_date: o.course_date, demarre, prevu: (p?.depart_prevu as string | null) ?? null,
        semaine: jauge?.semaine ?? null, total: trame?.length ?? null, verdict: jauge?.verdict ?? null, ecrit } : null,
      ensuite,
    };
  });
  const ordre = { demande: 0, ajustement: 1, demarrer: 2, nolio: 3 } as const;
  aRegarder.sort((x, y) => ordre[x.genre] - ordre[y.genre]);
  return { athletes, aRegarder, demandes, enRoute: athletes.filter((a) => a.objectif?.demarre && a.objectif.course_date >= jour).length };
}

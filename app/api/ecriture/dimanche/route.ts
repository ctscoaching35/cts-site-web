import { nomsDesPlans, passageDuDimanche, prevenirCoach, REMIS, type Compte } from '@/lib/app/ecriture';
import { selonLeMoteur } from '@/lib/app/chaineDuMoteur';
import { passageDuDimancheV9 } from '@/lib/app/passagesV9';
import { moteurEstV9 } from '@/lib/app/moteurEnLigne';
import { TEXTES_A_FAIRE } from '@/lib/app/espaceCoachSimple';
import { saisonsDuJour, saisonsDuV1 } from '@/lib/app/fond';
import { DERNIERE_ECRITURE_DU_DIMANCHE_8X, derniereEcritureDuDimancheV9, ecritureDuDimancheV9, ECRITURE_DU_DIMANCHE_8X, estUnLancementDe8x } from '@/lib/app/heuresDePassage';
import { site } from '@/lib/content';
import { supabaseConfigure } from '@/lib/app/supabase';

// Le passage du dimanche soir (vercel.json, crons ; CTS_NOLIO_CADRAGE.md, T3) : la semaine suivante de chaque plan
// écrit semaine par semaine, d'après la semaine écoulée lue dans Nolio, puis envoyée. Vercel l'appelle avec le secret
// CRON_SECRET ; sans lui, rien ne part. Sous la 8.x, trois passages le dimanche soir (vercel.json, deux heures d'écart : une tâche de
// l'offre gratuite part dans l'heure prévue, jamais deux en même temps) : le premier, puis deux reprises qui ne font que
// ce qui manque (décision coach du 20/10/2026). Sous la v1, deux : vers 21 h, puis vers 22 h en filet (décision 211 du coach, heure de Paris). Le coach n'est prévenu qu'après la dernière, de ce qui reste.
export const dynamic = 'force-dynamic';
// Une semaine par athlète, quelques secondes chacune.
export const maxDuration = 300;
// La dernière reprise du dimanche soir de la 8.x, dans vercel.json (lib/app/heuresDePassage.ts).
const DERNIERE = DERNIERE_ECRITURE_DU_DIMANCHE_8X;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Refusé', { status: 401 });
  if (!supabaseConfigure()) return Response.json({ semaines: [] });
  // L'en-tête de la planification de Vercel (absent d'un appel à la main) et l'heure : vercel.json lance cette route à des heures UTC qui servent la 8.x (17, 19 et 21 h) et la v1
  // (19, 20 et 21 h UTC, dont deux seulement tombent à 21 h et 22 h à Paris selon la saison, décision 211) ; chaque moteur ignore les lancements qui ne sont pas les siens.
  const planif = request.headers.get('x-vercel-cron-schedule');
  const maintenant = new Date();
  // Les saisons de fond du lundi qui vient d'abord (25/10/2026 : créées par le passage du soir, lancé à 21 h 16, elles
  // n'avaient que la dernière reprise) : elles s'écrivent avec les départs, les reprises en secours. Rien en double : une
  // saison déjà là couvre son lundi.
  // Sous le moteur v1 (9.x), la semaine s'écrit par lib/app/passagesV9.ts, vers 21 h et 22 h (heure de Paris), les saisons de fond comprises (C8 ; celles qui manquent se créent d'abord). Sous la 8.x, rien ne change.
  const passage = await selonLeMoteur<{ comptes: Compte[]; derniere: boolean } | null>({
    v1: async () => {
      if (planif && !ecritureDuDimancheV9(maintenant)) return null;
      // Les saisons de fond du lundi qui vient d'abord (un coaché saisi dans la journée) : elles s'écrivent avec les autres plans. Rien en double : une saison déjà là couvre son lundi.
      const saisons = await saisonsDuV1(40_000).catch((e) => [{ plan: '', quoi: 'saisons de fond en échec', erreur: e instanceof Error ? e.message : String(e) }]);
      return { comptes: [...saisons.filter((c) => c.erreur), ...await passageDuDimancheV9(240_000)], derniere: !planif || derniereEcritureDuDimancheV9(maintenant) };
    },
    avant: async () => {
      if (!estUnLancementDe8x(planif, ECRITURE_DU_DIMANCHE_8X)) return null;
      const debut = Date.now();
      const saisons = await saisonsDuJour(60_000).catch((e) => [{ plan: '', quoi: 'saisons de fond en échec', erreur: e instanceof Error ? e.message : String(e) }]);
      // Le temps qui reste aux semaines, dans les 5 minutes de la tâche.
      return { comptes: [...saisons.filter((c) => c.erreur), ...await passageDuDimanche(Math.max(60_000, 240_000 - (Date.now() - debut)))], derniere: !planif || planif === DERNIERE };
    },
  });
  if (!passage) return Response.json({ semaines: [] });
  const { comptes, derniere } = passage;
  // Sans l'athlète : un journal ou un e-mail n'a pas à garder ses données (le plan suffit à le retrouver).
  const echecs = comptes.filter((c) => c.erreur || c.quoi === REMIS);
  if (echecs.length) console.error('Passage du dimanche :', echecs.map((c) => `${c.plan} — ${c.erreur ?? c.quoi}`).join(' ; '));
  // La dernière reprise (ou un appel à la main, sans en-tête de planification) : le coach apprend ce qui reste.
  if (echecs.length && derniere) {
    // E4 (audits du 05/11/2026) : l'e-mail nomme les athlètes (dans l'e-mail au coach seulement, jamais au journal), et dit
    // ce qui est vrai : le passage du lundi soir reprend ces semaines ; un coaché a aussi « Réessayer ».
    const noms = await nomsDesPlans(echecs.map((c) => c.plan).filter(Boolean)).catch(() => new Map<string, string>());
    const qui = [...new Set(echecs.map((c) => noms.get(c.plan)).filter(Boolean))].join(', ');
    await prevenirCoach(`Plans CTS : ${echecs.length} semaine${echecs.length > 1 ? 's' : ''} non écrite${echecs.length > 1 ? 's' : ''}`,
      `Le passage du dimanche n’a pas pu écrire ou envoyer certaines semaines dans Nolio, même après ses reprises${qui ? ` : ${qui}` : ''}. `
      + 'Le passage de lundi soir les reprend, à partir de mardi, et te dit ce qui reste ; pour un coaché, tu peux aussi le faire '
      // Sous la 9.x (décision 220 du coach, 24/11/2026), « Urgent » n'existe plus : « Réessayer » est dans « À faire », sur « Mes athlètes ». Sous la 8.x, rien ne change.
      + `toi-même dès lundi matin, « Réessayer » dans ${(await moteurEstV9().catch(() => false)) ? TEXTES_A_FAIRE.ouReessayer(site.url) : `« Urgent » (${site.url}/app/coach/urgent)`}.`);
  }
  return Response.json({ semaines: comptes.map(({ plan, quoi, erreur }) => ({ plan, quoi, erreur: erreur ?? null })) });
}

import Link from 'next/link';
import { formatRouteDe } from '@/lib/app/route';
import clsx from 'clsx';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import CarteEntree from '@/components/app/CarteEntree';
import FormulaireValeurs from '@/components/app/FormulaireValeurs';
import InvitationApp from '@/components/app/InvitationApp';
import ProfilAthlete from '@/components/app/ProfilAthlete';
import SemainesQuiArrivent from '@/components/app/SemaineQuiArrive';
import { Geste, Regle } from '@/components/app/PointsCoach';
import { StyleCoureur, TableauZones } from '@/components/app/ZonesEtStyle';
import { lignesDuProfil } from '@/lib/app/profilEntrainement';
import TestVcCoach from '@/components/app/TestVcCoach';
import { Carte, PastilleDate, Surtitre } from '@/components/app/Ui';
import { associerNolio, changerProgrammation, retirerAcces, retirerAthlete } from '@/lib/app/actionsCoaching';
import { accordRecu, relireMaintenant, retirerAccord } from '@/lib/app/actionsSuivi';
import { adresseDuCompte } from '@/lib/app/espaceAthlete';
import { ficheAthlete } from '@/lib/app/coaching';
import { initiales } from '@/lib/app/contexte';
import { entreeDe } from '@/lib/app/entree';
import { coursesDansNolio, pasEncoreIci } from '@/lib/app/coursesNolio';
import { espaceDuCoach } from '@/lib/app/mesAthletes';
import { decimale, suiteDe, virgule, type Point } from '@/lib/app/espaceParAthlete';
import { semainesQuiArrivent, lundiMontre } from '@/lib/app/semaineQuiArrive';
import { athletesNolio, ErreurNolio, exigerCoach, nolioConfigure, type AthleteNolio } from '@/lib/app/nolio';
import { ajouterJours, dateAbregee, dateLongue, jMoins, type Zones } from '@/lib/app/plan';
import { allureDepuisVitesse } from '@/lib/app/allureCoach';
import { enHeures } from '@/lib/app/tableau';
import { PROFIL_VIDE, type Profil } from '@/lib/app/zones';
import { reperesDeBase } from '@/lib/app/reperes';
import { demonstrationCoachOuverte } from '@/lib/app/demonstrationCoach';
import { clientService, espaceCoachOuvert } from '@/lib/app/supabase';
import type { CourseSecondaire } from '@/lib/app/tableauDuPlan';
import type { Niveau as Couleur } from '@/lib/app/prevision';

// Toujours calculée à la visite : la page lit la session du coach. « Voir ce que le moteur écrirait » calcule l'aperçu
// du dimanche dans la page (Nolio et le moteur, jusqu'à 60 s, comme l'aperçu complet).
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SIGNAL_EN_CLAIR: Record<string, string> = {
  manquee: 'Séance manquée', plus_dur: 'Plus dur que prévu', sensations: 'Mauvaises sensations', hooper: 'Fatigue qui monte',
  commentaire: 'Commentaire à lire dans Nolio',
};
// La pastille de sa couleur (Q1), celle de « Dimanche ».
const PASTILLE_COULEUR: Record<Couleur, string> = {
  rouge: 'bg-[#F6E1DD] text-[#8A3326]', orange: 'bg-[#F6ECD8] text-[#6E4A0C]', vert: 'bg-[#E3EFE9] text-[#22604F]', rien: 'bg-[#ECEBF2] text-[#4A4866]',
};
const POINT_COULEUR: Record<Couleur, string> = { rouge: 'bg-[#B4513F]', orange: 'bg-[#C8952E]', vert: 'bg-[#0C6E5F]', rien: 'bg-[#A9A8BC]' };
// Les raisons de « À faire pour lui » (venues de « Cette semaine »).
const RAISON: Record<Point['niveau'], string> = { bloque: 'Ce qui bloque', sante: 'Santé', arrive: 'À venir' };
const PASTILLE_RAISON: Record<Point['niveau'], string> = {
  bloque: 'bg-[#F6E1DD] text-[#8A3326]', sante: 'bg-[#F6E3E8] text-[#8A2E4A]', arrive: 'bg-[#E3EFE9] text-[#22604F]',
};
const TENDANCE = { hausse: 'en hausse', baisse: 'en baisse', stable: 'stable' } as const;

// LA PAGE DE L'ATHLÈTE, SA VUE D'ENSEMBLE (décision « 1A » du coach, 08/11/2026 ; maquette validée le 08/11/2026, « tout
// A ») : « Athlète suivant » en haut, en bas et collé au bas de l'écran sur téléphone, dans l'ordre de « Mes athlètes »
// (Q2) ; son en-tête ; « À faire pour lui » (ses points, leur geste et « Réglé ») et sa revue du dimanche (cinq repères,
// Q3) ; « Sa semaine qui arrive » (l'aperçu du dimanche dans la page, Q4) ; sa semaine passée et ses 7 jours en une carte
// (Q5) ; ses objectifs ; ses repères, puis ses zones et son style de coureur tels qu'il les lit dans son app (Q9) ; son
// profil de coureur ; « Réglages » replié. Venue de la fiche d'un athlète coaché (CTS_NOLIO_CADRAGE.md, N8, N9, T6 ;
// maquette validée par le coach le 19/10/2026 ; décisions coach du 04/11/2026).
export default async function PageAthlete({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ apercu?: string }>;
}) {
  if (!espaceCoachOuvert()) notFound();
  const coach = await exigerCoach();
  const { id } = await params;
  const { apercu } = await searchParams;
  const a = await ficheAthlete(coach.compteId, id);
  if (!a) notFound();
  const service = clientService();
  const relie = nolioConfigure();
  const adresse = await adresseDuCompte(a.compte_id).catch(() => null);
  let liste: AthleteNolio[] = [];
  let erreur: string | null = null;
  try {
    liste = relie ? await athletesNolio() : [];
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Athlètes Nolio :', message);
    erreur = e instanceof ErreurNolio ? message : 'Nolio ne répond pas pour l’instant : réessaie dans un moment.';
  }
  // Sa place dans « Mes athlètes » (Q2), ses points, sa couleur et ses signaux du soir : les lectures de la liste.
  const espace = await espaceDuCoach(coach.compteId, relie && !erreur ? new Set(liste.map((x) => x.id)) : null);
  const etat = espace.lignes.find((e) => e.id === a.id) ?? null;
  const suite = suiteDe(espace.lignes, a.id);
  const { data: accord } = a.nolio_athlete_id
    ? await service.from('nolio_accords').select('accord_le').eq('coach_id', coach.compteId).eq('nolio_athlete_id', a.nolio_athlete_id).maybeSingle()
    : { data: null };
  // Ses 7 jours (EC1) : ses signaux gardés du soir (EC2) ; sans la migration du 04/11/2026, rien de gardé.
  const gardesManquent = !espace.signaux;
  const septJours = etat?.signaux ?? null;
  const { data: plans } = a.objectifs.length
    ? await service.from('plans').select('id, parametres, demarre_le, depart_prevu, donnees->course->>distance_km, donnees->course->>dplus_m, zones:donnees->zones, lignes_zones:donnees->mode_emploi->effort->zones')
      .in('id', a.objectifs.map((o) => o.plan_id))
    : { data: [] };
  const parPlan = new Map((plans ?? []).map((p) => [p.id as string, p as Record<string, unknown>]));
  // Ses saisons de fond (décisions coach du 24/10/2026) : à part de ses objectifs ; la saison en cours, en une ligne.
  const saisons = new Set((plans ?? []).filter((p) => (p.parametres as { fond?: unknown } | null)?.fond).map((p) => p.id as string));
  const objectifs = a.objectifs.filter((o) => !saisons.has(o.plan_id));
  // PO1 : son profil, celui de sa fiche s'il a été modifié, sinon celui de son dernier objectif.
  const dernier = objectifs[objectifs.length - 1];
  const { data: intake } = dernier ? await service.from('plans').select('intake').eq('id', dernier.plan_id).maybeSingle() : { data: null };
  const deLIntake = (intake?.intake ?? {}) as Record<string, string | string[]>;
  const profil: Record<string, string | string[]> = a.profil ?? Object.fromEntries(
    ['niveau', 'terrain', 'jours_disponibles', 'jour_sl', 'freq_hebdo'].filter((k) => deLIntake[k] !== undefined).map((k) => [k, deLIntake[k]]));
  const lignesProfil = lignesDuProfil(profil, true);
  const profilVide = Object.keys(profil).length === 0;
  const source = (cle: 'fc_seuil1' | 'vc_ms' | 'fc_seuil2') => {
    const x = a.reperes_sources[cle];
    return !x ? null : x.source === 'test' ? `test lu dans Nolio le ${dateLongue(x.le, true)}`
      : x.source === 'test_coach' ? `test du ${dateLongue(x.le, true)}, saisi par toi`
      : x.source === 'athlete' ? `test saisi par l’athlète le ${dateLongue(x.le, true)}`
      : x.source === 'nolio' ? `repris de Nolio, valeur du ${dateLongue(x.le, true)}` : `saisi par toi le ${dateLongue(x.le, true)}`;
  };
  const reperes: [string, string | null, string | null][] = [
    ['FC au seuil 1', a.fc_seuil1 ? `${a.fc_seuil1} bpm` : null, source('fc_seuil1')],
    ['Vitesse critique', a.vc_ms ? `${allureDepuisVitesse(a.vc_ms)} /km` : null, source('vc_ms')],
    ['FC au seuil 2', a.fc_seuil2 ? `${a.fc_seuil2} bpm` : null, source('fc_seuil2')],
  ];
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const prochain = objectifs.find((o) => o.course_date >= jour)?.plan_id ?? null;
  const saisonEnCours = a.objectifs.find((o) => saisons.has(o.plan_id) && o.course_date >= jour) ?? null;
  const nomNolio = liste.find((x) => x.id === a.nolio_athlete_id)?.name ?? null;
  // Ses courses dans Nolio pas encore dans CTS (décision coach du 22/10/2026, « proposer, tu valides ») : aucun objectif
  // ni course de préparation à leur date.
  const dejaIci = new Set([...a.objectifs.map((o) => o.course_date), ...(plans ?? []).flatMap((p) =>
    (((p.parametres as Record<string, unknown> | null)?.courses_secondaires ?? []) as CourseSecondaire[]).map((c) => c.date))]);
  const coursesNolio = a.nolio_athlete_id && relie
    ? pasEncoreIci(await coursesDansNolio(a.nolio_athlete_id).catch(() => []), dejaIci) : [];
  const courseA = coursesNolio.find((c) => c.type === 'a') ?? null;
  // Son entrée (décision coach du 22/10/2026), sur son prochain objectif.
  const pp = prochain ? parPlan.get(prochain) : undefined;
  // Une fiche passée en mode plan avant le 04/11/2026 (le mode n'est plus dans l'interface) : rien ne s'écrit pour lui,
  // elle se lit comme programmée à la main ; la bascule de programmation ne s'offre pas.
  const ancienPlan = a.mode === 'plan';
  const aLaMain = a.programmation === 'main' || ancienPlan;
  const entree = entreeDe({
    athleteId: a.id, nolio: Boolean(a.nolio_athlete_id), accord: Boolean(accord), programmation: aLaMain ? 'main' : 'auto',
    objectif: prochain ? { plan_id: prochain, ecrit: Boolean(pp?.parametres), demarre: Boolean(pp?.demarre_le),
      prevu: (pp?.depart_prevu as string | null) ?? null } : null,
    dimanchesJusqua: a.questionnaires?.jusqua ?? null, aujourdhui: jour, courseA,
  });
  // Une course B devient une préparation de son objectif en cours, à partir de lundi prochain et avant sa course.
  const lundiProchain = ajouterJours(jour, 7 - ((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7));
  const dateProchain = objectifs.find((o) => o.plan_id === prochain)?.course_date ?? '';
  const pastilles: [string, boolean][] = [
    [a.nolio_athlete_id ? 'Nolio relié' : 'Nolio à associer', Boolean(a.nolio_athlete_id)],
    [accord ? 'Accord de lecture reçu' : 'Sans accord de lecture', Boolean(accord)],
    [a.compte_id ? 'App : ouverte' : 'App : à inviter', Boolean(a.compte_id)],
  ];
  // « Réglages » s'ouvre de lui-même quand il y a à y faire : son compte Nolio à associer, ou il a quitté l'équipe.
  const horsEquipe = Boolean(a.nolio_athlete_id && relie && !erreur && !nomNolio);
  const reglagesOuverts = !a.nolio_athlete_id || horsEquipe;
  const prenom = a.nom.split(' ')[0];
  // Ses points (« À faire pour lui », venus de « Cette semaine ») : ce qui bloque, la santé, ce qui arrive.
  const points = etat?.points ?? [];
  const decisions = etat?.decisions ?? [];
  const allegees = decisions.flatMap((l) => l.ajustements.flatMap((x) => x.allegees.map((j) => ({ planId: x.planId, j }))));
  // Sa semaine qui arrive (Q4) : celles que le moteur écrit dimanche pour lui.
  const ecrites = espace.dimanche.ecrites.filter((e) => e.a.id === a.id);
  const semaines = await semainesQuiArrivent(ecrites, jour, apercu ?? null);
  // Une saison de fond compte vers son prochain objectif (retour coach du 01/11/2026).
  const objectifApres = objectifs.find((o) => o.course_date >= jour) ?? null;
  // Ses zones (Q9) : celles du plan qu'il lit dans son app (son prochain objectif, sa saison en cours, sinon le dernier) ;
  // sans plan, les repères du moteur, comme son app sans objectif.
  const candidats = [prochain, saisonEnCours?.plan_id, ...[...a.objectifs].reverse().map((o) => o.plan_id)].filter(Boolean) as string[];
  const avecZones = candidats.map((x) => parPlan.get(x)).find((p) => p?.zones && Array.isArray(p?.lignes_zones));
  const base = !avecZones && !demonstrationCoachOuverte() ? await reperesDeBase().catch(() => null) : null;
  const zones = (avecZones?.zones ?? base?.zones ?? null) as Zones | null;
  const lignesZones = ((avecZones?.lignes_zones ?? base?.effort.zones ?? []) as string[][]).slice(1);
  const profilZones: Profil = { ...PROFIL_VIDE, fc_seuil1: a.fc_seuil1, vc_ms: a.vc_ms, fc_seuil2: a.fc_seuil2, v_seuil1_ms: a.v_seuil1_ms, d_prime_m: a.d_prime_m };
  // Sa semaine passée (Q5), la même que dans « Mes athlètes ».
  const passee = espace.vue.semainePassee;
  const finPassee = ajouterJours(passee, 6);
  const memeMois = passee.slice(0, 7) === finPassee.slice(0, 7);
  const lundiCourt = new Date(`${passee}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', timeZone: 'UTC' }).replace(/ 1$/, ' 1er');
  const periode = `du ${memeMois ? lundiCourt : dateAbregee(passee)} au ${dateAbregee(finPassee)}`;
  const s = etat?.a.semaine ?? null;
  const hooper = etat?.a.hooper ?? null;
  const r = etat?.a.realise ?? null;
  const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
  const sousLaSemaine = r ? [
    r.cles_prevues ? `${pluriel(r.cles_reussies, 'séance')} clé${r.cles_reussies > 1 ? 's' : ''} réussie${r.cles_reussies > 1 ? 's' : ''} au bon effort sur ${r.cles_prevues}` : null,
    r.sl_prevue_min ? `sortie longue ${r.sl_faite_min ? `de ${enHeures(r.sl_faite_min)}` : 'pas faite'} pour ${enHeures(r.sl_prevue_min)} prévue` : null,
  ].filter(Boolean).join(' · ') : '';
  // SA REVUE DU DIMANCHE (Q3 « A ») : ses cinq questions, calculées sans rien saisir ; un ✓, ou un ! qui renvoie à la
  // section.
  const fenetre = lundiMontre(jour) !== null;
  // « partie, retouchée par toi » (décision 11 du coach du 09/11/2026) : la semaine lue dans Nolio, une retouche marquée
  // (BROUILLON) ; plus de « partie, ajustée » (« Ce que le moteur change » n'est plus sur sa page).
  const retouchee = semaines.some((x) => x.etat === 'ecrite' && x.nolio !== null && 'comparee' in x.nolio && x.nolio.comparee.retouchee);
  const enRoute = semaines.length > 0;
  const partie = semaines.length > 0 && semaines.every((x) => x.etat === 'ecrite' || (x.etat === 'pas_partie' && x.laissee));
  const messages = points.filter((p) => p.genre === 'commentaire' || p.genre === 'mot').length;
  const profilRempli = ['niveau', 'terrain', 'jour_sl', 'freq_hebdo', 'jours_disponibles'].every((k) => profil[k] !== undefined && String(profil[k]).length > 0);
  const revue: { ok: boolean; texte: string; ancre: string }[] = [
    { ok: !fenetre || !enRoute || partie, ancre: '#semaine-qui-arrive', texte: `Sa semaine qui arrive : ${aLaMain ? 'à la main' : !enRoute ? 'rien à écrire'
      : !fenetre ? 's’écrit dimanche soir' : partie ? `partie${retouchee ? ', retouchée par toi' : ''}` : 'pas partie'}` },
    { ok: profilRempli, ancre: '#son-profil', texte: `Son profil : ${profilRempli ? 'complet' : 'à remplir'}` },
    { ok: messages === 0, ancre: '#a-faire', texte: `Ses messages : ${messages === 0 ? 'rien à lire' : `${messages} à lire`}` },
    { ok: !s || (!s.sansRpe && (s.tenue === null || s.tenue >= 80)), ancre: '#sa-semaine-passee',
      texte: `Sa semaine passée : ${!s ? 'rien de lu' : s.sansRpe ? 'sans RPE' : s.tenue === null ? `${s.faites} séance${s.faites > 1 ? 's' : ''} sur ${s.prevues}` : `tenue (${s.tenue} %)`}` },
    { ok: Boolean(a.nolio_athlete_id) && coursesNolio.length === 0, ancre: '#courses-nolio',
      texte: `Ses courses Nolio : ${!a.nolio_athlete_id ? 'Nolio à associer' : coursesNolio.length === 0 ? 'toutes ici' : `${coursesNolio.length} pas encore ici`}` },
  ];
  // Son prochain objectif, sous son nom ; sinon sa saison en cours.
  const sousLeNom = objectifApres ? `${objectifApres.course_nom} · ${dateLongue(objectifApres.course_date, true)} · ${jMoins(jour, objectifApres.course_date)}`
    : saisonEnCours ? `${saisonEnCours.course_nom} · jusqu’au ${dateLongue(saisonEnCours.course_date, true)}` : null;
  const couleur = etat?.prevision.niveau ?? 'rien';
  const prenomDe = (nom: string) => nom.split(' ')[0];
  return (
    <CadreCoach actif="athletes" urgents={espace.urgents}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/coach" className="inline-flex items-center min-h-9 text-[0.8125rem] font-bold text-teal">‹ Mes athlètes</Link>
        {suite && (
          <div className="flex items-center gap-3">
            <span className="text-[0.78rem] font-semibold text-[#5E5C78]">{suite.rang} sur {suite.total}</span>
            {suite.suivant && (
              <Link href={`/app/coach/athlete/${suite.suivant.id}`} className="inline-flex items-center min-h-10 px-3 rounded-[10px] border border-teal text-teal text-[0.8125rem] font-bold whitespace-nowrap">
                <span className="hidden sm:inline">Athlète suivant : {suite.suivant.nom} ›</span><span className="sm:hidden">Suivant ›</span>
              </Link>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4 !mt-2">
        <span className="w-14 h-14 rounded-full bg-[#E1EFEA] text-teal-dark flex items-center justify-center text-lg font-extrabold">{initiales(a.nom)}</span>
        <div className="flex-[1_1_240px]">
          <h1 className="text-[1.75rem] font-extrabold tracking-tight">{a.nom}</h1>
          {sousLeNom && <p className="mt-0.5 text-sm text-[#4A4866]">{sousLeNom}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {etat && (
              <span className={clsx('inline-flex items-center gap-1.5 text-[0.72rem] font-bold px-2.5 py-1 rounded-xl', PASTILLE_COULEUR[couleur])}>
                <span aria-hidden className={clsx('w-2 h-2 rounded-full', POINT_COULEUR[couleur])} />{etat.raison}
              </span>
            )}
            {pastilles.map(([texte, bien]) => (
              <span key={texte} className={clsx('text-[0.72rem] font-bold px-2.5 py-1 rounded-xl',
                bien ? 'bg-[#E3EFE9] text-teal' : 'bg-[#F6ECD8] text-[#7A520D]')}>{texte}</span>
            ))}
          </div>
        </div>
      </div>

      {!entree.complete && (
        <CarteEntree entree={entree} accordRecu={a.nolio_athlete_id && !accord ? accordRecu.bind(null, a.nolio_athlete_id, a.nom) : undefined} />
      )}

      {/* « À faire pour lui » (venu de « Cette semaine ») et sa revue du dimanche (Q3). */}
      <Carte id="a-faire" className="!p-5 space-y-3 scroll-mt-6">
        <Surtitre>À faire pour lui</Surtitre>
        {points.length === 0 ? <p className="text-sm text-teal font-semibold">Rien à faire pour lui pour l’instant.</p> : (
          <ul>
            {points.map((p) => (
              <li key={p.cle} className="flex flex-wrap items-center justify-between gap-3 py-3 border-t first:border-t-0 border-indigo/[0.07]">
                <div className="min-w-0 flex-[1_1_280px] flex flex-wrap items-start gap-x-2 gap-y-1 text-sm text-[#4A4866] leading-snug">
                  <span className={clsx('text-[0.6875rem] font-bold px-2 py-0.5 rounded-full mt-0.5', PASTILLE_RAISON[p.niveau])}>{RAISON[p.niveau]}</span>
                  <span className="min-w-0 flex-[1_1_200px]">
                    {p.texte.charAt(0).toUpperCase()}{p.texte.slice(1)}
                    {p.sous && <span className="block mt-0.5 text-xs text-[#5E5C78]">{p.sous}</span>}
                  </span>
                </div>
                {!p.sansGeste && (
                  <div className="flex items-center gap-2">
                    <Geste r={p} />
                    <Regle cles={[p.cle]} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="pt-3 border-t border-indigo/[0.07]">
          <p className="text-xs font-bold text-[#5E5C78]">Sa revue du dimanche</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {revue.map((x) => {
              const contenu = (
                <>
                  <span aria-hidden className={clsx('inline-flex w-[18px] h-[18px] rounded-full items-center justify-center text-[0.6875rem] font-extrabold text-white',
                    x.ok ? 'bg-teal' : 'bg-[#C8952E]')}>{x.ok ? '✓' : '!'}</span>
                  {x.texte}
                </>
              );
              const classe = 'inline-flex items-center gap-1.5 min-h-8 px-2.5 rounded-[10px] bg-sand text-[0.78rem] font-semibold text-[#3B3957]';
              return <li key={x.ancre}>{x.ok ? <span className={classe}>{contenu}</span> : <a href={x.ancre} className={clsx(classe, 'hover:underline')}>{contenu}</a>}</li>;
            })}
          </ul>
        </div>
      </Carte>

      <SemainesQuiArrivent semaines={semaines} prevision={etat?.prevision ?? { niveau: 'rien', pourquoi: '', prevoit: '' }} aLaMain={aLaMain}
        vers={objectifApres ? { date: objectifApres.course_date, nom: objectifApres.course_nom } : null} />

      {/* Sa semaine passée et ses 7 jours, en une carte (Q5 « A ») : la semaine finie, puis les signaux des 7 derniers jours. */}
      <Carte id="sa-semaine-passee" className="!p-5 scroll-mt-6">
        <div className="flex flex-wrap gap-x-8 gap-y-5">
          <div className="flex-[1_1_300px] min-w-0 space-y-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Surtitre>Sa semaine passée</Surtitre>
              <span className="text-xs text-[#5E5C78]">{periode}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-[12px] bg-sand p-3">
                <div className="text-xl font-extrabold">{s ? `${s.faites} / ${s.prevues}` : '—'}</div>
                <div className="text-[0.72rem] text-[#5E5C78]">séances</div>
              </div>
              <div className="rounded-[12px] bg-sand p-3">
                <div className="text-xl font-extrabold">{s?.sansRpe ? 'sans RPE' : s && s.tenue !== null ? `${s.tenue} %` : '—'}</div>
                <div className="text-[0.72rem] text-[#5E5C78]">charge tenue</div>
                {s && !s.sansRpe && s.tenue !== null && (
                  <span aria-hidden className="mt-1.5 block w-full h-1.5 rounded-full bg-indigo/10 overflow-hidden">
                    <span className={clsx('block h-full rounded-full', s.tenue >= 85 ? 'bg-teal' : s.tenue >= 65 ? 'bg-[#C8952E]' : 'bg-[#B4513F]')}
                      style={{ width: `${Math.min(100, s.tenue)}%` }} />
                  </span>
                )}
              </div>
              <div className="rounded-[12px] bg-sand p-3">
                <div className="text-xl font-extrabold">{hooper ? hooper.valeur : '—'}</div>
                <div className="text-[0.72rem] text-[#5E5C78]">Hooper{hooper?.tendance ? ` · ${TENDANCE[hooper.tendance]}` : ''}</div>
              </div>
            </div>
            {sousLaSemaine && <p className="text-sm text-[#3B3957]">{sousLaSemaine.charAt(0).toUpperCase()}{sousLaSemaine.slice(1)}.</p>}
          </div>

          {accord && a.nolio_athlete_id && (
            <div className="flex-[1_1_300px] min-w-0 space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <Surtitre>Ses 7 jours</Surtitre>
                {septJours && (
                  <span className="text-xs text-[#5E5C78]">
                    Lus le {new Date(septJours.calcule_le).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              {gardesManquent ? (
                <p className="text-sm text-[#4A4866]">Ses signaux ne sont pas encore gardés : la migration du 04/11/2026 est à passer.</p>
              ) : !septJours ? (
                // « Ses 7 jours » vide : validé par le coach le 08/11/2026 (la continuité entre deux objectifs, 1e).
                <p className="text-sm text-[#4A4866]">Rien de lu pour l’instant. Ses séances et son Hooper des 7 derniers jours se lisent dans Nolio chaque soir, dès qu’un objectif ou une saison a démarré. « Relire maintenant » les lit tout de suite.</p>
              ) : (
                <>
                  <p className="text-sm text-[#3B3957]">
                    {septJours.faites} séance{septJours.faites > 1 ? 's' : ''} faite{septJours.faites > 1 ? 's' : ''} sur {septJours.prevues}
                    {/* La moyenne à la française, « 8,8 » (défaut relevé sur la maquette du 08/11/2026). */}
                    {septJours.hooper ? ` · Hooper ${septJours.hooper.valeur}${septJours.hooper.moyenne !== null ? ` (moyenne ${decimale(septJours.hooper.moyenne)})` : ''}` : ''}
                    {septJours.derniere_activite ? ` · dernière activité le ${dateLongue(septJours.derniere_activite, true)}` : ''}
                  </p>
                  {septJours.signaux.length === 0 ? <p className="text-sm text-teal font-semibold">Aucun signal.</p> : (
                    <ul className="space-y-1.5 text-sm">
                      {septJours.signaux.map((x, i) => (
                        <li key={i} className="flex flex-wrap gap-x-2">
                          <span className="font-semibold">{SIGNAL_EN_CLAIR[x.genre] ?? x.genre}</span>
                          <span className="text-[#4A4866]">{dateLongue(x.jour.slice(0, 10), true)} · {virgule(x.detail)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {/* Une séance allégée en cours de semaine (Q6, venue de « Le moteur s'en est chargé »). */}
              {allegees.map(({ planId, j }) => (
                <p key={`${planId}-${j.id}`} className="text-sm text-[#4A4866]">
                  {j.nom} allégée en EF (fatigue franche) ·{' '}
                  <Link href={`/app/garder?plan=${planId}&seance=${encodeURIComponent(j.id)}`} className="font-semibold text-teal">Garder la séance d’origine</Link>
                </p>
              ))}
              {!gardesManquent && (
                <form action={relireMaintenant.bind(null, a.nolio_athlete_id)}>
                  <button type="submit" className="min-h-10 px-3 rounded-[10px] border border-teal text-teal text-[0.8125rem] font-bold">Relire maintenant</button>
                </form>
              )}
            </div>
          )}
        </div>
      </Carte>

      {/* Deux colonnes sur ordinateur (ses objectifs, ses repères, son profil | ses zones, son style) ; une seule sur
          téléphone, dans l'ordre de la maquette : objectifs, repères, zones et style, profil. */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="contents lg:flex lg:flex-col lg:gap-5 lg:flex-[1_1_380px] lg:min-w-0">
          <Carte className="!p-5 space-y-3 order-1">
            <div className="flex justify-between items-center gap-3">
              <Surtitre>Ses objectifs</Surtitre>
              {/* Deux entrées (décision coach du 23/10/2026) : le trail ou la route (10 km, semi, marathon). */}
              <Link href={`/app/coach/nouveau?athlete=${a.id}&discipline=route`} className="inline-flex items-center min-h-10 px-3.5 rounded-[10px] border border-teal text-teal text-[0.8125rem] font-bold">
                + Objectif route
              </Link>
              <Link href={`/app/coach/nouveau?athlete=${a.id}`} className="inline-flex items-center min-h-10 px-3.5 rounded-[10px] bg-teal text-white text-[0.8125rem] font-bold">
                + Objectif trail
              </Link>
            </div>
            {saisonEnCours && (
              <Link href={`/app/coach/plan/${saisonEnCours.plan_id}`} className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#E1EFEA] text-[#0B4A40]">
                <span className="flex-1 min-w-0">
                  <span className="block text-[0.9375rem] font-bold">{saisonEnCours.course_nom} · en cours</span>
                  <span className="block text-[0.78rem]">Jusqu’au {dateLongue(saisonEnCours.course_date, true)} · le moteur écrit ses semaines ; un objectif qui arrive prend la suite.</span>
                </span>
                <span aria-hidden>›</span>
              </Link>
            )}
            {objectifs.length === 0 && <p className="text-sm text-[#4A4866]">Aucun pour l’instant.</p>}
            {objectifs.map((o) => {
              const p = parPlan.get(o.plan_id);
              const principal = o.plan_id === prochain;
              const preps = (((p?.parametres as Record<string, unknown> | null)?.courses_secondaires ?? []) as CourseSecondaire[])
                .slice().sort((x, y) => x.date.localeCompare(y.date));
              const statut = o.course_date < jour ? 'couru'
                : !p?.parametres ? 'envoyé en entier'
                  : aLaMain ? 'programmé à la main'
                  : p.demarre_le ? `en route dans Nolio depuis le ${dateLongue(String(p.demarre_le).slice(0, 10), true)}`
                    : p.depart_prevu ? `démarre le ${dateLongue(String(p.depart_prevu), true)}` : 'pas encore démarré';
              const distance = p?.distance_km ? `${Math.round(Number(p.distance_km))} km` : null;
              const dplus = p?.dplus_m ? `${Number(p.dplus_m).toLocaleString('fr-FR')} m D+` : null;
              return (
                <div key={o.plan_id} className="space-y-2">
                  <Link href={`/app/coach/plan/${o.plan_id}`}
                    className={clsx('flex items-center gap-3.5 p-3.5 rounded-xl', principal ? 'bg-indigo text-white' : 'border border-indigo/[0.12] text-indigo')}>
                    <PastilleDate iso={o.course_date} sombre={principal} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[0.9375rem] font-bold">{o.course_nom}{principal ? ' · objectif principal' : ''}</span>
                      <span className={clsx('block text-[0.78rem]', principal ? 'text-[#D6D5E6]' : 'text-[#5E5C78]')}>
                        {[distance, dplus, statut].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span aria-hidden>›</span>
                  </Link>
                  {preps.filter((c) => c.date >= jour).map((c) => (
                    <div key={`${c.date}-${c.nom}`} className="ml-4 flex items-center gap-3 p-3 rounded-xl border border-indigo/[0.12]">
                      <PastilleDate iso={c.date} />
                      <span className="text-[0.84rem]"><strong>{c.nom}</strong> · préparation · {c.distance_km} km{c.dplus_m ? ` · ${c.dplus_m} m D+` : ''}</span>
                    </div>
                  ))}
                  {principal && !aLaMain && Boolean(p?.parametres) && !p?.demarre_le && !p?.depart_prevu && (
                    <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-xl bg-[#E1EFEA]">
                      <span className="flex-[1_1_240px] text-[0.8125rem] leading-relaxed text-[#0B4A40]">Pas encore démarré dans Nolio : la trame, ses questionnaires et sa semaine partent au départ.</span>
                      <Link href={`/app/coach/plan/${o.plan_id}`} className="inline-flex items-center min-h-11 px-4 rounded-[10px] bg-teal text-white text-[0.8125rem] font-bold">Démarrer dans Nolio</Link>
                    </div>
                  )}
                </div>
              );
            })}
          </Carte>

          {coursesNolio.length > 0 && (
            <Carte id="courses-nolio" className="!p-5 space-y-3 order-2 scroll-mt-6">
              <Surtitre>Ses courses dans Nolio</Surtitre>
              <p className="text-[0.8125rem] leading-relaxed text-[#4A4866]">Celles que tu as posées dans Nolio et qui ne sont pas encore ici.</p>
              {coursesNolio.map((c) => {
                const preparation = c.type === 'b' && prochain && pp?.parametres && c.date >= lundiProchain && c.date < dateProchain;
                return (
                  <div key={c.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-indigo/[0.12]">
                    <PastilleDate iso={c.date} />
                    <span className="flex-[1_1_180px] min-w-0">
                      <span className="block text-sm font-bold">{c.nom}</span>
                      <span className="block text-xs text-[#5E5C78]">
                        {[c.type === 'a' ? 'objectif A' : c.type === 'b' ? 'course B' : null,
                          c.distance_km ? `${c.distance_km} km` : 'distance à saisir', c.dplus_m ? `${c.dplus_m} m D+` : null].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <Link href={preparation ? `/app/coach/plan/${prochain}?course=${c.id}#ajouter-course` : `/app/coach/nouveau?athlete=${a.id}&course=${c.id}${formatRouteDe(c.distance_km, c.dplus_m) ? '&discipline=route' : ''}`}
                      className="inline-flex items-center min-h-10 px-3 rounded-[10px] border border-teal text-teal text-[0.8125rem] font-bold whitespace-nowrap">
                      {preparation ? 'En préparation ›' : 'Créer l’objectif ›'}
                    </Link>
                  </div>
                );
              })}
            </Carte>
          )}

          <Carte className="!p-5 space-y-1 order-3">
            <Surtitre>Ses repères</Surtitre>
            <ul className="pt-1.5">
              {reperes.map(([titre, valeur, d]) => (
                <li key={titre} className="flex justify-between items-center gap-3 min-h-12 border-b last:border-b-0 border-indigo/[0.06]">
                  <span><span className="block text-sm font-bold">{titre}</span>
                    <span className="block text-[0.72rem] text-[#5E5C78]">{valeur ? d ?? 'sur sa fiche' : 'le test s’écrira à la place d’une séance'}</span></span>
                  <span className={clsx('font-extrabold', valeur ? 'text-[0.9375rem]' : 'text-[0.8125rem] text-[#8A5E10]')}>{valeur ?? 'à tester'}</span>
                </li>
              ))}
            </ul>
            <details className="pt-2">
              <summary className="cursor-pointer min-h-10 flex items-center text-[0.8125rem] font-bold text-teal">Saisir son test de vitesse critique</summary>
              <p className="mb-3 text-[0.8125rem] leading-relaxed text-[#4A4866]">
                S’il ne l’a pas fait dans l’app, ou si sa lecture dans Nolio n’a pas abouti : ses deux efforts donnent sa vitesse
                critique et son profil de coureur. Un test écrit dans ses semaines et pas encore lu est alors marqué lu.
              </p>
              <TestVcCoach athleteId={a.id} aujourdhui={jour} />
            </details>
            <details className="pt-1">
              <summary className="cursor-pointer min-h-10 flex items-center text-[0.8125rem] font-bold text-teal">Modifier ses repères</summary>
              <p className="mb-3 text-[0.8125rem] leading-relaxed text-[#4A4866]">
                Avec eux, les séances partent avec une allure sur le plat ou une FC, puis le RPE ; sans eux, au RPE, et le test
                s’écrit à la place d’une séance. Gardés seulement avec son accord de lecture.
              </p>
              <FormulaireValeurs athleteId={a.id} fc1={a.fc_seuil1} vs1Allure={a.v_seuil1_ms ? allureDepuisVitesse(a.v_seuil1_ms) : null}
                vcAllure={a.vc_ms ? allureDepuisVitesse(a.vc_ms) : null} fc2={a.fc_seuil2} />
            </details>
          </Carte>

          {/* Son profil de coureur, rempli d'abord, avant son premier objectif (décision coach du 23/10/2026). */}
          <Carte id="son-profil" className="!p-5 space-y-1 scroll-mt-6 order-6">
            <Surtitre>Son profil de coureur</Surtitre>
            {profilVide ? (
              <p className="pt-1 text-[0.8125rem] leading-relaxed text-[#4A4866]">
                À remplir avant son premier objectif : son niveau et sa semaine habituelle. Ses objectifs ne demanderont
                ensuite que sa course et sa charge du moment. Invité dans l’app, il peut aussi le remplir lui-même.
              </p>
            ) : (
              <>
                <dl className="pt-1.5">
                  {lignesProfil.map(([cle, valeur]) => (
                    <div key={cle} className="grid grid-cols-[112px_1fr] gap-x-3 py-2.5 border-b last:border-b-0 border-indigo/[0.06] text-[0.84rem]">
                      <dt className="font-semibold text-[#5E5C78]">{cle}</dt><dd>{valeur}</dd>
                    </div>
                  ))}
                </dl>
                <p className="pt-1 text-[0.72rem] leading-relaxed text-[#5E5C78]">Rempli une fois. Les disponibilités de chaque semaine viennent ensuite de son questionnaire du samedi.</p>
              </>
            )}
            <details className="pt-2" open={profilVide}>
              <summary className="cursor-pointer min-h-10 flex items-center text-[0.8125rem] font-bold text-teal">{profilVide ? 'Remplir son profil' : 'Modifier son profil'}</summary>
              <div className="pt-2"><ProfilAthlete athleteId={a.id} profil={profil} /></div>
            </details>
          </Carte>
        </div>

        {/* Ses zones et son style de coureur, tels qu'il les lit dans son app (Q9 « A », décision coach du 08/11/2026 :
            « réutilisé tel quel », textes au « tu »). */}
        <div className="contents lg:flex lg:flex-col lg:gap-5 lg:flex-[1_1_320px] lg:min-w-0">
          <p className="order-4 -mb-2 lg:mb-0 text-xs font-bold text-[#5E5C78]">Ce qu’il lit dans son app</p>
          {zones && lignesZones.length > 0 && (
            <div className="order-4"><TableauZones zones={zones} lignes={lignesZones} profil={profilZones} titre="Ses zones" /></div>
          )}
          <div className="order-5 space-y-5"><StyleCoureur profil={profilZones} titre="Son style de coureur" /></div>
        </div>
      </div>

      {/* « Réglages », replié (décision coach du 04/11/2026) : ce qui se règle une fois. */}
      <details id="reglages" open={reglagesOuverts} className="group bg-white rounded-2xl border border-indigo/[0.08] scroll-mt-6">
        <summary className="cursor-pointer list-none min-h-14 px-5 flex items-center justify-between gap-3">
          <span className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-teal">Réglages</span>
          <span className="text-xs text-[#5E5C78]">sa programmation, l’app, son compte Nolio, son accord <span aria-hidden className="inline-block group-open:rotate-90">›</span></span>
        </summary>
        <div className="px-5 pb-5 divide-y divide-indigo/[0.07]">
          <section className="py-4 space-y-3">
            <h3 className="text-sm font-bold">Sa programmation</h3>
            <p className="text-sm leading-relaxed text-[#4A4866]">
              {ancienPlan
                ? 'Rien ne s’écrit pour lui ici : sa fiche reste pour l’historique.'
                : a.programmation === 'main'
                  ? 'À la main : tu écris ses séances dans Nolio, le moteur n’écrit rien pour lui. L’app reste son tableau de bord : sa semaine lue dans Nolio, ses données résumées chaque nuit, son profil, ses tests et ses badges ; avec un objectif, son J-, sa fiche de course et son jour J.'
                  : 'Automatique : le moteur écrit ses semaines chaque dimanche, d’après sa semaine écoulée ; tu retouches dans Nolio au besoin.'}
            </p>
            {!ancienPlan && (
              <>
                <form action={changerProgrammation.bind(null, a.id, a.programmation === 'main' ? 'auto' : 'main')}>
                  <button type="submit" className="min-h-11 px-4 rounded-[10px] border border-teal text-teal text-sm font-bold">
                    {a.programmation === 'main' ? 'Repasser en automatique' : 'Le programmer à la main'}
                  </button>
                </form>
                <p className="text-[0.72rem] leading-relaxed text-[#5E5C78]">
                  {a.programmation === 'main'
                    ? 'En automatique, l’écriture reprend au dimanche suivant ; un objectif pas encore démarré se démarre dans Nolio.'
                    : 'À la main, ce qui est déjà dans Nolio y reste ; plus rien ne s’y écrit à partir de maintenant.'}
                </p>
              </>
            )}
          </section>

          <section className="py-4 space-y-3">
            <h3 className="text-sm font-bold">Dans l’app</h3>
            <p className="text-sm leading-relaxed text-[#4A4866]">
              {adresse
                ? `Son espace est ouvert (${adresse}) : son tableau de bord, ses données, son profil, la bibliothèque. Ses séances restent dans Nolio.`
                : `${prenom} n’a pas encore accès à l’app. Invité, il reçoit un code à cette adresse pour s’y connecter, et voit son tableau de bord, ses données, son profil et la bibliothèque. Ses séances restent dans Nolio.`}
            </p>
            <InvitationApp athleteId={a.id} adresse={adresse} />
            {a.compte_id && (
              <form action={retirerAcces.bind(null, a.id)}>
                <button type="submit" className="text-xs text-[#5E5C78] underline underline-offset-2">Retirer son accès</button>
              </form>
            )}
          </section>

          <section id="son-nolio" className="py-4 space-y-3 scroll-mt-6">
            <h3 className="text-sm font-bold">Son compte Nolio</h3>
            {!relie ? (
              <p className="text-sm text-[#4A4866]">La clé de l’API Nolio manque dans Vercel (NOLIO_API_KEY).</p>
            ) : erreur ? (
              <p className="text-sm text-[#4A4866]">{erreur}</p>
            ) : (
              <>
                {a.nolio_athlete_id && (
                  <p className="text-[0.8125rem] text-[#4A4866]">
                    {nomNolio ? `Associé à ${nomNolio}.` : 'Associé à un athlète que Nolio ne retrouve pas dans ton équipe : choisis à nouveau son nom, ou retire-le.'}
                  </p>
                )}
                {/* La liste de l'équipe ne s'affiche qu'après « Changer » (décision coach du 04/11/2026). */}
                {a.nolio_athlete_id && nomNolio ? (
                  <details>
                    <summary className="cursor-pointer inline-flex items-center min-h-10 text-[0.8125rem] font-bold text-teal">Changer</summary>
                    <ChoixNolio athleteId={a.id} liste={liste} actuel={a.nolio_athlete_id} bouton="Changer" />
                  </details>
                ) : (
                  <ChoixNolio athleteId={a.id} liste={liste} actuel={a.nolio_athlete_id} bouton={a.nolio_athlete_id ? 'Changer' : 'Associer'} />
                )}
              </>
            )}
          </section>

          {accord && a.nolio_athlete_id && (
            <section id="accord" className="py-4 space-y-2 scroll-mt-6">
              <h3 className="text-sm font-bold">Son accord de lecture</h3>
              <p className="text-sm text-[#4A4866]">
                Reçu{accord.accord_le ? ` le ${new Date(String(accord.accord_le)).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}` : ''} : ses
                séances, son RPE et son Hooper sont lus dans Nolio, et ses repères gardés sur sa fiche.
              </p>
              {/* B-EC-3 (audit du 03/11/2026) : une confirmation d'abord, qui dit ce qui s'efface. */}
              <details className="text-[0.8125rem]">
                <summary className="cursor-pointer inline-flex items-center min-h-10 text-[#5E5C78] underline underline-offset-2">Retirer l’accord</summary>
                <form action={retirerAccord.bind(null, a.nolio_athlete_id)} className="mt-1.5 space-y-2 max-w-md">
                  <p className="text-[#4A4866] leading-relaxed">
                    L’app ne lira plus ses séances, et ce qu’elle en a gardé s’efface : ses repères (FC, allures), les résumés de ses
                    semaines, ses signaux et ses badges. Rien ne se récupère.
                  </p>
                  <button type="submit" className="min-h-10 px-3 rounded-[10px] border border-[#8A3326]/40 bg-white text-[#8A3326] font-bold">
                    Retirer l’accord de {a.nom}
                  </button>
                </form>
              </details>
            </section>
          )}

          <section id="retirer" className="py-4 scroll-mt-6">
            <details open={horsEquipe} className="text-[0.8125rem] text-[#5E5C78]">
              <summary className="cursor-pointer inline-flex items-center min-h-10 font-bold text-indigo">Retirer cet athlète</summary>
              <p className="mt-1">Sa fiche et ses objectifs quittent ton espace coach. Les séances déjà envoyées restent dans Nolio.</p>
              <form action={retirerAthlete.bind(null, a.id)} className="mt-2">
                <button type="submit" className="min-h-10 px-3 rounded-[10px] border border-indigo/25 bg-white text-indigo font-bold">Retirer {a.nom}</button>
              </form>
            </details>
          </section>
        </div>
      </details>

      {/* « Athlète suivant », dans l'ordre de « Mes athlètes » (Q2) : en bas de la page sur ordinateur, collé au bas de
          l'écran sur téléphone (maquette du 08/11/2026). */}
      {suite && (
        <nav aria-label="Athlète suivant" className="sticky bottom-0 z-20 -mx-4 sm:-mx-8 lg:mx-0 px-4 sm:px-8 lg:px-0 py-2.5 lg:py-0 bg-white lg:bg-transparent border-t lg:border-t-0 border-indigo/[0.12] shadow-[0_-6px_18px_rgba(31,29,56,0.08)] lg:shadow-none lg:static flex items-center justify-between gap-2">
          {suite.precedent ? (
            <Link href={`/app/coach/athlete/${suite.precedent.id}`} className="inline-flex items-center justify-center min-h-11 lg:min-h-12 px-3.5 lg:px-5 rounded-xl border border-indigo/25 bg-white text-indigo text-[0.8125rem] lg:text-sm font-bold whitespace-nowrap">
              <span className="lg:hidden">‹ {prenomDe(suite.precedent.nom)}</span><span className="hidden lg:inline">‹ {suite.precedent.nom}</span>
            </Link>
          ) : <span />}
          <span className="text-[0.78rem] font-semibold text-[#5E5C78] whitespace-nowrap">{suite.rang} sur {suite.total}</span>
          {suite.suivant ? (
            <Link href={`/app/coach/athlete/${suite.suivant.id}`} className="inline-flex items-center justify-center min-h-11 lg:min-h-12 px-3.5 lg:px-5 rounded-xl bg-teal text-white text-[0.8125rem] lg:text-sm font-bold text-center">
              <span className="lg:hidden">{suite.suivant.nom} ›</span><span className="hidden lg:inline">Athlète suivant : {suite.suivant.nom} ›</span>
            </Link>
          ) : (
            <Link href="/app/coach" className="inline-flex items-center justify-center min-h-11 lg:min-h-12 px-3.5 lg:px-5 rounded-xl bg-teal text-white text-[0.8125rem] lg:text-sm font-bold whitespace-nowrap">Mes athlètes ›</Link>
          )}
        </nav>
      )}
    </CadreCoach>
  );
}

// Son nom dans Nolio, choisi dans ton équipe.
function ChoixNolio({ athleteId, liste, actuel, bouton }: { athleteId: string; liste: AthleteNolio[]; actuel: string | null; bouton: string }) {
  return (
    <form action={associerNolio.bind(null, athleteId)} className="flex flex-wrap items-center gap-2 pt-1">
      <select name="nolio_id" defaultValue={actuel ?? ''} aria-label="Son nom dans Nolio"
        className="flex-1 min-w-[12rem] min-h-11 rounded-[10px] border border-indigo/20 px-3 text-sm text-indigo bg-white">
        <option value="" disabled>Choisis son nom</option>
        {liste.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <button type="submit" className="min-h-11 px-4 rounded-[10px] border border-teal text-teal text-sm font-bold">{bouton}</button>
    </form>
  );
}

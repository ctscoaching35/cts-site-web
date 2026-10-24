import Link from 'next/link';
import { CarteNouveauBadge } from './Badges';
import EnTeteApp from './EnTeteApp';
import PourBienDemarrer from './PourBienDemarrer';
import {
  CarteNolio, CarteObjectif, CetteSemaine, CoursesPreparation, FichesDeLaSemaine, Piliers,
} from './TableauDeBord';
import { Carte, CarteSombre, Surtitre } from './Ui';
import { nouveauxBadges } from '@/lib/app/badges';
import { mesBadges } from '@/lib/app/badgesNolio';
import { monProfilDEntrainement } from '@/lib/app/profilEntrainement';
import { lien, prenom, type Contexte } from '@/lib/app/contexte';
import { lireTemps } from '@/lib/plan';
import { ajouterJours, dateLongue, joursEntre, moment } from '@/lib/app/plan';
import { fichesDeLaSemaine, jaugeDuPlan, momentDe } from '@/lib/app/tableau';
import { donneesTableau, semaineDansNolio, semaineEcrite } from '@/lib/app/tableauDuPlan';

// L'accueil de l'athlète (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, T1, AP1, AP2 ; maquette validée par le coach le
// 19/10/2026) : les séances vivent dans Nolio ; ici l'objectif et sa montagne, un badge tout neuf (BG3), les piliers,
// les courses de préparation, la semaine en cours, la fiche du moment ; pour un coaché entre deux objectifs, l'accueil
// d'entre-deux. Celui de l'athlète connecté (app/app/page.tsx).
// demarrage : « Pour bien démarrer » (décision coach du 21/10/2026), tant qu'elle n'est pas masquée sur cet appareil ;
// demande : sa demande d'objectif vient de partir ; aVenir : un objectif à venir sur son compte, demandé seulement après
// sa dernière course.
export default async function AccueilAthlete({ ctx, demarrage, demande = false, aVenir }: {
  ctx: Contexte; demarrage: boolean; demande?: boolean; aVenir: () => Promise<boolean>;
}) {
  const { plan, jour } = ctx;
  const installer = `${lien('/app/compte', ctx)}#installer`;
  // Le profil de coureur d'un coaché, rempli d'abord (décision coach du 23/10/2026) : une étape de « Pour bien démarrer ».
  const profil = !ctx.coache || ctx.demonstration || !demarrage
    || Object.keys((await monProfilDEntrainement().catch(() => null)) ?? { inconnu: true }).length > 0;
  const lienProfil = `${lien('/app/profil', ctx)}#profil-entrainement`;
  const lundiCourant = ajouterJours(jour, -((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7));
  // Un coaché sans objectif (décision coach du 20/10/2026, « tableau de bord complet ») : sa semaine dans Nolio, un
  // badge tout neuf, de quoi proposer un objectif ; ses données, son profil et la bibliothèque ont leur onglet.
  if (ctx.sansObjectif) {
    const badges = await mesBadges(ctx);
    const nouveaux = badges.etat ? nouveauxBadges(badges.etat, jour) : [];
    const semaine = await semaineDansNolio(ctx, lundiCourant);
    const nom = prenom(plan.athlete.nom);
    return (
      <>
        <EnTeteApp ctx={ctx} />
        <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
          <div>
            <div className="text-xs font-semibold text-[#5E5C78] first-letter:uppercase">{dateLongue(jour)}</div>
            <h1 className="mt-1 text-[1.625rem] font-extrabold text-indigo tracking-tight">{nom ? `Bonjour ${nom}` : 'Bonjour'}</h1>
          </div>
          {demande && (
            <Carte className="text-sm text-indigo"><p role="status">Ta demande est partie chez ton coach : il la relit et lance ta préparation.</p></Carte>
          )}
          {demarrage && <PourBienDemarrer acheteur={false} nolio="coache" accord={Boolean(ctx.fiche?.accord)} questionnaire={false} installer={installer} profil={profil} lienProfil={lienProfil} />}
          <CetteSemaine semaine={null} ligne={null} questionnaire={false} nolio={semaine} />
          <CarteNouveauBadge badges={nouveaux} href={`${lien('/app/profil', ctx)}#badges`} />
          <CarteSombre className="space-y-3">
            <Surtitre ton="clair" as="div">Ton prochain objectif</Surtitre>
            <p className="text-[0.9375rem] font-bold">Un objectif majeur en vue ? Propose-le à ton coach.</p>
            <Link href="/app/objectif/nouveau" className="inline-flex items-center min-h-11 px-4 rounded-full bg-white text-indigo text-[0.8125rem] font-bold">
              Proposer un objectif majeur
            </Link>
          </CarteSombre>
        </main>
      </>
    );
  }
  const d = await donneesTableau(ctx);
  const etape = moment(plan, jour);
  const restants = joursEntre(jour, plan.course.date);
  const rang = d.trame.findIndex((l) => l.lundi && momentDe(l.lundi, jour) === 'encours');
  // Toujours la semaine en cours, rien d'autre (décision coach du 24/10/2026 ; avant : la première semaine de la
  // préparation, avant son début) : avant le départ, ce qui est dans Nolio cette semaine, et quand la préparation commence.
  const ligne = rang >= 0 ? d.trame[rang] : null;
  const semaine = ligne ? await semaineEcrite(ctx, ligne.numero) : null;
  const debut = etape === 'avant' ? d.trame.find((l) => l.lundi && l.lundi > jour)?.lundi ?? null : null;
  // Ce qui est dans Nolio cette semaine, retouches du coach comprises (décision coach du 20/10/2026), une fois la semaine
  // partie dans Nolio ; programmé à la main, la semaine en cours, sans la trame du moteur.
  const nolio = ctx.aLaMain || (!ligne && etape === 'avant') ? await semaineDansNolio(ctx, lundiCourant)
    : ligne?.lundi ? await semaineDansNolio(ctx, ligne.lundi, ligne.numero) : null;
  // Pas encore dans Nolio : la semaine de la préparation, et quand elle y arrive (décision coach du 20/10/2026).
  const arrivee = nolio || ctx.demonstration || !ligne ? null : !ctx.coache && d.nolio !== 'actif' ? 'invitation' as const : 'bientot' as const;
  const jauge = jaugeDuPlan(d.trame, d.realises, jour);
  const fiches = fichesDeLaSemaine(d.fiches, jour);
  const nom = prenom(plan.athlete.nom);
  // Un badge débloqué la semaine écoulée (BG3, décision coach du 20/10/2026).
  const badges = await mesBadges(ctx);
  const nouveaux = badges.etat ? nouveauxBadges(badges.etat, jour) : [];
  // Une course de préparation s'ajoute dans l'objectif, tant que la course est à venir et le plan écrit semaine par
  // semaine.
  const ajout = d.ecrit && !ctx.demonstration && plan.course.date >= jour ? `${lien('/app/plan', ctx)}#ajouter-course` : null;
  // L'entre-deux d'un coaché (décision coach du 20/10/2026) : sa dernière course passée, aucun objectif à venir. Son
  // prochain se prépare avec son coach ; sa semaine se lit dans Nolio (les séances que son coach lui pose à la main).
  const entreDeux = ctx.coache && etape === 'apres' && (ctx.demonstration || !(await aVenir()));
  const semaineEntreDeux = entreDeux ? await semaineDansNolio(ctx, lundiCourant) : null;
  if (entreDeux) {
    return (
      <>
        <EnTeteApp ctx={ctx} />
        <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
          <div>
            <div className="text-xs font-semibold text-[#5E5C78] first-letter:uppercase">{dateLongue(jour)}</div>
            <h1 className="mt-1 text-[1.625rem] font-extrabold text-indigo tracking-tight">{nom ? `Bonjour ${nom}` : 'Bonjour'}</h1>
          </div>
          {demarrage && <PourBienDemarrer acheteur={false} nolio="coache" accord={d.accord} questionnaire={false} installer={installer} profil={profil} lienProfil={lienProfil} />}
          <CarteSombre className="space-y-3">
            <Surtitre ton="clair" as="div">Ton prochain objectif</Surtitre>
            <p className="text-[0.9375rem] font-bold">Il se prépare avec ton coach.</p>
            <Link href="/app/objectif/nouveau" className="inline-flex items-center min-h-11 px-4 rounded-full bg-white text-indigo text-[0.8125rem] font-bold">
              Proposer un objectif majeur
            </Link>
          </CarteSombre>
          <Link href={lien('/app/plan', ctx)} className="block bg-white rounded-2xl border border-indigo/[0.08] p-4 text-sm text-indigo">
            Ta dernière course : <strong>{plan.course.nom}</strong>, {dateLongue(plan.course.date)}
            <span className="block text-xs text-[#5E5C78] mt-0.5">Bravo pour le chemin ›</span>
          </Link>
          <CarteNouveauBadge badges={nouveaux} href={`${lien('/app/profil', ctx)}#badges`} />
          <CetteSemaine semaine={null} ligne={null} questionnaire={false} nolio={semaineEntreDeux} />
        </main>
      </>
    );
  }
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
        <div>
          <div className="text-xs font-semibold text-[#5E5C78] first-letter:uppercase">{dateLongue(jour)}</div>
          <h1 className="mt-1 text-[1.625rem] font-extrabold text-indigo tracking-tight">{nom ? `Bonjour ${nom}` : 'Bonjour'}</h1>
        </div>

        {/* Sa liste dit où en est l'invitation Nolio ; masquée, la carte Nolio le redit. */}
        {etape !== 'apres' && demarrage && d.nolio !== 'sorti' && d.nolio !== 'coaching' && (
          <PourBienDemarrer acheteur={!ctx.coache} nolio={d.nolio} accord={d.accord} questionnaire={d.ecrit && !ctx.aLaMain} installer={installer}
            profil={profil} lienProfil={lienProfil} seanceFaite={d.realises.some((r) => r.seances_faites > 0)} />
        )}
        <CarteObjectif plan={plan} restants={restants} jauge={ctx.aLaMain ? null : jauge} etape={etape} href={lien('/app/plan', ctx)}
          surtitre={!ctx.coache ? 'Ton objectif' : etape === 'apres' ? 'Ton dernier objectif majeur' : 'Ton prochain objectif majeur'}
          coache={Boolean(ctx.coache)} />
        {etape !== 'apres' && (!demarrage || d.nolio === 'sorti') && <CarteNolio etat={d.nolio} />}
        <CarteNouveauBadge badges={nouveaux} href={`${lien('/app/profil', ctx)}#badges`} />

        {etape !== 'apres' && restants <= 7 && (
          <Link href={lien('/app/plan/jour-j', ctx)} className="block bg-teal text-white rounded-2xl p-[18px]">
            <span className="block text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-white/70 mb-1">Semaine de course</span>
            <span className="font-bold text-lg">{plan.jour_j.titre} ›</span>
          </Link>
        )}

        {etape === 'apres' && !ctx.coache && <EtMaintenant ctx={ctx} />}
        {etape !== 'avant' && !ctx.aLaMain && <Piliers jauge={jauge} />}
        {etape !== 'apres' && <CoursesPreparation courses={d.courses.filter((c) => c.date >= jour)} ajout={ajout} />}
        {etape !== 'apres' && !ctx.aLaMain && (
          <CetteSemaine semaine={semaine} ligne={ligne} questionnaire={d.ecrit && restants > 7} nolio={nolio}
            arrivee={arrivee} depuis={arrivee ? jour : null} debut={debut} />
        )}
        {etape !== 'apres' && ctx.aLaMain && <CetteSemaine semaine={null} ligne={null} questionnaire={false} nolio={nolio} />}
        {etape !== 'apres' && <FichesDeLaSemaine fiches={fiches} ctx={ctx} />}
      </main>
    </>
  );
}

// Après sa course, un acheteur (décision coach du 20/10/2026, les nuances des plans, point 4) : d'abord récupérer, un
// jour sans séance dure par heure de course, deux au moins (la règle O3 du moteur), avec la fiche Récupération ;
// ensuite son prochain objectif majeur, par l'aiguillage.
function EtMaintenant({ ctx }: { ctx: Contexte }) {
  const heures = lireTemps(ctx.plan.course.temps_cible ?? '');
  const jours = Math.max(2, Math.ceil(heures ?? 2));
  return (
    <Carte className="space-y-3">
      <Surtitre>Et maintenant ?</Surtitre>
      <div className="space-y-1">
        <p className="text-[0.875rem] text-[#4A4866] leading-relaxed">
          D’abord, récupère : {jours} jours sans séance dure, un par heure de course, puis reprends en douceur.
        </p>
        <Link href={lien('/app/bibliotheque/recuperation', ctx)} className="inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal">
          Lire la fiche Récupération ›
        </Link>
      </div>
      <p className="text-[0.875rem] text-[#4A4866] leading-relaxed">
        Ton prochain objectif majeur ? Une nouvelle préparation, construite pour lui.
      </p>
      <Link href="/app/objectif/nouveau" className="flex items-center justify-center min-h-12 px-5 rounded-xl bg-teal text-white text-sm font-bold">
        Choisir mon prochain objectif
      </Link>
    </Carte>
  );
}

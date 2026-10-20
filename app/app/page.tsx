import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { CarteNouveauBadge } from '@/components/app/Badges';
import EnTeteApp from '@/components/app/EnTeteApp';
import {
  CarteNolio, CarteObjectif, CetteSemaine, CoursesPreparation, FicheDuMoment, Piliers,
} from '@/components/app/TableauDeBord';
import { nouveauxBadges } from '@/lib/app/badges';
import { mesBadges } from '@/lib/app/badgesNolio';
import { COOKIE_BIENVENUE } from '@/lib/app/bienvenue';
import { Carte, CarteSombre, Surtitre } from '@/components/app/Ui';
import { contexte, lien, objectifAVenir, prenom, type Recherche } from '@/lib/app/contexte';
import { ajouterJours, dateLongue, joursEntre, moment } from '@/lib/app/plan';
import { ficheDuMoment, jaugeDuPlan, momentDe } from '@/lib/app/tableau';
import { donneesTableau, semaineDansNolio, semaineEcrite } from '@/lib/app/tableauDuPlan';

// L'accueil (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, T1, AP1, AP2 ; maquette validée par le coach le
// 19/10/2026) : les séances vivent dans Nolio ; ici l'objectif et sa montagne, un badge tout neuf (BG3), les piliers,
// les courses de préparation, la semaine en cours, la fiche du moment ; pour un coaché entre deux objectifs, l'accueil
// d'entre-deux. Les données, le profil et la bibliothèque ont leur onglet.
export default async function Accueil({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams, { sansObjectif: true });
  // La première fois sur cet appareil : l'écran de bienvenue (cadrage, 2.6), lu avant d'entrer.
  if (!(await cookies()).get(COOKIE_BIENVENUE)) redirect(lien('/app/bienvenue', ctx));
  const { plan, jour } = ctx;
  const lundiCourant = ajouterJours(jour, -((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7));
  // Un coaché sans objectif (décision coach du 20/10/2026, « tableau de bord complet ») : sa semaine dans Nolio, un
  // badge tout neuf, de quoi proposer un objectif ; ses données, son profil et la bibliothèque ont leur onglet.
  if (ctx.sansObjectif) {
    const badges = await mesBadges(ctx);
    const nouveaux = badges.etat ? nouveauxBadges(badges.etat, jour) : [];
    const semaine = await semaineDansNolio(ctx, lundiCourant);
    const nom = prenom(plan.athlete.nom);
    const demande = (await searchParams).demande === 'envoyee';
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
          <CetteSemaine semaine={null} ligne={null} questionnaire={false} nolio={semaine} />
          <CarteNouveauBadge badges={nouveaux} href={`${lien('/app/profil', ctx)}#badges`} />
          <CarteSombre className="space-y-3">
            <Surtitre ton="clair" as="div">Ton prochain objectif</Surtitre>
            <p className="text-[0.9375rem] font-bold">Une course en vue ? Propose-la à ton coach.</p>
            <Link href="/app/objectif/nouveau" className="inline-flex items-center min-h-11 px-4 rounded-full bg-white text-indigo text-[0.8125rem] font-bold">
              Proposer un objectif
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
  const ligne = rang >= 0 ? d.trame[rang] : null;
  const semaine = ligne ? await semaineEcrite(ctx, ligne.numero) : null;
  // Ce qui est dans Nolio cette semaine, retouches du coach comprises (décision coach du 20/10/2026) ; programmé à la main,
  // la semaine en cours, sans la trame du moteur.
  const nolio = ctx.aLaMain ? await semaineDansNolio(ctx, lundiCourant) : ligne?.lundi ? await semaineDansNolio(ctx, ligne.lundi) : null;
  const jauge = jaugeDuPlan(d.trame, d.realises, jour);
  const fiche = ficheDuMoment(d.fiches, jour);
  const nom = prenom(plan.athlete.nom);
  // Un badge débloqué la semaine écoulée (BG3, décision coach du 20/10/2026).
  const badges = await mesBadges(ctx);
  const nouveaux = badges.etat ? nouveauxBadges(badges.etat, jour) : [];
  // Une course de préparation s'ajoute dans l'objectif, tant que la course est à venir et le plan écrit semaine par
  // semaine.
  const ajout = d.ecrit && !ctx.demonstration && plan.course.date >= jour ? `${lien('/app/plan', ctx)}#ajouter-course` : null;
  // L'entre-deux d'un coaché (décision coach du 20/10/2026) : sa dernière course passée, aucun objectif à venir. Son
  // prochain se prépare avec son coach ; sa semaine se lit dans Nolio (les séances que son coach lui pose à la main).
  const entreDeux = ctx.coache && etape === 'apres' && (ctx.demonstration || !(await objectifAVenir()));
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
          <CarteSombre className="space-y-3">
            <Surtitre ton="clair" as="div">Ton prochain objectif</Surtitre>
            <p className="text-[0.9375rem] font-bold">Il se prépare avec ton coach.</p>
            <Link href="/app/objectif/nouveau" className="inline-flex items-center min-h-11 px-4 rounded-full bg-white text-indigo text-[0.8125rem] font-bold">
              Proposer un objectif
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

        <CarteObjectif plan={plan} restants={restants} jauge={ctx.aLaMain ? null : jauge} etape={etape} href={lien('/app/plan', ctx)}
          surtitre={!ctx.coache ? 'Ton objectif' : etape === 'apres' ? 'Ton dernier objectif majeur' : 'Ton prochain objectif majeur'} />
        {etape !== 'apres' && <CarteNolio etat={d.nolio} />}
        <CarteNouveauBadge badges={nouveaux} href={`${lien('/app/profil', ctx)}#badges`} />

        {etape !== 'apres' && restants <= 7 && (
          <Link href={lien('/app/plan/jour-j', ctx)} className="block bg-teal text-white rounded-2xl p-[18px]">
            <span className="block text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-white/70 mb-1">Semaine de course</span>
            <span className="font-bold text-lg">{plan.jour_j.titre} ›</span>
          </Link>
        )}

        {etape !== 'avant' && !ctx.aLaMain && <Piliers jauge={jauge} />}
        {etape !== 'apres' && <CoursesPreparation courses={d.courses.filter((c) => c.date >= jour)} ajout={ajout} />}
        {etape === 'pendant' && !ctx.aLaMain && <CetteSemaine semaine={semaine} ligne={ligne} questionnaire={d.ecrit && restants > 7} nolio={nolio} />}
        {etape !== 'apres' && ctx.aLaMain && <CetteSemaine semaine={null} ligne={null} questionnaire={false} nolio={nolio} />}
        {fiche && etape !== 'apres' && <FicheDuMoment fiche={fiche.fiche} avenir={fiche.avenir} ctx={ctx} />}
      </main>
    </>
  );
}

import Link from 'next/link';
import { CarteNouveauBadge } from './Badges';
import ConfirmationCharge from './ConfirmationCharge';
import EnTeteApp from './EnTeteApp';
import PourBienDemarrer from './PourBienDemarrer';
import {
  CarteNolio, CarteObjectif, CarteTestVitesseCritique, CetteSemaine, CoursesPreparation, FichesDeLaSemaine, Piliers,
  type TestDeLaSemaine,
} from './TableauDeBord';
import { BOUTON, BOUTON_SECONDAIRE, Carte, CarteSombre, LIEN, Surtitre } from './Ui';
import { CarteSaison } from './SaisonDeFond';
import { annulerDemande } from '@/lib/app/actionsObjectifs';
import { nouveauxBadges } from '@/lib/app/badges';
import { carteDeConfirmation, confirmationAVenir, type CarteConfirmation } from '@/lib/app/confirmation';
import { maFiche } from '@/lib/app/coaching';
import { demandesDeLAthlete, estRetrait } from '@/lib/app/demandes';
import { carteOuverte, chargeDe, confirmationDemandee, invitationAVenir } from '@/lib/app/invitation';
import { mesBadges } from '@/lib/app/badgesNolio';
import { monProfilDEntrainement } from '@/lib/app/profilEntrainement';
import { lien, prenom, recuperationDuCoache, type Contexte } from '@/lib/app/contexte';
import { prixLePlusBas } from '@/lib/app/prix';
import { joursRecuperation, lireTemps } from '@/lib/plan';
import { ajouterJours, dateLongue, joursEntre, moment, type CleTest } from '@/lib/app/plan';
import { blocsDuPlan, fichesDeLaSemaine, jaugeDuPlan, momentDe } from '@/lib/app/tableau';
import {
  donneesTableau, lireSemaineNolio, semaineEcrite, testDeLaSemaine, testVcNonRepropose,
} from '@/lib/app/tableauDuPlan';

// L'accueil de l'athlète (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, T1, AP1, AP2 ; maquette validée par le coach le
// 19/10/2026) : les séances vivent dans Nolio ; ici l'objectif et sa montagne, un badge tout neuf (BG3), les piliers,
// les courses de préparation, la semaine en cours, la fiche du moment ; pour un coaché entre deux objectifs, l'accueil
// d'entre-deux. Celui de l'athlète connecté (app/app/page.tsx).
// demarrage : « Pour bien démarrer » (décision coach du 21/10/2026), tant qu'elle n'est pas masquée pour ce plan ; montre :
// l'acheteur y a coché l'appli Nolio et sa montre, d'un appui (décision coach du 07/11/2026) ;
// demande : sa demande d'objectif vient de partir ; aVenir : un objectif à venir sur son compte, demandé seulement après
// sa dernière course.
// Par exception (audits du 05/11/2026, Q6 et suivantes) : ce qui sort de l'ordinaire a sa ligne (la semaine ajustée, la
// semaine d'un test, le jour J), ce qui est vide ne s'affiche pas.
export default async function AccueilAthlete({ ctx, demarrage, montre = false, demande = false, aVenir }: {
  ctx: Contexte; demarrage: boolean; montre?: boolean; demande?: boolean; aVenir: () => Promise<boolean>;
}) {
  const { plan, jour } = ctx;
  const installer = `${lien('/app/compte', ctx)}#installer`;
  // Le profil de coureur d'un coaché, rempli d'abord (décision coach du 23/10/2026) : une étape de « Pour bien démarrer ».
  // En démonstration, ?profil=vide : pas encore rempli.
  const profil = ctx.demo ? !ctx.coache || !ctx.demo.profilVide : !ctx.coache || !demarrage
    || Object.keys((await monProfilDEntrainement().catch(() => null)) ?? { inconnu: true }).length > 0;
  const lienProfil = `${lien('/app/profil', ctx)}#profil-entrainement`;
  const lundiCourant = ajouterJours(jour, -((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7));
  const nom = prenom(plan.athlete.nom);
  const bonjour = (
    <div>
      <div className="text-xs font-semibold text-[#5E5C78] first-letter:uppercase">{dateLongue(jour)}</div>
      <h1 className="mt-1 text-[1.625rem] font-extrabold text-indigo tracking-tight">{nom ? `Bonjour ${nom}` : 'Bonjour'}</h1>
    </div>
  );
  // Un coaché sans objectif (décision coach du 20/10/2026, « tableau de bord complet ») : sa semaine dans Nolio, un
  // badge tout neuf, de quoi proposer un objectif ; ses données, son profil et la bibliothèque ont leur onglet.
  if (ctx.sansObjectif) {
    const badges = await mesBadges(ctx);
    const nouveaux = badges.etat ? nouveauxBadges(badges.etat, jour) : [];
    const lecture = await lireSemaineNolio(ctx, lundiCourant);
    const recup = await recuperationDuCoache(ctx).catch(() => null);
    const attente = await demandeEnAttente(ctx, demande);
    return (
      <>
        <EnTeteApp ctx={ctx} />
        <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
          {bonjour}
          {/* Q17 (décision coach du 05/11/2026 au soir, « A ») : une seule carte « Ton prochain objectif », toujours en
              tête ; sa demande partie, elle le dit, avec « Annuler ». */}
          {recup ? <ApresTaCourse nom={recup.course} recup={recup} ctx={ctx}>
            <ProchainObjectif ctx={ctx} attente={attente} />
          </ApresTaCourse> : <CarteProchainObjectif ctx={ctx} attente={attente} />}
          {demarrage && <PourBienDemarrer acheteur={false} nolio="coache" accord={Boolean(ctx.fiche?.accord)} questionnaire={false} installer={installer} profil={profil} lienProfil={lienProfil}
            demonstration={ctx.demonstration} adapte={!ctx.aLaMain} planId="sans-objectif" />}
          {/* B-AT-2 : la carte reste, avec sa raison (ses séances seulement, décision coach du 12/11/2026). */}
          <CetteSemaine semaine={null} ligne={null} nolio={lecture.seances} raison={lecture.raison} coache
            lundi={lundiCourant} jour={jour} />
          <CarteNouveauBadge badges={nouveaux} href={`${lien('/app/profil', ctx)}#badges`} />
        </main>
      </>
    );
  }
  // En parallèle (§8, point 13, audit du 03/11/2026).
  const [d, badges, recup] = await Promise.all([donneesTableau(ctx), mesBadges(ctx), recuperationDuCoache(ctx).catch(() => null)]);
  const etape = moment(plan, jour);
  const restants = joursEntre(jour, plan.course.date);
  const fiche = lien('/app/plan/course', ctx);
  // C19 (audits du 05/11/2026) : une préparation arrêtée (remboursée) réduit l'accueil à la carte d'arrêt, en tête, à la
  // fiche de course et à la bibliothèque : plus de montagne, de « Ta semaine », de questionnaire ni d'ajout de course (le
  // serveur refuse aussi l'ajout, lib/app/actionsEcriture.ts).
  if (d.nolio === 'arrete') {
    return (
      <>
        <EnTeteApp ctx={ctx} />
        <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
          {bonjour}
          <CarteNolio etat="arrete" />
          <nav aria-label="Ce qui reste à toi" className="bg-white rounded-2xl border border-indigo/[0.08] px-[18px]">
            {[[fiche, `Ta fiche de course, ${plan.course.nom}`], [lien('/app/bibliotheque', ctx), 'La bibliothèque']].map(([href, titre]) => (
              <Link key={href} href={href} className="flex items-center justify-between min-h-[52px] border-b last:border-b-0 border-indigo/[0.06] text-sm font-semibold text-indigo">
                <span>{titre}</span><span aria-hidden className="text-[#5E5C78]">›</span>
              </Link>
            ))}
          </nav>
        </main>
      </>
    );
  }
  const rang = d.trame.findIndex((l) => l.lundi && momentDe(l.lundi, jour) === 'encours');
  // Toujours la semaine en cours, rien d'autre (décision coach du 24/10/2026 ; avant : la première semaine de la
  // préparation, avant son début) : avant le départ, ce qui est dans Nolio cette semaine.
  const ligne = rang >= 0 ? d.trame[rang] : null;
  const semaine = ligne ? await semaineEcrite(ctx, ligne.numero) : null;
  // C32 (audits du 05/11/2026) : pendant sa récupération, « Ta semaine » reste pour l'acheteur ; ses séances de
  // récupération sont dans Nolio.
  const recupAcheteur = !ctx.coache && etape === 'apres' ? recuperationApres(ctx) : null;
  // Ce qui est dans Nolio cette semaine, retouches du coach comprises (décision coach du 20/10/2026), une fois la semaine
  // partie dans Nolio ; programmé à la main, la semaine en cours, sans la trame du moteur.
  const lecture = ctx.aLaMain || (!ligne && (etape === 'avant' || recupAcheteur)) ? await lireSemaineNolio(ctx, lundiCourant)
    : ligne?.lundi ? await lireSemaineNolio(ctx, ligne.lundi, ligne.numero) : null;
  const nolio = lecture?.seances ?? null;
  // Pas encore dans Nolio : la semaine de la préparation, et quand elle y arrive (décision coach du 20/10/2026). Sans
  // accord ou Nolio muet, plus de « bientôt » (AT1, B-AT-1) : la carte le dit autrement.
  const raison = lecture && (lecture.raison === 'sans_accord' || lecture.raison === 'muet') ? lecture.raison : null;
  const arrivee = nolio || raison || lecture?.raison === 'demo' || !ligne ? null : !ctx.coache && d.nolio !== 'actif' ? 'invitation' as const : 'bientot' as const;
  // La montée (lot 2, 12/11/2026) part du début de son objectif en cours pour un coaché ; pour un acheteur, de la semaine
  // qu'il a rejointe, sinon de toute sa trame.
  const depuis = ctx.coache ? d.debut ?? null : plan.course.rejoint?.lundi ?? null;
  const jauge = jaugeDuPlan(d.trame, d.realises, jour, depuis);
  // Le bloc en cours, sous le chiffre de la montée (13/11/2026) : celui de « Ta préparation, bloc par bloc ».
  const bloc = blocsDuPlan(d.trame, plan, jour, depuis).find((b) => b.moment === 'encours')?.nom ?? null;
  const fiches = fichesDeLaSemaine(d.fiches, jour);
  // Q14 : le test que la préparation écrit cette semaine. (Q7, la semaine ajustée, n'est plus lue : décision 20 du coach
  // du 10/11/2026, l'app ne dit plus « Ajustée d'après ta semaine passée… ».)
  const cleTest = ligne && !ctx.aLaMain && plan.zones ? testDeLaSemaine(semaine) : null;
  const test: TestDeLaSemaine | null = cleTest ? {
    titre: TITRE_DU_TEST[cleTest],
    comment: `${lien('/app/plan/zones', ctx, { protocole: cleTest })}#${cleTest}`,
    saisie: !ctx.coache && !d.accord ? `${lien('/app/plan/zones', ctx)}#${cleTest}` : null,
  } : null;
  // D5 (moteur 8.452) : le test de vitesse critique plus proposé, tant qu'aucune vitesse critique n'est connue ; pas la
  // semaine où la préparation l'écrit (les deux se contrediraient).
  const vcNonRepropose = etape !== 'apres' && cleTest !== 'vitesse_critique' && await testVcNonRepropose(ctx).catch(() => false);
  // Un badge débloqué la semaine écoulée (BG3, décision coach du 20/10/2026).
  const nouveaux = badges.etat ? nouveauxBadges(badges.etat, jour) : [];
  // Une course de préparation s'ajoute dans l'objectif, tant que la course est à venir et le plan écrit semaine par
  // semaine.
  const ajout = d.ecrit && plan.course.date >= jour ? `${lien('/app/plan', ctx)}#ajouter-course` : null;
  // L'invitation d'un acheteur dans Nolio, le lundi de la semaine qui précède son départ (décision coach du 04/11/2026 au
  // soir, lib/app/invitation.ts) ; confirmer : ce jour-là, son app lui demandera si sa charge a changé (un achat fait
  // plus de 3 semaines avant). La carte de cette confirmation, de l'invitation à la veille du départ.
  const inviteLe = ctx.coache ? null : invitationAVenir(plan.course.date_debut_plan, jour);
  const confirmer = Boolean(inviteLe && (ctx.demo ? confirmationDemandee(plan.course.date_debut_plan, ctx.demo.achat)
    : await confirmationAVenir(ctx.cle).catch(() => false)));
  const confirmation = ctx.coache || etape !== 'avant' ? null : ctx.demonstration ? confirmationDeDemonstration(ctx)
    : await carteDeConfirmation(ctx.cle, jour).catch(() => null);
  const accord = `${lien('/app/compte', ctx)}#accord`;
  const jourJ = `${fiche}#jour-j`;
  // L'entre-deux d'un coaché (décision coach du 20/10/2026) : sa dernière course passée, aucun objectif à venir. Son
  // prochain se prépare avec son coach ; sa semaine se lit dans Nolio (les séances que son coach lui pose à la main).
  const entreDeux = ctx.coache && etape === 'apres' && (ctx.demonstration || !(await aVenir()));
  if (entreDeux) {
    const lectureEntreDeux = await lireSemaineNolio(ctx, lundiCourant);
    const attente = await demandeEnAttente(ctx, demande);
    return (
      <>
        <EnTeteApp ctx={ctx} />
        <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
          {bonjour}
          {/* Q12 : la carte « Après ta course », pendant sa récupération ; Q17 : sinon « Ton prochain objectif », en tête. */}
          {recup ? <ApresTaCourse nom={recup.course} recup={recup} ctx={ctx}>
            <ProchainObjectif ctx={ctx} attente={attente} />
          </ApresTaCourse> : <CarteProchainObjectif ctx={ctx} attente={attente} />}
          {demarrage && <PourBienDemarrer acheteur={false} nolio="coache" accord={d.accord} questionnaire={false} installer={installer} profil={profil} lienProfil={lienProfil}
            demonstration={ctx.demonstration} adapte={!ctx.aLaMain} planId={ctx.cle} />}
          <CetteSemaine semaine={null} ligne={null} nolio={lectureEntreDeux.seances} raison={lectureEntreDeux.raison}
            coache lundi={lundiCourant} jour={jour} />
          {/* Q3 : « Voir ma préparation », un seul nom (avant : « Revoir ta préparation »). */}
          <Link href={lien('/app/plan', ctx)} className="block bg-white rounded-2xl border border-indigo/[0.08] p-4 text-sm text-indigo">
            Ta dernière course : <strong>{plan.course.nom}</strong>, {dateLongue(plan.course.date, true)}
            <span className="block text-xs font-bold text-teal mt-1">Voir ma préparation ›</span>
          </Link>
          <CarteNouveauBadge badges={nouveaux} href={`${lien('/app/profil', ctx)}#badges`} />
        </main>
      </>
    );
  }
  const prix = recupAcheteur !== null || (!ctx.coache && etape === 'apres') ? await prixLePlusBas() : null;
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
        {bonjour}

        {confirmation && (
          <ConfirmationCharge planId={confirmation.planId} achat={confirmation.achat} reponse={confirmation.reponse}
            dimanche={dateLongue(confirmation.dimanche)} demonstration={ctx.demonstration} />
        )}
        {/* Sa liste dit où en est l'invitation Nolio ; masquée, la carte Nolio le redit. */}
        {etape !== 'apres' && demarrage && d.nolio !== 'sorti' && d.nolio !== 'coaching' && (
          <PourBienDemarrer acheteur={!ctx.coache} nolio={d.nolio} accord={d.accord} questionnaire={d.ecrit && !ctx.aLaMain} installer={installer}
            profil={profil} lienProfil={lienProfil} seanceFaite={d.realises.some((r) => r.seances_faites > 0)} montre={montre}
            inviteLe={inviteLe ? dateLongue(inviteLe) : null} confirmer={confirmer} demonstration={ctx.demonstration} adapte={!ctx.aLaMain} planId={ctx.cle} />
        )}
        {/* AT4 : la récupération du coaché, même quand son objectif suivant est déjà là (Q12 : la même carte que l'acheteur). */}
        {recup && (
          <ApresTaCourse nom={recup.course} recup={recup} ctx={ctx}>
            {plan.course.date > recup.date && !plan.fond
              ? <p className="text-[0.875rem] font-semibold text-indigo">Ton prochain objectif démarre le {dateLongue(lundiApres(recup.jusqua))}.</p>
              : <ProchainObjectif ctx={ctx} attente={await demandeEnAttente(ctx, demande)} />}
          </ApresTaCourse>
        )}
        {/* AT2 (décision coach du 04/11/2026) : l'objectif, puis « Ta semaine », puis le reste. */}
        {/* La saison de fond (décisions coach du 24/10/2026) : le bloc et le compte à rebours des tests. */}
        {plan.fond ? <CarteSaison plan={plan} ligne={ligne} jour={jour} href={lien('/app/plan', ctx)}
          reprise={Boolean(semaine?.reprise_apres_course && semaine.numero === ligne?.numero)} /> : (
          <CarteObjectif plan={plan} restants={restants} jauge={ctx.aLaMain ? null : jauge} etape={etape} href={lien('/app/plan', ctx)}
            surtitre={etape === 'apres' ? 'Ta dernière course' : 'Ton objectif majeur'} jourJ={jourJ}
            // « Ajouter une course › » (décision coach du 07/11/2026), coaché ou acheteur, tant que l'objectif est à venir (pas
            // le jour J).
            ajouter={plan.course.date > jour ? lien('/app/objectif/nouveau', ctx) : null}
            // Q16 (décision coach du 05/11/2026 au soir, « A ») : programmé à la main, le bouton ouvre sa fiche de course.
            // Validé par le coach le 05/11/2026 (1A ; « Ta fiche de course »).
            bouton={ctx.aLaMain ? { texte: 'Ta fiche de course', href: fiche } : null}
            coache={Boolean(ctx.coache)} jour={jour} debut={depuis ?? d.trame.find((l) => l.lundi)?.lundi ?? null} bloc={bloc} />
        )}
        {/* Q12 (décision coach du 05/11/2026 au soir, « A ») : après sa course, la carte « Après ta course », la même que
            celle du coaché ; C20 : la carte « terminée dans Nolio » y trouve enfin sa place. */}
        {etape === 'apres' && !ctx.coache && (
          <ApresTaCourse nom={plan.course.nom} recup={recupAcheteur} ctx={ctx}>
            {d.nolio === 'sorti' && (
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-indigo">Ta préparation est terminée dans Nolio</p>
                <p className="text-[0.875rem] text-[#4A4866] leading-relaxed">Ton compte Nolio et tes séances restent à toi.</p>
              </div>
            )}
            <div className="space-y-1.5 pt-1">
              <p className="text-[0.875rem] text-[#4A4866] leading-relaxed">Ton prochain objectif majeur ? Une nouvelle préparation, construite pour lui.</p>
              {/* Q3 et Q12 : « Préparer une nouvelle course », son prix dessous. Validé par le coach le 05/11/2026 (1A). */}
              <Link href={lien('/app/objectif/nouveau', ctx)} className={`${BOUTON} w-full`}>Préparer une nouvelle course</Link>
              {prix !== null && <p className="text-xs text-center text-[#5E5C78]">Dès {prix} €, selon la durée de ta préparation.</p>}
            </div>
          </ApresTaCourse>
        )}
        {/* Un plan acheté pendant un coaching (décision coach du 05/11/2026 au soir, « 3 A ») : la semaine du plan, sans
            rien de Nolio, où ce plan ne s'écrit pas. */}
        {(etape !== 'apres' || recupAcheteur) && !ctx.aLaMain && (d.nolio === 'coaching' ? (
          <CetteSemaine semaine={semaine} ligne={ligne} lundi={ligne?.lundi ?? lundiCourant} horsNolio jour={jour}
            course={plan.course.date} />
        ) : (
          <CetteSemaine semaine={semaine} ligne={ligne} nolio={nolio}
            arrivee={arrivee} depuis={arrivee ? jour : null} raison={raison} coache={Boolean(ctx.coache)}
            lundi={ligne?.lundi ?? lundiCourant} jour={jour} course={plan.course.date} test={test}
            accord={accord} />
        ))}
        {etape !== 'apres' && ctx.aLaMain && (
          <CetteSemaine semaine={null} ligne={null} nolio={nolio} raison={lecture?.raison ?? null} coache
            lundi={lundiCourant} jour={jour} course={plan.course.date} />
        )}
        {/* Un plan acheté pendant un coaching (« coaching ») : « Pour bien démarrer » ne s'affiche pas pour lui, la carte Nolio
            le dit donc tout de suite, comme une sortie ou un arrêt (avant le 05/11/2026 au soir, son accueil restait sans
            elle tant que la liste n'était pas masquée). */}
        {etape !== 'apres' && (!demarrage || d.nolio === 'sorti' || d.nolio === 'coaching') && <CarteNolio etat={d.nolio} inviteLe={inviteLe} confirmer={confirmer} avantCourse={plan.course.date >= jour} />}
        {vcNonRepropose && <CarteTestVitesseCritique saisie={plan.zones ? `${lien('/app/plan/zones', ctx)}#vitesse_critique` : null} />}

        {/* Q10 (décision coach du 05/11/2026 au soir, « A ») : la carte ouvre la fiche de course à « Ton jour J » ; la page
            qui la redisait est retirée. */}
        {etape !== 'apres' && restants <= 7 && !plan.fond && (
          <Link href={jourJ} className="block bg-teal text-white rounded-2xl p-[18px]">
            <span className="block text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-white/80 mb-1">Semaine de course</span>
            <span className="font-bold text-lg">{plan.jour_j.titre} ›</span>
          </Link>
        )}

        {etape !== 'avant' && !ctx.aLaMain && <Piliers jauge={jauge} />}
        <CarteNouveauBadge badges={nouveaux} href={`${lien('/app/profil', ctx)}#badges`} />
        {etape !== 'apres' && !plan.fond && <CoursesPreparation courses={d.courses.filter((c) => c.date >= jour)} ajout={ajout} />}
        {etape !== 'apres' && <FichesDeLaSemaine fiches={fiches} ctx={ctx} />}
      </main>
    </>
  );
}

// Le nom du test qui part cette semaine (Q14). Validé par le coach le 05/11/2026 (1A).
const TITRE_DU_TEST: Record<CleTest, string> = {
  parole: 'ton test de la parole', vitesse_critique: 'ton test de vitesse critique', fc_seuil2: 'la mesure de ta FC au seuil 2',
};

// La carte de confirmation en démonstration (développement, sans Supabase) : l'achat simulé (?achat=, par défaut deux mois
// avant le départ) et des réponses d'exemple ; elle s'affiche de l'invitation à la veille du départ (?jour=), et
// ?confirmation=oui la montre déjà répondue (« C'est noté »).
function confirmationDeDemonstration(ctx: Contexte): CarteConfirmation | null {
  const debut = ctx.plan.course.date_debut_plan;
  if (!debut || !ctx.demo || !carteOuverte(debut, ctx.demo.achat, ctx.jour)) return null;
  const achat = chargeDe({ volume_hebdo_actuel: '5h', sortie_longue_actuelle: '2h' });
  return { planId: ctx.cle, dimanche: ajouterJours(debut, -1), achat,
    reponse: ctx.demo.confirmation ? { le: `${ctx.jour}T08:00:00Z`, reponse: 'oui', charge: achat } : null };
}

// Le lundi qui suit une date : celui où démarre l'objectif suivant, après la récupération.
const lundiApres = (jour: string) => ajouterJours(jour, 7 - ((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7));

// La récupération d'un acheteur après sa course (décision coach du 20/10/2026, les nuances des plans, point 4 ;
// lib/plan.ts, joursRecuperation : deux jours par heure de course, 3 à 21, 14 après un marathon sur route), seulement
// pendant ses jours (B-PL-44) ; elle est écrite dans Nolio pour l'acheteur aussi depuis le 04/11/2026 (PL5).
function recuperationApres(ctx: Contexte): { jours: number; jusqua: string } | null {
  const jours = joursRecuperation(lireTemps(ctx.plan.course.temps_cible ?? '') ?? 2, ctx.plan.course.format);
  return joursEntre(ctx.plan.course.date, ctx.jour) <= jours ? { jours, jusqua: ajouterJours(ctx.plan.course.date, jours) } : null;
}

// APRÈS TA COURSE (Q12, décision coach du 05/11/2026 au soir, « A ») : une seule carte pour les deux versions (avant :
// « Et maintenant ? » chez l'acheteur, sans date de fin ; « Après OCC » chez le coaché, sans bravo) : le bravo, la
// récupération jusqu'à sa date de fin et sa fiche, puis l'objectif suivant (children).
function ApresTaCourse({ nom, recup, ctx, children }: {
  nom: string; recup: { jours: number; jusqua: string } | null; ctx: Contexte; children: React.ReactNode;
}) {
  return (
    <Carte className="space-y-3">
      <Surtitre>Après ta course</Surtitre>
      {/* Validé par le coach le 05/11/2026 (1A). */}
      <p className="text-[0.9375rem] font-bold text-indigo">{nom} est derrière toi : bravo pour le chemin.</p>
      {recup && (
        <div className="space-y-1">
          <p className="text-[0.875rem] text-[#4A4866] leading-relaxed">
            D’abord, récupère : {recup.jours} jours sans séance dure, jusqu’au {dateLongue(recup.jusqua)}, puis reprends en
            douceur. Tes séances de récupération sont dans ton appli Nolio.
          </p>
          <Link href={lien('/app/bibliotheque/recuperation', ctx)} className={LIEN}>Lire la fiche Récupération ›</Link>
        </div>
      )}
      {children}
    </Carte>
  );
}

// LE PROCHAIN OBJECTIF D'UN COACHÉ (Q17, décision coach du 05/11/2026 au soir, « A ») : une seule carte, toujours en
// tête (sans objectif comme entre deux objectifs ; avant, « Il se prépare avec ton coach » ici, « Propose-le » là, en tête
// ou en bas). Sa demande partie, la carte le dit, avec « Annuler », et ne propose plus d'en envoyer une autre.
type Attente = { id: string; course: string } | null;
async function demandeEnAttente(ctx: Contexte, vientDePartir: boolean): Promise<Attente> {
  if (ctx.demonstration) {
    return ctx.demo?.objectifDemande || vientDePartir ? { id: 'demo-demande', course: 'Trail Alsace 47k' } : null;
  }
  const fiche = ctx.fiche ?? await maFiche().catch(() => null);
  if (!fiche) return null;
  const demandes = (await demandesDeLAthlete(fiche.id).catch(() => [])).filter((dm) => !estRetrait(dm));
  const d = demandes.sort((a, b) => b.cree_le.localeCompare(a.cree_le))[0];
  return d ? { id: d.id, course: String(d.champs.course_nom ?? '') || 'ton prochain objectif' } : null;
}

function CarteProchainObjectif({ ctx, attente }: { ctx: Contexte; attente: Attente }) {
  return (
    <CarteSombre className="space-y-3">
      <Surtitre ton="clair" as="div">Ton prochain objectif</Surtitre>
      <ProchainObjectif ctx={ctx} attente={attente} sombre />
    </CarteSombre>
  );
}

// Validé par le coach le 05/11/2026 (1A ; « Ta demande pour … est chez ton coach. »).
function ProchainObjectif({ ctx, attente, sombre = false }: { ctx: Contexte; attente: Attente; sombre?: boolean }) {
  if (attente) {
    // En démonstration, « Annuler » revient à l'état sans demande ; rien ne s'enregistre.
    const sansDemande = lien('/app', ctx).replace(/([?&])objectif=demande(&|$)/, (_, a, b) => (b ? a : '')).replace(/[?&]$/, '');
    return (
      <div className="space-y-2.5">
        <p className={sombre ? 'text-[0.9375rem] font-bold' : 'text-[0.875rem] font-semibold text-indigo'}>
          Ta demande pour {attente.course} est chez ton coach.
        </p>
        {ctx.demonstration ? (
          <Link href={sansDemande} className={sombre ? 'inline-flex items-center justify-center min-h-11 px-4 rounded-xl border border-white/40 text-white text-sm font-bold' : BOUTON_SECONDAIRE}>Annuler</Link>
        ) : (
          <form action={annulerDemande.bind(null, attente.id)}>
            <button type="submit" className={sombre ? 'inline-flex items-center justify-center min-h-11 px-4 rounded-xl border border-white/40 text-white text-sm font-bold' : BOUTON_SECONDAIRE}>Annuler</button>
          </form>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      <p className={sombre ? 'text-[0.9375rem] font-bold' : 'text-[0.875rem] font-semibold text-indigo'}>Un objectif en vue ? Propose-le à ton coach.</p>
      <Link href={lien('/app/objectif/nouveau', ctx)} className={BOUTON}>Proposer un objectif</Link>
    </div>
  );
}

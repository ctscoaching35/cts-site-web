import type { Metadata } from 'next';
import Link from 'next/link';
import clsx from 'clsx';
import { TesBadges } from '@/components/app/Badges';
import ProfilAthlete from '@/components/app/ProfilAthlete';
import EnTeteApp from '@/components/app/EnTeteApp';
import { Carte, Surtitre, TITRE } from '@/components/app/Ui';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';
import { type CleTest } from '@/lib/app/plan';
import { allure, profilCoureur, testsProposes } from '@/lib/app/zones';
import { StyleCoureur, TableauZones } from '@/components/app/ZonesEtStyle';
import { mesBadges } from '@/lib/app/badgesNolio';
import { lignesDeLaCarte, lignesDuNiveau, lignesDuProfil, monProfilDEntrainement, niveauHabituelDuPlan, profilDuPlanAchete,
  profilPourLeQuestionnaire } from '@/lib/app/profilEntrainement';
import { niveauHabituelDeDemonstration, profilDEntrainementDeDemonstration } from '@/lib/app/demonstration';
import { donneesTableau } from '@/lib/app/tableauDuPlan';

export const metadata: Metadata = { title: 'Ton profil de coureur' };

// Mon profil de coureur (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, AP1, AP4 ; maquette validée par le coach le
// 19/10/2026) : ses trois repères, son style de coureur (la règle du calculateur « Ton profil de traileur », tirée du test
// de vitesse critique, et ce que sa préparation en fait), ses badges (BG1 à BG3), ses zones, ses tests. Un coaché lit les
// repères que son coach pose sur sa fiche (T8) ; un acheteur saisit les siens dans « Tes tests ».
// Revu après les audits du 05/11/2026 : Q3 (« Ton style de coureur », « Tes tests »), Q6-e et Q6-f (sans repère, sans
// accord : une phrase à la place de ce qui ne dit rien), C34, C36, C38, C39, C47.

const FICHES_TESTS: [string, string, string][] = [
  ['parole', 'Le test de la parole', 'test-parole'],
  ['vitesse_critique', 'La vitesse critique', 'vitesse-critique'],
  ['fc_seuil2', 'Ta FC au seuil 2', 'frequence-cardiaque'],
];

export default async function MonProfil({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams, { sansObjectif: true });
  const { plan, profil } = ctx;
  const d = await donneesTableau(ctx);
  const badges = await mesBadges(ctx);
  // Un coaché voit et modifie son profil d'entraînement (décision coach du 20/10/2026).
  // En démonstration, celui du plan affiché (avant : 5 séances sur un plan qui en a 7) ; ?profil=vide, pas encore rempli.
  const entrainement = !ctx.coache ? null : ctx.demonstration ? await profilDEntrainementDeDemonstration(ctx)
    : await monProfilDEntrainement().catch(() => null);
  // Ta carte de coureur : un coaché, son profil d'entraînement ; un acheteur, les réponses du questionnaire de son plan.
  // Ce qui se mesure : son volume habituel et sa plus longue sortie récente, du niveau habituel lu dans Nolio par le moteur
  // à la dernière semaine écrite (réponse du coach du 12/11/2026, une lecture de plus), puis son point fort, du test de
  // vitesse critique ; une donnée absente n'a pas de ligne.
  const rempli = ctx.coache ? entrainement
    : ctx.demonstration ? profilPourLeQuestionnaire(await profilDEntrainementDeDemonstration(ctx))
    : ctx.cle ? await profilDuPlanAchete(ctx.cle).catch(() => null) : null;
  const carte = lignesDeLaCarte(rempli);
  const mesures = [...lignesDuNiveau(ctx.demonstration ? await niveauHabituelDeDemonstration(ctx)
    : ctx.cle ? await niveauHabituelDuPlan(ctx.cle).catch(() => null) : null)];
  const coureur = profilCoureur(profil);
  const pointFort = coureur ? `${coureur.coefficient < 0.9 ? 'La vitesse' : 'L’endurance'} · ${coureur.nom.toLowerCase()}, d’après ton test`
    : null;
  if (pointFort) mesures.push(['Ton point fort', pointFort]);
  const zones = plan.zones;
  const lignes = plan.mode_emploi.effort.zones.slice(1);
  // Ses repères se saisissent dans « Tes tests » ; ceux d'un coaché vont sur sa fiche (décision coach du 20/10/2026).
  const saisie = zones ? lien('/app/plan/zones', ctx) : null;
  // [titre, valeur, unité, le test qui le donne, son ancre dans « Tes tests »] ; C36 : une tuile « à tester » ouvre son test.
  const reperes: [string, string | null, string, string, CleTest][] = [
    ['Seuil 1', profil.fc_seuil1 !== null ? String(profil.fc_seuil1) : null, 'bpm', 'Le test de la parole', 'parole'],
    ['Vitesse critique', profil.vc_ms !== null ? allure(profil.vc_ms) : null, 'min/km', 'Ton seuil 2 en allure', 'vitesse_critique'],
    ['Seuil 2', profil.fc_seuil2 !== null ? String(profil.fc_seuil2) : null, 'bpm', 'Mesurée en séance', 'fc_seuil2'],
  ];
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
        <h1 className={TITRE}>Ton profil de coureur</h1>

        {/* Ta carte de coureur (lot 2, décision A du coach du 12/11/2026) : en tête, la même pour un acheteur et un coaché ;
            ce qu'il a rempli (« Modifier › » ouvre le formulaire de « Ton profil d'entraînement », plus bas, qu'un coaché
            seul a), puis ce qui se mesure, en lecture seule, s'il existe : son volume habituel et sa plus longue sortie récente
            (le niveau habituel lu dans Nolio), son point fort (le test de vitesse critique). Les cartes détaillées restent
            dessous. */}
        {(carte.length > 0 || mesures.length > 0) && (
          <Carte className="space-y-1">
            <Surtitre>Ta carte de coureur</Surtitre>
            {carte.length > 0 && (
              <dl className="pt-1">
                {carte.map(([cle, valeur]) => (
                  <div key={cle} className="grid grid-cols-[112px_1fr] gap-x-3 py-2.5 border-b last:border-b-0 border-indigo/[0.06] text-[0.84rem] text-indigo">
                    <dt className="font-semibold text-[#5E5C78]">{cle}</dt><dd>{valeur}</dd>
                  </div>
                ))}
              </dl>
            )}
            {entrainement && carte.length > 0 && (
              <Link href="#profil-entrainement" className="flex items-center min-h-11 text-[0.8125rem] font-bold text-teal">Modifier ›</Link>
            )}
            {mesures.length > 0 && (
              <dl className={clsx(carte.length > 0 && 'border-t border-indigo/[0.06]')}>
                {mesures.map(([cle, valeur]) => (
                  <div key={cle} className="grid grid-cols-[112px_1fr] gap-x-3 py-2.5 border-b last:border-b-0 border-indigo/[0.06] text-[0.84rem] text-indigo">
                    <dt className="font-semibold text-[#5E5C78]">{cle}</dt><dd>{valeur}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Carte>
        )}

        <p className="text-[0.8125rem] text-[#5E5C78] leading-relaxed">
          Tes repères, tirés de tes tests. Ils règlent les cibles de tes séances{d.ecrit ? ' et tes zones dans Nolio' : ''}.
        </p>

        {/* C39 : les trois tuiles alignées (leur titre sur deux lignes réservées : « Vitesse critique » en prenait deux). */}
        <section className="grid grid-cols-3 gap-2" aria-label="Tes repères">
          {reperes.map(([titre, valeur, unite, test, cle]) => {
            const contenu = (
              <>
                <span className="min-h-[2.5em] text-[0.625rem] font-bold tracking-[0.1em] uppercase text-teal leading-[1.25]">{titre}</span>
                <span className={clsx('font-extrabold', valeur ? 'text-[1.375rem] text-indigo' : 'text-base text-[#8A5E10] py-1')}>{valeur ?? 'à tester'}</span>
                <span className="text-[0.6875rem] text-[#5E5C78] leading-snug">{valeur ? `${unite} · ${test.charAt(0).toLowerCase()}${test.slice(1)}` : `${test} ›`}</span>
              </>
            );
            const cadre = 'bg-white rounded-[14px] border border-indigo/[0.08] p-3 flex flex-col gap-1 min-h-11';
            return valeur || !saisie ? <div key={titre} className={cadre}>{contenu}</div>
              : <Link key={titre} href={`${saisie}#${cle}`} className={cadre}>{contenu}</Link>;
          })}
        </section>

        {/* AT2 (décision coach du 04/11/2026) : les zones et les tests en haut, sous les repères ; avant, vers 2 500 px,
            sous les badges. */}
        {zones && <TableauZones zones={zones} lignes={lignes} profil={profil} titre="Tes zones" saisie={saisie} />}

        <Carte className="space-y-2.5">
          <Surtitre>Tes tests</Surtitre>
          {/* C34 (audits du 05/11/2026) : « son résultat se lit dans Nolio » seulement avec l'accord de lecture ; sans lui,
              il l'entre ici. Validé par le coach le 05/11/2026 (1A ; la phrase sans accord). */}
          <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
            {d.ecrit && !ctx.aLaMain
              ? (d.accord || !saisie
                ? 'Quand un repère manque, ta préparation écrit le test à la place d’une séance ; son résultat se lit dans Nolio.'
                : <>Quand un repère manque, ta préparation écrit le test à la place d’une séance ;{' '}
                  <Link href={saisie} className="font-bold text-teal whitespace-nowrap">entre ton résultat ici ›</Link></>)
              : 'Trois tests de terrain donnent tes repères : leur protocole, ce qu’ils changent et leurs limites.'}
          </p>
          {/* Les tests que « Tes zones » propose, pas d'autres (sans « Tes zones », les fiches de la bibliothèque). */}
          <ul>
            {FICHES_TESTS.map(([cle, titre, fiche]) => (zones && !testsProposes(zones).includes(cle as CleTest) ? null : (
              <li key={cle}>
                <Link href={saisie ? `${saisie}#${cle}` : lien(`/app/bibliotheque/${fiche}`, ctx)}
                  className="flex items-center justify-between min-h-11 border-t border-indigo/[0.06] text-[0.8125rem] font-bold text-teal">
                  <span>{titre}</span><span aria-hidden>›</span>
                </Link>
              </li>
            )))}
          </ul>
          {ctx.coache && saisie && <p className="text-xs text-[#5E5C78]">{ctx.aLaMain
            // C47 : à la main ou sans objectif, aucune semaine ne s'écrit le dimanche. Validé par le coach le 05/11/2026 (1A).
            ? 'Un test refait de ton côté s’entre ici : tes zones changent dès maintenant, ton coach le voit sur ta fiche et en tient compte pour ta semaine suivante.'
            : 'Un test refait de ton côté s’entre ici : tes zones changent dès maintenant, tes séances à partir de la semaine écrite dimanche, et ton coach le voit sur ta fiche.'}</p>}
        </Carte>
        <StyleCoureur profil={profil} titre="Ton style de coureur" />

        {entrainement && (
          <Carte id="profil-entrainement" className="space-y-1 scroll-mt-20">
            <Surtitre>Ton profil d’entraînement</Surtitre>
            {/* Rempli d'abord, avant le premier objectif (décision coach du 23/10/2026) : vide, son formulaire ouvert. */}
            {Object.keys(entrainement).length === 0 ? (
              <p className="pt-1 text-[0.8125rem] leading-relaxed text-[#4A4866]">
                À remplir une fois, avant ta première course : ton niveau et ta semaine habituelle. Tes objectifs ne
                demanderont ensuite que ta course et ta charge du moment.
              </p>
            ) : (
              <>
                <dl className="pt-1">
                  {lignesDuProfil(entrainement).map(([cle, valeur]) => (
                    <div key={cle} className="grid grid-cols-[112px_1fr] gap-x-3 py-2.5 border-b last:border-b-0 border-indigo/[0.06] text-[0.84rem] text-indigo">
                      <dt className="font-semibold text-[#5E5C78]">{cle}</dt><dd>{valeur}</dd>
                    </div>
                  ))}
                </dl>
                <p className="pt-1 text-[0.72rem] leading-relaxed text-[#5E5C78]">
                  {ctx.aLaMain
                    // C47 : Validé par le coach le 05/11/2026 (1A).
                    ? 'Il sert à tes prochains objectifs ; ton coach en tient compte pour ta semaine suivante.'
                    : 'Il sert à tes prochains objectifs. Ta semaine, elle, s’ajuste chaque week-end avec ton questionnaire du samedi.'}
                </p>
              </>
            )}
            <details className="pt-2" open={Object.keys(entrainement).length === 0}>
              <summary className="cursor-pointer min-h-11 flex items-center text-[0.8125rem] font-bold text-teal">{Object.keys(entrainement).length === 0 ? 'Remplir mon profil' : 'Modifier mon profil'}</summary>
              <div className="pt-2"><ProfilAthlete profil={entrainement} pourMoi /></div>
            </details>
          </Carte>
        )}

        {/* Ses badges (BG1 à BG3, maquette validée par le coach le 20/10/2026). */}
        <TesBadges etat={badges.etat} accord={badges.accord} aujourdhui={ctx.jour} donnerAccord={ctx.coache ? null : `${lien('/app/compte', ctx)}#accord`} coache={ctx.coache} />

      </main>
    </>
  );
}

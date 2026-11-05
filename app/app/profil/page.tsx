import type { Metadata } from 'next';
import Link from 'next/link';
import clsx from 'clsx';
import { TesBadges } from '@/components/app/Badges';
import ProfilAthlete from '@/components/app/ProfilAthlete';
import EnTeteApp from '@/components/app/EnTeteApp';
import { Carte, CarteSombre, Surtitre, TITRE } from '@/components/app/Ui';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';
import { type CleTest } from '@/lib/app/plan';
import { allure, decalageSeuil1, profilCoureur, testsProposes, texteAllureLigne, texteFc } from '@/lib/app/zones';
import { mesBadges } from '@/lib/app/badgesNolio';
import { lignesDuProfil, monProfilDEntrainement } from '@/lib/app/profilEntrainement';
import { profilDEntrainementDeDemonstration } from '@/lib/app/demonstration';
import { donneesTableau } from '@/lib/app/tableauDuPlan';

export const metadata: Metadata = { title: 'Ton profil de coureur' };

// Mon profil de coureur (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, AP1, AP4 ; maquette validée par le coach le
// 19/10/2026) : ses trois repères, son style de coureur (la règle du calculateur « Ton profil de traileur », tirée du test
// de vitesse critique, et ce que sa préparation en fait), ses badges (BG1 à BG3), ses zones, ses tests. Un coaché lit les
// repères que son coach pose sur sa fiche (T8) ; un acheteur saisit les siens dans « Tes tests ».
// Revu après les audits du 05/11/2026 : Q3 (« Ton style de coureur », « Tes tests »), Q6-e et Q6-f (sans repère, sans
// accord : une phrase à la place de ce qui ne dit rien), C34, C36, C38, C39, C47.

// La couleur de chaque zone, de la récupération au sprint (maquette).
const TEINTES = ['#CDE8E1', '#9FD3C5', '#5FB8A6', '#2E9C87', '#0C6E5F', '#2F5E68', '#2F2D4E'];
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
  const coureur = profilCoureur(profil);
  const zones = plan.zones;
  const decalage = decalageSeuil1(profil, zones);
  const lignes = plan.mode_emploi.effort.zones.slice(1);
  // Ses repères se saisissent dans « Tes tests » ; ceux d'un coaché vont sur sa fiche (décision coach du 20/10/2026).
  const saisie = zones ? lien('/app/plan/zones', ctx) : null;
  // [titre, valeur, unité, le test qui le donne, son ancre dans « Tes tests »] ; C36 : une tuile « à tester » ouvre son test.
  const reperes: [string, string | null, string, string, CleTest][] = [
    ['Seuil 1', profil.fc_seuil1 !== null ? String(profil.fc_seuil1) : null, 'bpm', 'Le test de la parole', 'parole'],
    ['Vitesse critique', profil.vc_ms !== null ? allure(profil.vc_ms) : null, 'min/km', 'Ton seuil 2 en allure', 'vitesse_critique'],
    ['Seuil 2', profil.fc_seuil2 !== null ? String(profil.fc_seuil2) : null, 'bpm', 'Mesurée en séance', 'fc_seuil2'],
  ];
  // Q6-e (décision coach du 05/11/2026 au soir, « A ») : sans aucun repère, le tableau se réduit aux zones et à leur RPE.
  const aucunRepere = profil.fc_seuil1 === null && profil.vc_ms === null && profil.fc_seuil2 === null && profil.v_seuil1_ms === null;
  // Q1 : « Endurance fondamentale (EF) » ; le reste tel que le moteur le nomme.
  const nomDeZone = (nom: string) => {
    const n = nom.replace(/^Zone \d\+? — /, '');
    return /^endurance fondamentale$/i.test(n) ? 'Endurance fondamentale (EF)' : n;
  };
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
        <div>
          <h1 className={TITRE}>Ton profil de coureur</h1>
          <p className="mt-1.5 text-[0.8125rem] text-[#5E5C78] leading-relaxed">
            Tes repères, tirés de tes tests. Ils règlent les cibles de tes séances{d.ecrit ? ' et tes zones dans Nolio' : ''}.
          </p>
        </div>

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
        {zones && (
          <Carte className="!pb-2.5">
            <Surtitre>Tes zones</Surtitre>
            {/* C39 : des colonnes en proportions (en 768, elles collaient à droite) ; Q6-e : sans repère, la zone et son RPE. */}
            {!aucunRepere && (
              <div className="mt-2.5 grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-x-2 pb-2 text-[0.625rem] font-bold tracking-[0.08em] uppercase text-[#5E5C78]">
                <span>Zone</span><span>FC</span><span>Allure</span>
              </div>
            )}
            <ul className={aucunRepere ? 'mt-2' : ''}>
              {lignes.map(([rpe, nom], i) => {
                const fc = texteFc(zones.tableau.lignes[i]?.fc, profil)?.replace(/^FC /, '') ?? null;
                const al = texteAllureLigne(zones.tableau.lignes[i], profil, decalage);
                return (
                  <li key={nom} className={clsx('grid gap-x-2 items-center min-h-[46px] border-t border-indigo/[0.06] text-[0.78rem] text-indigo',
                    aucunRepere ? 'grid-cols-1' : 'grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1fr)]')}>
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-[26px] rounded shrink-0" style={{ backgroundColor: TEINTES[i] ?? '#2F2D4E' }} aria-hidden />
                      <span className="min-w-0">
                        <span className="block font-bold leading-tight first-letter:uppercase">{nomDeZone(nom)}</span>
                        <span className="block text-[0.656rem] text-[#5E5C78]">RPE {rpe}</span>
                      </span>
                    </span>
                    {!aucunRepere && <span className={fc ? '' : 'text-[#5E5C78]'}>{fc ?? 'RPE seul'}</span>}
                    {!aucunRepere && <span className={al ? '' : 'text-[#5E5C78]'}>{al?.replace('Plus lent que ', '> ').replace('/km', '') ?? 'RPE seul'}</span>}
                  </li>
                );
              })}
            </ul>
            {aucunRepere ? (
              // Q6-e : Validé par le coach le 05/11/2026 (1A ; le texte vient de la synthèse).
              <p className="pt-2.5 pb-1 text-[0.8125rem] text-[#4A4866] leading-relaxed">
                Tes FC et tes allures s’affichent après ton premier test.{' '}
                {saisie && <Link href={saisie} className="font-bold text-teal whitespace-nowrap">Tes tests ›</Link>}
              </p>
            ) : (
              <p className="pt-2.5 pb-1.5 text-[0.72rem] text-[#5E5C78] leading-relaxed">
                Les allures valent sur le plat ; en côte, la FC et le RPE ; en descente, le RPE seul. Le RPE prime toujours.
              </p>
            )}
          </Carte>
        )}

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
        {coureur ? (
          <>
            {/* Q3 : « Ton style de coureur » (« profil » revenait quatre fois sur l'onglet). */}
            <CarteSombre className="space-y-3">
              <Surtitre ton="clair">Ton style de coureur</Surtitre>
              <p className="text-2xl font-extrabold">{coureur.nom}</p>
              <div className="relative h-2.5 rounded-full bg-gradient-to-r from-[#8FD1C3] to-[#2BB39B]" aria-hidden>
                <span className="absolute top-[-3px] w-0.5 h-4 bg-white/70" style={{ left: '50%' }} />
                <span className="absolute top-[-5px] w-5 h-5 -ml-2.5 rounded-full bg-white border-[3px] border-indigo"
                  style={{ left: `${Math.max(0, Math.min(100, ((coureur.coefficient - 0.8) / 0.2) * 100))}%` }} />
              </div>
              {/* Q1 : sans le repère chiffré du coach au milieu. */}
              <div className="flex justify-between text-[0.6875rem] text-[#D6D5E6]"><span>plutôt rapide</span><span>plutôt endurant</span></div>
              <p className="text-[0.8125rem] leading-relaxed text-[#E8E7F2]">{coureur.texte}</p>
            </CarteSombre>
            <Carte className="space-y-3.5">
              <Conseil titre="Loin de ton objectif · ton point faible" texte={coureur.loin} ton="faible" />
              <div className="h-px bg-indigo/[0.08]" />
              <Conseil titre="Près de ton objectif · ton point fort" texte={coureur.pres} ton="fort" />
              <p className="text-[0.72rem] text-[#5E5C78] leading-relaxed">{coureur.note}</p>
            </Carte>
          </>
        ) : (
          <Carte className="space-y-1.5">
            <Surtitre>Ton style de coureur</Surtitre>
            {/* C38 : Validé par le coach le 05/11/2026 (1A). */}
            <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
              Il se tire de ton test de vitesse critique : plutôt rapide ou plutôt endurant. Ta préparation en tient compte :
              ton point faible loin de ton objectif, ton point fort près de lui.
            </p>
          </Carte>
        )}

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

function Conseil({ titre, texte, ton }: { titre: string; texte: string; ton: 'faible' | 'fort' }) {
  return (
    <div className="flex gap-3">
      <span className={clsx('w-9 h-9 shrink-0 rounded-[10px] flex items-center justify-center',
        ton === 'faible' ? 'bg-[#FFF1E0] text-[#9A4A06]' : 'bg-[#E1EFEA] text-teal-dark')}>
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {ton === 'faible' ? <path d="M13 3 5 14h6l-1 7 8-11h-6z" /> : <path d="M3 20 9 9l4 6 3-4 5 9z" />}
        </svg>
      </span>
      <div>
        <p className="text-[0.8125rem] font-bold text-indigo">{titre}</p>
        <p className="mt-1 text-[0.8125rem] text-[#4A4866] leading-relaxed">{texte}</p>
      </div>
    </div>
  );
}

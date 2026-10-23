import Link from 'next/link';
import clsx from 'clsx';
import { TesBadges } from '@/components/app/Badges';
import ProfilAthlete from '@/components/app/ProfilAthlete';
import EnTeteApp from '@/components/app/EnTeteApp';
import { Carte, CarteSombre, Surtitre } from '@/components/app/Ui';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';
import { type CleTest } from '@/lib/app/plan';
import { allure, decalageSeuil1, profilCoureur, testsProposes, texteAllureLigne, texteFc } from '@/lib/app/zones';
import { mesBadges } from '@/lib/app/badgesNolio';
import { lignesDuProfil, monProfilDEntrainement, PROFIL_DE_DEMONSTRATION } from '@/lib/app/profilEntrainement';
import { donneesTableau } from '@/lib/app/tableauDuPlan';

// Mon profil de coureur (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, AP1, AP4 ; maquette validée par le coach le
// 19/10/2026) : ses trois repères, son profil (la règle du calculateur « Ton profil de traileur » : le coefficient de
// Riegel du test de vitesse critique, ses deux conseils), ses badges (BG1 à BG3), ses zones, ses tests. Un coaché lit les repères que son
// coach pose sur sa fiche (T8) ; un acheteur saisit les siens dans « Tes zones ».

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
  const entrainement = !ctx.coache ? null : ctx.demonstration ? PROFIL_DE_DEMONSTRATION : await monProfilDEntrainement().catch(() => null);
  const coureur = profilCoureur(profil);
  const zones = plan.zones;
  const decalage = decalageSeuil1(profil, zones);
  const lignes = plan.mode_emploi.effort.zones.slice(1);
  const reperes: [string, string | null, string][] = [
    ['Seuil 1', profil.fc_seuil1 !== null ? String(profil.fc_seuil1) : null, 'bpm · test de la parole'],
    ['Vitesse critique', profil.vc_ms !== null ? allure(profil.vc_ms) : null, 'min/km · ton seuil 2 en allure'],
    ['Seuil 2', profil.fc_seuil2 !== null ? String(profil.fc_seuil2) : null, 'bpm · mesurée en séance'],
  ];
  // Ses repères se saisissent dans « Tes zones » ; ceux d'un coaché vont sur sa fiche (décision coach du 20/10/2026).
  const saisie = zones ? lien('/app/plan/zones', ctx) : null;
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
        <div>
          <h1 className="text-[1.625rem] font-extrabold text-indigo tracking-tight">Mon profil de coureur</h1>
          <p className="mt-1.5 text-[0.8125rem] text-[#5E5C78] leading-relaxed">
            Tes repères, tirés de tes tests. Ils règlent les cibles de tes séances{d.ecrit ? ' et tes zones dans Nolio' : ''}.
          </p>
        </div>

        <section className="grid grid-cols-3 gap-2" aria-label="Tes repères">
          {reperes.map(([titre, valeur, sous]) => (
            <div key={titre} className="bg-white rounded-[14px] border border-indigo/[0.08] p-3 flex flex-col gap-1">
              <span className="text-[0.625rem] font-bold tracking-[0.1em] uppercase text-teal">{titre}</span>
              <span className={clsx('font-extrabold', valeur ? 'text-[1.375rem] text-indigo' : 'text-base text-[#8A5E10] py-1')}>{valeur ?? 'à tester'}</span>
              <span className="text-[0.6875rem] text-[#5E5C78] leading-snug">{sous}</span>
            </div>
          ))}
        </section>

        {coureur ? (
          <>
            <CarteSombre className="space-y-3">
              <Surtitre ton="clair">Ton profil</Surtitre>
              <p className="text-2xl font-extrabold">{coureur.nom}</p>
              <div className="relative h-2.5 rounded-full bg-gradient-to-r from-[#8FD1C3] to-[#2BB39B]" aria-hidden>
                <span className="absolute top-[-3px] w-0.5 h-4 bg-white/70" style={{ left: '50%' }} />
                <span className="absolute top-[-5px] w-5 h-5 -ml-2.5 rounded-full bg-white border-[3px] border-indigo"
                  style={{ left: `${Math.max(0, Math.min(100, ((coureur.coefficient - 0.8) / 0.2) * 100))}%` }} />
              </div>
              <div className="flex justify-between text-[0.6875rem] text-[#D6D5E6]"><span>plutôt rapide</span><span>0,90</span><span>plutôt endurant</span></div>
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
            <Surtitre>Ton profil</Surtitre>
            <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
              Il se tire de ton test de vitesse critique : plutôt rapide ou plutôt endurant, ton point faible à travailler loin
              de ton objectif, ton point fort près de lui.
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
                  Il sert à tes prochains objectifs. Ta semaine, elle, s’ajuste chaque dimanche avec ton questionnaire.
                </p>
              </>
            )}
            <details className="pt-2" open={Object.keys(entrainement).length === 0}>
              <summary className="cursor-pointer min-h-10 flex items-center text-[0.8125rem] font-bold text-teal">{Object.keys(entrainement).length === 0 ? 'Remplir mon profil' : 'Modifier mon profil'}</summary>
              <div className="pt-2"><ProfilAthlete profil={entrainement} pourMoi /></div>
            </details>
          </Carte>
        )}

        {/* Ses badges (BG1 à BG3, maquette validée par le coach le 20/10/2026). */}
        <TesBadges etat={badges.etat} accord={badges.accord} aujourdhui={ctx.jour} />

        {zones && (
          <Carte className="!pb-2.5">
            <Surtitre>Tes zones</Surtitre>
            <div className="mt-2.5 grid grid-cols-[1fr_76px_96px] gap-x-2 pb-2 text-[0.625rem] font-bold tracking-[0.08em] uppercase text-[#5E5C78]">
              <span>Zone</span><span>FC</span><span>Allure</span>
            </div>
            <ul>
              {lignes.map(([rpe, nom], i) => {
                const fc = texteFc(zones.tableau.lignes[i]?.fc, profil)?.replace(/^FC /, '') ?? null;
                const al = texteAllureLigne(zones.tableau.lignes[i], profil, decalage);
                return (
                  <li key={nom} className="grid grid-cols-[1fr_76px_96px] gap-x-2 items-center min-h-[46px] border-t border-indigo/[0.06] text-[0.78rem] text-indigo">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-[26px] rounded shrink-0" style={{ backgroundColor: TEINTES[i] ?? '#2F2D4E' }} aria-hidden />
                      <span className="min-w-0">
                        <span className="block font-bold leading-tight first-letter:uppercase">{nom.replace(/^Zone \d — /, '')}</span>
                        <span className="block text-[0.656rem] text-[#5E5C78]">RPE {rpe}</span>
                      </span>
                    </span>
                    <span className={fc ? '' : 'text-[#5E5C78]'}>{fc ?? 'RPE seul'}</span>
                    <span className={al ? '' : 'text-[#5E5C78]'}>{al?.replace('Plus lent que ', '> ').replace('/km', '') ?? 'RPE seul'}</span>
                  </li>
                );
              })}
            </ul>
            <p className="pt-2.5 pb-1.5 text-[0.72rem] text-[#5E5C78] leading-relaxed">
              Les allures valent sur le plat ; en côte, la FC et le RPE ; en descente, le RPE seul. Le RPE prime toujours.
            </p>
          </Carte>
        )}

        <Carte className="space-y-2.5">
          <Surtitre>Tes tests</Surtitre>
          <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
            {d.ecrit && !ctx.aLaMain
              ? 'Quand un repère manque, ta préparation écrit le test à la place d’une séance ; son résultat se lit dans Nolio.'
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
          {ctx.coache && saisie && <p className="text-xs text-[#5E5C78]">Un test refait de ton côté s’entre ici : tes zones changent dès maintenant, tes séances à partir de la semaine écrite dimanche, et ton coach le voit sur ta fiche.</p>}
        </Carte>
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

import Link from 'next/link';
import { formatRouteDe } from '@/lib/app/route';
import clsx from 'clsx';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import CarteEntree from '@/components/app/CarteEntree';
import FormulaireValeurs from '@/components/app/FormulaireValeurs';
import InvitationApp from '@/components/app/InvitationApp';
import ProfilAthlete from '@/components/app/ProfilAthlete';
import { lignesDuProfil } from '@/lib/app/profilEntrainement';
import TestVcCoach from '@/components/app/TestVcCoach';
import { Carte, PastilleDate, Surtitre } from '@/components/app/Ui';
import { associerNolio, changerProgrammation, retirerAcces, retirerAthlete } from '@/lib/app/actionsCoaching';
import { adresseDuCompte } from '@/lib/app/espaceAthlete';
import { ficheAthlete } from '@/lib/app/coaching';
import { initiales } from '@/lib/app/contexte';
import { entreeDe } from '@/lib/app/entree';
import { coursesDansNolio, pasEncoreIci } from '@/lib/app/coursesNolio';
import { athletesNolio, ErreurNolio, exigerCoach, nolioConfigure, type AthleteNolio } from '@/lib/app/nolio';
import { ajouterJours, dateLongue } from '@/lib/app/plan';
import { textes } from '@/lib/plan';
import { allureDepuisVitesse } from '@/lib/app/allureCoach';
import { clientService, supabaseConfigure } from '@/lib/app/supabase';
import type { CourseSecondaire } from '@/lib/app/tableauDuPlan';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// La fiche d'un athlète coaché (CTS_NOLIO_CADRAGE.md, N8, N9, T6 ; maquette validée par le coach le 19/10/2026) : ses
// objectifs et leurs courses de préparation, « Nouvel objectif », son accès à l'app ; ses repères, son compte Nolio.
export default async function FicheAthleteCoache({ params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigure()) notFound();
  const coach = await exigerCoach();
  const { id } = await params;
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
  const { data: accord } = a.nolio_athlete_id
    ? await service.from('nolio_accords').select('accord_le').eq('coach_id', coach.compteId).eq('nolio_athlete_id', a.nolio_athlete_id).maybeSingle()
    : { data: null };
  const { data: plans } = a.objectifs.length
    ? await service.from('plans').select('id, parametres, demarre_le, depart_prevu, donnees->course->>distance_km, donnees->course->>dplus_m')
      .in('id', a.objectifs.map((o) => o.plan_id))
    : { data: [] };
  const etat = new Map((plans ?? []).map((p) => [p.id as string, p as Record<string, unknown>]));
  // PO1 : son profil, celui de sa fiche s'il a été modifié, sinon celui de son dernier objectif.
  const dernier = a.objectifs[a.objectifs.length - 1];
  const { data: intake } = dernier ? await service.from('plans').select('intake').eq('id', dernier.plan_id).maybeSingle() : { data: null };
  const deLIntake = (intake?.intake ?? {}) as Record<string, string | string[]>;
  const profil: Record<string, string | string[]> = a.profil ?? Object.fromEntries(
    ['niveau', 'terrain', 'jours_disponibles', 'jour_sl', 'freq_hebdo'].filter((k) => deLIntake[k] !== undefined).map((k) => [k, deLIntake[k]]));
  const lignesProfil = lignesDuProfil(profil);
  const source = (cle: 'fc_seuil1' | 'vc_ms' | 'fc_seuil2') => {
    const x = a.reperes_sources[cle];
    return !x ? null : x.source === 'test' ? `test lu dans Nolio le ${dateLongue(x.le, true)}`
      : x.source === 'test_coach' ? `test du ${dateLongue(x.le, true)}, saisi par toi`
      : x.source === 'athlete' ? `test saisi par l’athlète le ${dateLongue(x.le, true)}` : `saisi par toi le ${dateLongue(x.le, true)}`;
  };
  const reperes: [string, string | null, string | null][] = [
    ['FC au seuil 1', a.fc_seuil1 ? `${a.fc_seuil1} bpm` : null, source('fc_seuil1')],
    ['Vitesse critique', a.vc_ms ? `${allureDepuisVitesse(a.vc_ms)} /km` : null, source('vc_ms')],
    ['FC au seuil 2', a.fc_seuil2 ? `${a.fc_seuil2} bpm` : null, source('fc_seuil2')],
  ];
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const prochain = a.objectifs.find((o) => o.course_date >= jour)?.plan_id ?? null;
  const nomNolio = liste.find((x) => x.id === a.nolio_athlete_id)?.name ?? null;
  // Ses courses dans Nolio pas encore dans CTS (décision coach du 22/10/2026, « proposer, tu valides ») : aucun objectif
  // ni course de préparation à leur date.
  const dejaIci = new Set([...a.objectifs.map((o) => o.course_date), ...(plans ?? []).flatMap((p) =>
    (((p.parametres as Record<string, unknown> | null)?.courses_secondaires ?? []) as CourseSecondaire[]).map((c) => c.date))]);
  const coursesNolio = a.nolio_athlete_id && relie
    ? pasEncoreIci(await coursesDansNolio(a.nolio_athlete_id).catch(() => []), dejaIci) : [];
  const courseA = coursesNolio.find((c) => c.type === 'a') ?? null;
  // Son entrée (décision coach du 22/10/2026), sur son prochain objectif.
  const pp = prochain ? etat.get(prochain) : undefined;
  const entree = entreeDe({
    athleteId: a.id, nolio: Boolean(a.nolio_athlete_id), accord: Boolean(accord), programmation: a.programmation,
    objectif: prochain ? { plan_id: prochain, ecrit: Boolean(pp?.parametres), demarre: Boolean(pp?.demarre_le),
      prevu: (pp?.depart_prevu as string | null) ?? null } : null,
    dimanchesJusqua: a.questionnaires?.jusqua ?? null, aujourdhui: jour, courseA,
  });
  // Une course B devient une préparation de son objectif en cours, à partir de lundi prochain et avant sa course.
  const lundiProchain = ajouterJours(jour, 7 - ((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7));
  const dateProchain = a.objectifs.find((o) => o.plan_id === prochain)?.course_date ?? '';
  const pastilles: [string, boolean][] = [
    [a.nolio_athlete_id ? 'Nolio relié' : 'Nolio à associer', Boolean(a.nolio_athlete_id)],
    [accord ? 'Accord de lecture reçu' : 'Sans accord de lecture', Boolean(accord)],
    [a.compte_id ? 'App : ouverte' : 'App : à inviter', Boolean(a.compte_id)],
  ];
  return (
    <CadreCoach actif="athletes">
      <Link href="/app/coach" className="inline-flex items-center min-h-9 text-[0.8125rem] font-bold text-teal">‹ Tes athlètes</Link>
      <div className="flex flex-wrap items-center gap-4 !mt-2">
        <span className="w-14 h-14 rounded-full bg-[#E1EFEA] text-teal-dark flex items-center justify-center text-lg font-extrabold">{initiales(a.nom)}</span>
        <div className="flex-[1_1_240px]">
          <h1 className="text-[1.75rem] font-extrabold tracking-tight">{a.nom}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {pastilles.map(([texte, bien]) => (
              <span key={texte} className={clsx('text-[0.72rem] font-bold px-2.5 py-1 rounded-xl',
                bien ? 'bg-[#E3EFE9] text-teal' : 'bg-[#F6ECD8] text-[#7A520D]')}>{texte}</span>
            ))}
          </div>
        </div>
      </div>

      {!entree.complete && <CarteEntree entree={entree} />}

      <div className="flex flex-wrap gap-5 items-start">
        <div className="flex-[1_1_380px] min-w-0 space-y-5">
          <Carte className="!p-5 space-y-3">
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
            {a.objectifs.length === 0 && <p className="text-sm text-[#4A4866]">Aucun pour l’instant.</p>}
            {a.objectifs.map((o) => {
              const p = etat.get(o.plan_id);
              const principal = o.plan_id === prochain;
              const preps = (((p?.parametres as Record<string, unknown> | null)?.courses_secondaires ?? []) as CourseSecondaire[])
                .slice().sort((x, y) => x.date.localeCompare(y.date));
              const statut = o.course_date < jour ? 'couru'
                : !p?.parametres ? 'envoyé en entier'
                  : a.programmation === 'main' ? 'programmé à la main'
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
                  {principal && a.programmation === 'auto' && Boolean(p?.parametres) && !p?.demarre_le && !p?.depart_prevu && (
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
            <Carte className="!p-5 space-y-3">
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

          <Carte className="!p-5 space-y-3">
            <Surtitre>Sa programmation</Surtitre>
            <p className="text-sm leading-relaxed text-[#4A4866]">
              {a.programmation === 'main'
                ? 'À la main : tu écris ses séances dans Nolio, le moteur n’écrit rien pour lui. L’app reste son tableau de bord : sa semaine lue dans Nolio, ses données résumées chaque nuit, son profil, ses tests et ses badges ; avec un objectif, son J-, sa fiche de course et son jour J.'
                : 'Automatique : le moteur écrit ses semaines chaque dimanche, d’après sa semaine écoulée ; tu retouches dans Nolio au besoin.'}
            </p>
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
          </Carte>

          <Carte className="!p-5 space-y-3">
            <Surtitre>Dans l’app</Surtitre>
            <p className="text-sm leading-relaxed text-[#4A4866]">
              {adresse
                ? `Son espace est ouvert (${adresse}) : son tableau de bord, ses données, son profil, la bibliothèque. Ses séances restent dans Nolio.`
                : `${a.nom.split(' ')[0]} n’a pas encore accès à l’app. Invité, il reçoit un code à cette adresse pour s’y connecter, et voit son tableau de bord, ses données, son profil et la bibliothèque. Ses séances restent dans Nolio.`}
            </p>
            <InvitationApp athleteId={a.id} adresse={adresse} />
            {a.compte_id && (
              <form action={retirerAcces.bind(null, a.id)}>
                <button type="submit" className="text-xs text-[#5E5C78] underline underline-offset-2">Retirer son accès</button>
              </form>
            )}
          </Carte>
        </div>

        <div className="flex-[1_1_320px] min-w-0 space-y-5">
          <Carte className="!p-5 space-y-1">
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
                s’écrit à la place d’une séance. Gardés seulement avec son accord, celui du Suivi.
              </p>
              <FormulaireValeurs athleteId={a.id} fc1={a.fc_seuil1} vs1Allure={a.v_seuil1_ms ? allureDepuisVitesse(a.v_seuil1_ms) : null}
                vcAllure={a.vc_ms ? allureDepuisVitesse(a.vc_ms) : null} fc2={a.fc_seuil2} />
            </details>
          </Carte>

          {Object.keys(profil).length > 0 && (
            <Carte className="!p-5 space-y-1">
              <Surtitre>Son profil</Surtitre>
              <dl className="pt-1.5">
                {lignesProfil.map(([cle, valeur]) => (
                  <div key={cle} className="grid grid-cols-[112px_1fr] gap-x-3 py-2.5 border-b last:border-b-0 border-indigo/[0.06] text-[0.84rem]">
                    <dt className="font-semibold text-[#5E5C78]">{cle}</dt><dd>{valeur}</dd>
                  </div>
                ))}
              </dl>
              <p className="pt-1 text-[0.72rem] leading-relaxed text-[#5E5C78]">Rempli une fois. Les disponibilités de chaque semaine viennent ensuite de son questionnaire du dimanche.</p>
              <details className="pt-2">
                <summary className="cursor-pointer min-h-10 flex items-center text-[0.8125rem] font-bold text-teal">Modifier son profil</summary>
                <div className="pt-2"><ProfilAthlete athleteId={a.id} profil={profil} /></div>
              </details>
            </Carte>
          )}

          <Carte id="son-nolio" className="!p-5 space-y-3 scroll-mt-6">
            <Surtitre>Son compte Nolio</Surtitre>
            {!relie ? (
              <p className="text-sm text-[#4A4866]">La clé de l’API Nolio manque dans Vercel (NOLIO_API_KEY).</p>
            ) : erreur ? (
              <p className="text-sm text-[#4A4866]">{erreur}</p>
            ) : (
              <form action={associerNolio.bind(null, a.id)} className="space-y-2">
                {a.nolio_athlete_id && (
                  <p className="text-[0.8125rem] text-[#4A4866]">Associé à {nomNolio ?? 'un athlète que Nolio ne retrouve pas : choisis à nouveau son nom'}.</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <select name="nolio_id" defaultValue={a.nolio_athlete_id ?? ''} aria-label="Son nom dans Nolio"
                    className="flex-1 min-w-[12rem] min-h-11 rounded-[10px] border border-indigo/20 px-3 text-sm text-indigo bg-white">
                    <option value="" disabled>Choisis son nom</option>
                    {liste.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                  <button type="submit" className="min-h-11 px-4 rounded-[10px] border border-teal text-teal text-sm font-bold">{a.nolio_athlete_id ? 'Changer' : 'Associer'}</button>
                </div>
              </form>
            )}
          </Carte>
        </div>
      </div>

      <details id="retirer" className="text-[0.8125rem] text-[#5E5C78] scroll-mt-6">
        <summary className="cursor-pointer min-h-9">Retirer cet athlète</summary>
        <p className="mt-2">Sa fiche et ses objectifs quittent ton espace coach. Les séances déjà envoyées restent dans Nolio.</p>
        <form action={retirerAthlete.bind(null, a.id)} className="mt-2">
          <button type="submit" className="underline underline-offset-2">Retirer {a.nom}</button>
        </form>
      </details>
    </CadreCoach>
  );
}

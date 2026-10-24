import Link from 'next/link';
import clsx from 'clsx';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import { jourMois } from '@/lib/app/plan';
import { AnnulerSemaine } from '@/components/app/GestesEcriture';
import { ajustementsDuCoach, type Ajustement } from '@/lib/app/ecriture';
import { accordRecu, retirerAccord } from '@/lib/app/actionsSuivi';
import { athletesNolio, ErreurNolio, exigerCoach, moiNolio, nolioConfigure, type AthleteNolio } from '@/lib/app/nolio';
import { usrAcheteurs } from '@/lib/app/acheteurs';
import { accords, aujourdhuiParis, lireSuivi, seuilsSuivi, statutsDuSuivi, type GenreSignal, type StatutSuivi, type Suivi } from '@/lib/app/suivi';
import { prevision, RANG, type Niveau, type Prevision } from '@/lib/app/prevision';
import { supabaseConfigure } from '@/lib/app/supabase';

// Toujours calculée à la visite : la page lit la session du coach, puis Nolio, sans rien garder.
export const dynamic = 'force-dynamic';

// Le suivi des athlètes coachés (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, T1 à T4 ; maquette validée par le coach
// le 24/10/2026) : une ligne par athlète qui a donné son accord, les 7 derniers jours, du plus inquiétant au plus calme,
// avec ce que le moteur prévoit dimanche à cause des signaux ; le détail reste dans Nolio.
const PASTILLE: Record<GenreSignal, { libelle: string; fond: string; encre: string }> = {
  manquee: { libelle: 'Séance manquée', fond: '#E4E3EE', encre: '#2F2D4E' },
  plus_dur: { libelle: 'Plus dur que prévu', fond: '#FBE7DF', encre: '#9A3B2C' },
  sensations: { libelle: 'Mauvaises sensations', fond: '#FBEFD9', encre: '#8A5A00' },
  hooper: { libelle: 'Fatigue qui monte', fond: '#F6E3E8', encre: '#8A2E4A' },
  commentaire: { libelle: 'Commentaire à lire', fond: '#E3EFE9', encre: '#0C6E5F' },
};

const NIVEAU: Record<Niveau, { libelle: string; classe: string }> = {
  rouge: { libelle: 'Rouge', classe: 'bg-[#F6E1DD] text-[#8A3326]' }, orange: { libelle: 'Orange', classe: 'bg-[#F6ECD8] text-[#6E4A0C]' },
  vert: { libelle: 'Vert', classe: 'bg-[#E3EFE9] text-[#22604F]' }, rien: { libelle: '—', classe: 'bg-[#ECEBF2] text-[#4A4866]' },
};

const jour = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'numeric' });

type Ligne = { athlete: AthleteNolio; suivi: Suivi | null; erreur: string | null; statut?: StatutSuivi; prevu?: Prevision };

// Les athlètes lus quelques-uns à la fois : Nolio n'aime pas les rafales.
async function lireTous(liste: AthleteNolio[], moi: string, seuils: Awaited<ReturnType<typeof seuilsSuivi>>, aujourdhui: string) {
  const lignes: Ligne[] = [];
  for (let i = 0; i < liste.length; i += 5) {
    lignes.push(...await Promise.all(liste.slice(i, i + 5).map(async (athlete): Promise<Ligne> => {
      try {
        return { athlete, suivi: await lireSuivi(athlete.id, athlete.id === moi, seuils, aujourdhui), erreur: null };
      } catch (e) {
        console.error('Suivi Nolio :', e instanceof Error ? e.message : e);
        return { athlete, suivi: null, erreur: e instanceof ErreurNolio ? e.message : 'Nolio ne répond pas pour cet athlète : réessaie dans un moment.' };
      }
    })));
  }
  return lignes;
}

const pastille = 'inline-block text-[0.6875rem] font-bold px-2 py-0.5 rounded-full whitespace-nowrap';

export default async function SuiviCoach() {
  if (!supabaseConfigure()) notFound();
  const coach = await exigerCoach();
  if (!nolioConfigure()) {
    return (
      <>
        <CadreCoach actif="suivi"><p className="text-sm text-indigo/75">La clé de l’API Nolio manque dans Vercel (NOLIO_API_KEY).</p></CadreCoach>
      </>
    );
  }
  // Les ajustements viennent de la base, pas de Nolio : ils s'affichent même quand Nolio ne répond pas.
  const ajustements: Ajustement[] = await ajustementsDuCoach(coach.compteId).catch(() => []);
  let lignes: Ligne[] = [];
  let sansAccord: AthleteNolio[] = [];
  let erreur: string | null = null;
  try {
    const [tous, moi, ok, seuils, acheteurs, statuts] = await Promise.all([athletesNolio(), moiNolio(), accords(coach.compteId), seuilsSuivi(),
      usrAcheteurs(coach.compteId), statutsDuSuivi(coach.compteId)]);
    const aujourdhui = aujourdhuiParis();
    // Les acheteurs de plans donnent leur accord eux-mêmes, dans l'app (décision coach du 22/10/2026) : pas ici.
    sansAccord = tous.filter((a) => !ok.has(a.id) && !acheteurs.has(a.id));
    lignes = (await lireTous(tous.filter((a) => ok.has(a.id)), moi.id, seuils, aujourdhui)).map((l) => {
      const statut = statuts.get(l.athlete.id);
      return { ...l, statut, prevu: l.suivi ? prevision(l.suivi, statut ?? { ecrit: false, aLaMain: false }) : undefined };
    });
    // Du plus inquiétant au plus calme : le niveau, puis le nombre de signaux.
    const rang = (l: Ligne) => l.prevu ? RANG[l.prevu.niveau] : RANG.rien + 1;
    lignes.sort((a, b) => rang(a) - rang(b) || (b.suivi?.signaux.length ?? 0) - (a.suivi?.signaux.length ?? 0)
      || a.athlete.name.localeCompare(b.athlete.name, 'fr'));
  } catch (e) {
    console.error('Suivi :', e instanceof Error ? e.message : e);
    erreur = e instanceof ErreurNolio ? e.message : 'Le suivi n’a pas pu se charger : réessaie dans un moment.';
  }
  return (
    <>
      <CadreCoach actif="suivi">
        <div>
          <h1 className="text-[1.75rem] font-extrabold tracking-tight">Suivi des 7 jours</h1>
          <p className="mt-1.5 text-sm text-[#5E5C78] leading-relaxed">
            Ce que tes athlètes ont fait, lu dans Nolio à l’ouverture de la page (rien n’est gardé), et ce que le moteur
            prévoit dimanche soir à cause des signaux. Seuls les athlètes qui ont donné leur accord sont lus ; le même
            accord garde leurs repères (FC, allures) sur leur fiche, et le retirer les efface.
          </p>
        </div>
        {ajustements.length > 0 && (
          <section className="bg-white rounded-2xl border border-indigo/[0.08] p-4 space-y-2">
            <h2 className="eyebrow text-indigo/60">Ajustements automatiques ({ajustements.length})</h2>
            <p className="text-sm text-indigo/70">
              Ceux des semaines écrites ces 8 derniers jours. Annuler réécrit la semaine sans eux et la met à jour dans
              Nolio ; ce que tu as retouché toi-même dans Nolio reste.
            </p>
            <ul className="divide-y divide-indigo/10">
              {ajustements.map((a) => (
                <li key={`${a.planId}-${a.numero}`} className="py-2 space-y-1 text-sm">
                  <div className="font-semibold text-indigo">
                    <Link href={`/app/coach/plan/${a.planId}`} className="hover:underline">{a.nom}</Link>
                    <span className="font-normal text-indigo/60"> · {a.lundi ? `semaine du ${jourMois(a.lundi)}` : `semaine ${a.numero.slice(1)}`}{a.raisons.length > 0 && ` · ${a.raisons.join(', ')}`}</span>
                  </div>
                  {a.bilan && <p className="text-indigo/75">{a.bilan}</p>}
                  {a.raisons.length > 0 && <AnnulerSemaine planId={a.planId} numero={a.numero} />}
                  {a.allegees.map((j) => (
                    <p key={j.id} className="text-indigo/75">
                      {j.nom} allégée en EF (fatigue franche) ·{' '}
                      <Link href={`/app/garder?plan=${a.planId}&seance=${encodeURIComponent(j.id)}`} className="font-semibold text-teal">Garder la séance d’origine</Link>
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        )}

        {erreur && <p className="text-sm text-indigo/75 bg-white rounded-2xl border border-indigo/[0.08] p-4">{erreur}</p>}

        {lignes.length > 0 && (
          <section className="bg-white rounded-2xl border border-indigo/[0.08] p-5 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-teal">Tes athlètes, du plus inquiétant au plus calme</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] text-[#4A4866]">
                <span><span className={clsx(pastille, NIVEAU.rouge.classe)}>Rouge</span> le moteur changera sa semaine</span>
                <span><span className={clsx(pastille, NIVEAU.orange.classe)}>Orange</span> proche d’un seuil</span>
                <span><span className={clsx(pastille, NIVEAU.vert.classe)}>Vert</span> rien à signaler</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="text-left text-[0.6875rem] uppercase tracking-[0.08em] text-[#5E5C78] border-b border-indigo/10">
                    <th className="py-2.5 pr-3 font-bold">Athlète</th><th className="py-2.5 px-3 font-bold">Séances</th>
                    <th className="py-2.5 px-3 font-bold">Hooper</th><th className="py-2.5 px-3 font-bold">Signaux</th>
                    <th className="py-2.5 px-3 font-bold">Niveau</th><th className="py-2.5 pl-3 font-bold">Dimanche, le moteur prévoit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo/[0.06] align-top">
                  {lignes.map(({ athlete, suivi, erreur: e, statut, prevu }) => (
                    <tr key={athlete.id}>
                      <td className="py-3 pr-3">
                        {statut ? <Link href={`/app/coach/athlete/${statut.fiche}`} className="font-bold text-indigo hover:underline">{athlete.name}</Link>
                          : <span className="font-bold">{athlete.name}</span>}
                        <span className="block text-xs text-[#5E5C78] mt-0.5">{statut?.objectif ?? (statut ? 'Sans objectif à venir' : 'Sans fiche ici')}</span>
                        <form action={retirerAccord.bind(null, athlete.id)}>
                          <button type="submit" className="mt-1 text-xs text-indigo/50 underline underline-offset-2">Retirer l’accord</button>
                        </form>
                      </td>
                      <td className="py-3 px-3 tabular-nums whitespace-nowrap">{suivi ? `${suivi.faites} / ${suivi.prevues}` : '—'}</td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {suivi?.hooper ? suivi.hooper.valeur : '—'}
                        {suivi?.hooper?.moyenne != null && <span className="block text-xs text-[#5E5C78]">moyenne {Math.round(suivi.hooper.moyenne * 10) / 10}</span>}
                      </td>
                      <td className="py-3 px-3">
                        {e && <p className="text-[#5E5C78]">{e}</p>}
                        {suivi && suivi.signaux.length === 0 && <span className="text-[#5E5C78]">Aucun</span>}
                        {suivi && suivi.signaux.length > 0 && (
                          <ul className="space-y-1">
                            {suivi.signaux.map((s, i) => (
                              <li key={i}>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: PASTILLE[s.genre].fond, color: PASTILLE[s.genre].encre }}>
                                  {PASTILLE[s.genre].libelle}
                                </span>
                                <span className="block text-xs text-[#4A4866] mt-0.5">{jour(s.jour)} · {s.seance} · {s.detail}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {prevu && <span className={clsx(pastille, NIVEAU[prevu.niveau].classe)}>{NIVEAU[prevu.niveau].libelle}</span>}
                        {prevu?.pourquoi && <span className="block text-xs text-[#5E5C78] mt-1">{prevu.pourquoi}</span>}
                      </td>
                      <td className="py-3 pl-3">{prevu?.prevoit ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[0.8125rem] text-[#5E5C78]">
              Une lecture des règles du dimanche sur les 7 derniers jours ; le moteur, lui, juge la semaine entière et sa charge.
            </p>
          </section>
        )}

        {sansAccord.length > 0 && (
          <section id="sans-accord" className="bg-white rounded-2xl border border-indigo/[0.08] p-4 space-y-2 scroll-mt-6">
            <h2 className="eyebrow text-indigo/60">Sans accord ({sansAccord.length})</h2>
            <p className="text-sm text-indigo/70">
              Envoie-leur le message d’accord dans Nolio ; quand l’un répond oui, coche « Accord reçu » : sa réponse
              écrite reste ta preuve.
            </p>
            <ul className="divide-y divide-indigo/10">
              {sansAccord.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-indigo">{a.name}</span>
                  <form action={accordRecu.bind(null, a.id, a.name)}>
                    <button type="submit" className="text-sm font-semibold text-teal">Accord reçu</button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}
      </CadreCoach>
    </>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import { jourMois } from '@/lib/app/plan';
import { AnnulerSemaine } from '@/components/app/GestesEcriture';
import { ajustementsDuCoach, type Ajustement } from '@/lib/app/ecriture';
import { accordRecu, retirerAccord } from '@/lib/app/actionsSuivi';
import { athletesNolio, ErreurNolio, exigerCoach, moiNolio, nolioConfigure, type AthleteNolio } from '@/lib/app/nolio';
import { accords, aujourdhuiParis, lireSuivi, seuilsSuivi, type GenreSignal, type Suivi } from '@/lib/app/suivi';
import { supabaseConfigure } from '@/lib/app/supabase';

// Toujours calculée à la visite : la page lit la session du coach, puis Nolio, sans rien garder.
export const dynamic = 'force-dynamic';

// Le suivi des athlètes coachés (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, T1 à T4) : une ligne par athlète qui a
// donné son accord, les 7 derniers jours, ce qui mérite le regard du coach d'abord ; le détail reste dans Nolio.
const PASTILLE: Record<GenreSignal, { libelle: string; fond: string; encre: string }> = {
  manquee: { libelle: 'Séance manquée', fond: '#E4E3EE', encre: '#2F2D4E' },
  plus_dur: { libelle: 'Plus dur que prévu', fond: '#FBE7DF', encre: '#9A3B2C' },
  sensations: { libelle: 'Mauvaises sensations', fond: '#FBEFD9', encre: '#8A5A00' },
  hooper: { libelle: 'Fatigue qui monte', fond: '#F6E3E8', encre: '#8A2E4A' },
  commentaire: { libelle: 'Commentaire à lire', fond: '#E3EFE9', encre: '#0C6E5F' },
};

const jour = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'numeric' });

type Ligne = { athlete: AthleteNolio; suivi: Suivi | null; erreur: string | null };

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
    const [tous, moi, ok, seuils] = await Promise.all([athletesNolio(), moiNolio(), accords(coach.compteId), seuilsSuivi()]);
    const aujourdhui = aujourdhuiParis();
    sansAccord = tous.filter((a) => !ok.has(a.id));
    lignes = await lireTous(tous.filter((a) => ok.has(a.id)), moi.id, seuils, aujourdhui);
    lignes.sort((a, b) => (b.suivi?.signaux.length ?? 0) - (a.suivi?.signaux.length ?? 0) || a.athlete.name.localeCompare(b.athlete.name, 'fr'));
  } catch (e) {
    console.error('Suivi :', e instanceof Error ? e.message : e);
    erreur = e instanceof ErreurNolio ? e.message : 'Le suivi n’a pas pu se charger : réessaie dans un moment.';
  }
  return (
    <>
      <CadreCoach actif="suivi">
        <div>
          <h1 className="text-2xl text-indigo">Suivi des 7 derniers jours</h1>
          <p className="text-sm text-indigo/70 leading-relaxed mt-1">
            Ce qui mérite ton regard d’abord ; le détail est dans Nolio. Lu dans Nolio à l’ouverture de la page, rien
            n’est gardé. Seuls les athlètes qui ont donné leur accord sont lus ; le même accord garde leurs repères
            (FC, allures) sur leur fiche, et le retirer les efface.
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
          <ul className="bg-white rounded-2xl border border-indigo/[0.08] divide-y divide-indigo/10">
            {lignes.map(({ athlete, suivi, erreur: e }) => (
              <li key={athlete.id} className="p-4 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-indigo">{athlete.name}</span>
                  {suivi && (
                    <span className="text-xs text-indigo/60">
                      {suivi.faites}/{suivi.prevues} séance{suivi.prevues > 1 ? 's' : ''} faite{suivi.faites > 1 ? 's' : ''}
                      {suivi.hooper && ` · Hooper ${suivi.hooper.valeur}${suivi.hooper.moyenne !== null ? ` (moyenne ${Math.round(suivi.hooper.moyenne * 10) / 10})` : ''}`}
                    </span>
                  )}
                </div>
                {e && <p className="text-sm text-indigo/70">{e}</p>}
                {suivi && suivi.signaux.length === 0 && <p className="text-sm text-teal">Rien à signaler.</p>}
                {suivi && suivi.signaux.length > 0 && (
                  <ul className="space-y-1">
                    {suivi.signaux.map((s, i) => (
                      <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: PASTILLE[s.genre].fond, color: PASTILLE[s.genre].encre }}>
                          {PASTILLE[s.genre].libelle}
                        </span>
                        <span className="text-indigo/80">{jour(s.jour)} · {s.seance} · {s.detail}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <form action={retirerAccord.bind(null, athlete.id)}>
                  <button type="submit" className="text-xs text-indigo/50 underline underline-offset-2">Retirer l’accord</button>
                </form>
              </li>
            ))}
          </ul>
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

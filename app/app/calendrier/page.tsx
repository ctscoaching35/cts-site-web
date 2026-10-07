import Link from 'next/link';
import clsx from 'clsx';
import BanniereSemaine from '@/components/app/BanniereSemaine';
import EnTeteApp from '@/components/app/EnTeteApp';
import FriseBlocs from '@/components/app/FriseBlocs';
import GrilleMois from '@/components/app/GrilleMois';
import JoursSemaine from '@/components/app/JoursSemaine';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';
import { moisLong, semaineDeDate } from '@/lib/app/plan';
import { BANNIERE, FAMILLES } from '@/lib/app/charte';

// Le calendrier (cadrage, 3.2) : la semaine, comme une page du PDF, ou le mois d'un coup d'œil ;
// la frise des blocs mène à chacun. Lecture seule (D8).
// Les boutons semaine précédente / suivante (et mois) : une vraie cible au doigt, 44 px de haut.
const BOUTON_SEMAINE =
  'inline-flex items-center gap-2 min-h-11 min-w-11 justify-center px-4 bg-white border border-indigo/15 shadow-sm text-base font-bold text-teal';

export default async function Calendrier({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  const { plan, jour } = ctx;
  const r = await searchParams;
  const vue = r.vue === 'mois' ? 'mois' : 'semaine';
  const premier = plan.semaines[0];
  const dernier = plan.semaines[plan.semaines.length - 1];
  // La semaine montrée : celle demandée, sinon celle du jour, bornée au plan.
  const demandee = plan.semaines.find((s) => s.numero === r.s);
  const semaine =
    demandee ?? semaineDeDate(plan, jour) ?? (jour < (premier.lundi ?? '') ? premier : dernier);
  const rang = plan.semaines.indexOf(semaine);
  // Le mois montré : celui demandé, sinon celui de la semaine, borné au plan.
  const moisMin = (premier.lundi ?? plan.course.date_debut_plan).slice(0, 7);
  const moisMax = plan.course.date.slice(0, 7);
  const moisDemande = typeof r.m === 'string' && /^\d{4}-\d{2}$/.test(r.m) ? r.m : (semaine.lundi ?? jour).slice(0, 7);
  const mois = moisDemande < moisMin ? moisMin : moisDemande > moisMax ? moisMax : moisDemande;
  const moisVoisin = (n: number) => {
    const [a, m] = mois.split('-').map(Number);
    const d = new Date(Date.UTC(a, m - 1 + n, 1));
    return d.toISOString().slice(0, 7);
  };
  const blocs = plan.architecture.tableau.slice(1);
  const typesSemaine = Array.from(new Set(plan.semaines.map((s) => s.type)));

  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl text-indigo">Calendrier</h1>
          <div className="flex text-xs font-semibold" role="tablist">
            {(['semaine', 'mois'] as const).map((v) => (
              <Link
                key={v}
                role="tab"
                aria-selected={vue === v}
                href={lien('/app/calendrier', ctx, { vue: v, s: semaine.numero, ...(v === 'mois' ? { m: mois } : {}) })}
                className={clsx('px-3 py-1.5 border', vue === v ? 'bg-indigo text-white border-indigo' : 'bg-white text-indigo/70 border-indigo/20')}
              >
                {v === 'semaine' ? 'Semaine' : 'Mois'}
              </Link>
            ))}
          </div>
        </div>

        {/* La frise des blocs : chaque bloc mène à sa première semaine. */}
        <FriseBlocs
          blocs={blocs.map((b) => {
            const [du, au] = b[0].split('-');
            const dedans = plan.semaines.slice(
              plan.semaines.findIndex((x) => x.numero === du),
              plan.semaines.findIndex((x) => x.numero === (au ?? du)) + 1
            );
            return {
              cle: b[0],
              titre: b[2],
              actif: dedans.includes(semaine),
              href: lien('/app/calendrier', ctx, { vue, s: du, ...(vue === 'mois' ? { m: (dedans[0]?.lundi ?? jour).slice(0, 7) } : {}) }),
            };
          })}
        />

        {vue === 'semaine' ? (
          <section className="space-y-2">
            {/* Semaine précédente, suivante : de vrais boutons, à l'échelle du bandeau (retour du coach
                du 07/10/2026 : « trop petits »). */}
            <div className="flex items-center justify-between">
              {rang > 0 ? (
                <Link href={lien('/app/calendrier', ctx, { s: plan.semaines[rang - 1].numero })} className={BOUTON_SEMAINE}>
                  <span aria-hidden>‹</span> {plan.semaines[rang - 1].numero}
                </Link>
              ) : <span />}
              {rang < plan.semaines.length - 1 ? (
                <Link href={lien('/app/calendrier', ctx, { s: plan.semaines[rang + 1].numero })} className={BOUTON_SEMAINE}>
                  {plan.semaines[rang + 1].numero} <span aria-hidden>›</span>
                </Link>
              ) : <span />}
            </div>
            <BanniereSemaine semaine={semaine} />
            <JoursSemaine semaine={semaine} ctx={ctx} />
          </section>
        ) : (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              {mois > moisMin ? (
                <Link href={lien('/app/calendrier', ctx, { vue: 'mois', m: moisVoisin(-1) })} className={BOUTON_SEMAINE} aria-label="Mois précédent">‹</Link>
              ) : <span />}
              <span className="text-lg font-bold text-indigo capitalize">{moisLong(`${mois}-01`)}</span>
              {mois < moisMax ? (
                <Link href={lien('/app/calendrier', ctx, { vue: 'mois', m: moisVoisin(1) })} className={BOUTON_SEMAINE} aria-label="Mois suivant">›</Link>
              ) : <span />}
            </div>
            <GrilleMois plan={plan} mois={mois} ctx={ctx} />
            {/* Légende : les familles et les types de semaine, avec les libellés du plan. */}
            <div className="bg-white shadow-sm p-3 space-y-2 text-xs text-indigo/75">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {plan.mode_emploi.lire_semaine.familles.map(([f, libelle]) => (
                  <span key={f} className="flex items-center gap-1.5">
                    <span
                      className={f === 'course' ? 'w-3.5 h-3.5' : 'w-4 h-1.5 rounded-full'}
                      style={{ backgroundColor: FAMILLES[f].filet }}
                    />
                    {libelle}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {typesSemaine.map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-4 rounded-full" style={{ backgroundColor: BANNIERE[t] ?? '#2F2D4E' }} />
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

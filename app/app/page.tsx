import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import EncartProfil from '@/components/app/EncartProfil';
import EnTeteApp from '@/components/app/EnTeteApp';
import {
  CarteNolio, FicheDuMoment, GraphiqueCharge, GraphiqueHooper, JaugePiliers, SemaineDeLaTrame,
} from '@/components/app/TableauDeBord';
import { COOKIE_BIENVENUE } from '@/lib/app/bienvenue';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';
import { dateLongue, joursEntre, moment } from '@/lib/app/plan';
import { barresDeCharge, ficheDuMoment, jaugeDuPlan, momentDe, pointsHooper } from '@/lib/app/tableau';
import { donneesTableau } from '@/lib/app/tableauDuPlan';

// Le tableau de bord (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, T1, décisions coach du 18-19/10/2026) : les
// séances vivent dans Nolio ; ici la course et le compte à rebours, où en est l'athlète dans Nolio, la semaine de la
// trame, la jauge, la charge et le Hooper, la fiche du moment.
export default async function TableauDeBord({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  // La première fois sur cet appareil : l'écran de bienvenue (cadrage, 2.6), lu avant d'entrer.
  if (!(await cookies()).get(COOKIE_BIENVENUE)) redirect(lien('/app/bienvenue', ctx));
  const { plan, jour } = ctx;
  const d = await donneesTableau(ctx);
  const etape = moment(plan, jour);
  const restants = joursEntre(jour, plan.course.date);
  const rang = d.trame.findIndex((l) => l.lundi && momentDe(l.lundi, jour) === 'encours');
  const jauge = jaugeDuPlan(d.trame, d.realises, jour);
  const fiche = ficheDuMoment(d.fiches, jour);
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-6">
        <div>
          <div className="eyebrow text-teal mb-1">{dateLongue(jour)}</div>
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="text-2xl text-indigo">{plan.course.nom}</h1>
            {restants > 0 && <span className="text-sm font-bold text-indigo/70 whitespace-nowrap">J-{restants}</span>}
          </div>
          <p className="text-sm text-indigo/60">{plan.course.date_lettres} · {plan.course.format_clair}</p>
        </div>

        {etape !== 'apres' && <CarteNolio etat={d.nolio} />}

        {etape === 'avant' && (
          <div className="bg-white shadow-sm p-4 border-l-4 border-teal">
            <p className="font-bold text-indigo">{plan.couverture.debut}</p>
            <p className="text-sm text-indigo/60 mt-1">{plan.couverture.rendez_vous}</p>
          </div>
        )}

        {etape === 'pendant' && rang >= 0 && (
          <section className="space-y-2">
            <h2 className="eyebrow text-indigo/60">Cette semaine</h2>
            <SemaineDeLaTrame ligne={d.trame[rang]} rang={rang + 1} total={d.trame.length} />
            <Link href={lien('/app/plan', ctx)} className="inline-block text-teal font-semibold text-sm">Tout ton plan ›</Link>
          </section>
        )}

        {etape !== 'apres' && restants <= 7 && (
          <Link href={lien('/app/plan/jour-j', ctx)} className="block bg-teal text-white p-4 shadow-sm">
            <span className="eyebrow text-white/70 block mb-1">Semaine de course</span>
            <span className="font-bold text-lg">{plan.jour_j.titre} ›</span>
          </Link>
        )}

        {fiche && etape !== 'apres' && <FicheDuMoment fiche={fiche.fiche} avenir={fiche.avenir} ctx={ctx} />}
        {etape !== 'avant' && <JaugePiliers jauge={jauge} />}
        {d.avecCharge && <GraphiqueCharge barres={barresDeCharge(d.trame, d.realises, jour)} />}
        {d.accord && <GraphiqueHooper points={pointsHooper(d.trame, d.realises, jour)} />}
        {/* Les repères d'un coaché sont posés par son coach (T8) : pas d'invitation aux tests. */}
        {etape !== 'apres' && !ctx.coache && <EncartProfil ctx={ctx} />}

        {etape === 'apres' && (
          <div className="bg-white shadow-sm p-4 text-indigo space-y-2">
            <p><span className="font-bold">{plan.course.nom}</span> — {plan.course.date_lettres}</p>
            <Link href={lien('/app/plan', ctx)} className="text-teal font-semibold text-sm">Revoir ton plan ›</Link>
          </div>
        )}
      </main>
    </>
  );
}

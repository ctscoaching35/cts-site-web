import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import EnTeteApp from '@/components/app/EnTeteApp';
import {
  CarteNolio, CarteObjectif, CetteSemaine, CoursesPreparation, FicheDuMoment, Piliers,
} from '@/components/app/TableauDeBord';
import { COOKIE_BIENVENUE } from '@/lib/app/bienvenue';
import { contexte, lien, prenom, type Recherche } from '@/lib/app/contexte';
import { dateLongue, joursEntre, moment } from '@/lib/app/plan';
import { ficheDuMoment, jaugeDuPlan, momentDe } from '@/lib/app/tableau';
import { donneesTableau, semaineEcrite } from '@/lib/app/tableauDuPlan';

// L'accueil (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, T1, AP1, AP2 ; maquette validée par le coach le
// 19/10/2026) : les séances vivent dans Nolio ; ici l'objectif et sa montagne, les piliers, les courses de
// préparation, la semaine en cours, la fiche du moment. Les données, le profil et la bibliothèque ont leur onglet.
export default async function Accueil({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  // La première fois sur cet appareil : l'écran de bienvenue (cadrage, 2.6), lu avant d'entrer.
  if (!(await cookies()).get(COOKIE_BIENVENUE)) redirect(lien('/app/bienvenue', ctx));
  const { plan, jour } = ctx;
  const d = await donneesTableau(ctx);
  const etape = moment(plan, jour);
  const restants = joursEntre(jour, plan.course.date);
  const rang = d.trame.findIndex((l) => l.lundi && momentDe(l.lundi, jour) === 'encours');
  const ligne = rang >= 0 ? d.trame[rang] : null;
  const semaine = ligne ? await semaineEcrite(ctx, ligne.numero) : null;
  const jauge = jaugeDuPlan(d.trame, d.realises, jour);
  const fiche = ficheDuMoment(d.fiches, jour);
  const nom = prenom(plan.athlete.nom);
  // Une course de préparation s'ajoute dans l'objectif, tant que la course est à venir et le plan écrit semaine par
  // semaine.
  const ajout = d.ecrit && !ctx.demonstration && plan.course.date >= jour ? `${lien('/app/plan', ctx)}#ajouter-course` : null;
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
        <div>
          <div className="text-xs font-semibold text-[#5E5C78] first-letter:uppercase">{dateLongue(jour)}</div>
          <h1 className="mt-1 text-[1.625rem] font-extrabold text-indigo tracking-tight">{nom ? `Bonjour ${nom}` : 'Bonjour'}</h1>
        </div>

        <CarteObjectif plan={plan} restants={restants} jauge={jauge} etape={etape} href={lien('/app/plan', ctx)} />
        {etape !== 'apres' && <CarteNolio etat={d.nolio} />}

        {etape !== 'apres' && restants <= 7 && (
          <Link href={lien('/app/plan/jour-j', ctx)} className="block bg-teal text-white rounded-2xl p-[18px]">
            <span className="block text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-white/70 mb-1">Semaine de course</span>
            <span className="font-bold text-lg">{plan.jour_j.titre} ›</span>
          </Link>
        )}

        {etape !== 'avant' && <Piliers jauge={jauge} />}
        {etape !== 'apres' && <CoursesPreparation courses={d.courses.filter((c) => c.date >= jour)} ajout={ajout} />}
        {etape === 'pendant' && <CetteSemaine semaine={semaine} ligne={ligne} questionnaire={d.ecrit && restants > 7} />}
        {fiche && etape !== 'apres' && <FicheDuMoment fiche={fiche.fiche} avenir={fiche.avenir} ctx={ctx} />}
      </main>
    </>
  );
}

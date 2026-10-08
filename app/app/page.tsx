import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import BanniereSemaine from '@/components/app/BanniereSemaine';
import CarteSeance from '@/components/app/CarteSeance';
import EncartProfil from '@/components/app/EncartProfil';
import EtHier from '@/components/app/EtHier';
import JaugePreparation from '@/components/app/JaugePreparation';
import EnTeteApp from '@/components/app/EnTeteApp';
import MentionTest from '@/components/app/MentionTest';
import JoursSemaine from '@/components/app/JoursSemaine';
import PastillesSemaine from '@/components/app/PastillesSemaine';
import { COOKIE_BIENVENUE } from '@/lib/app/bienvenue';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';
import { ajouterJours, dateLongue, jourParDate, joursEntre, moment, semaineDeDate } from '@/lib/app/plan';
import { texteReperes } from '@/lib/app/zones';
import { resume, seanceDuJournal } from '@/lib/app/journal';
import { mentionDeplacee } from '@/lib/app/deplacement';
import { mentionAjustee, proposition } from '@/lib/app/adaptation';
import PropositionAjustement from '@/components/app/PropositionAjustement';

// Aujourd'hui (cadrage, 3.1) : le compte à rebours, la séance du jour, demain, la semaine en
// cours ; avant le début, la date de départ et la première semaine ; après, le plan reste là.
export default async function Aujourdhui({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  // La première fois sur cet appareil : l'écran de bienvenue (cadrage, 2.6), lu avant d'entrer.
  if (!(await cookies()).get(COOKIE_BIENVENUE)) redirect(lien('/app/bienvenue', ctx));
  const { plan, jour } = ctx;
  const etape = moment(plan, jour);
  const restants = joursEntre(jour, plan.course.date);
  // La proposition d'ajustement du moment (§7.2, étape 3, A6), tant que la séance visée est à venir.
  const ajustement = proposition(plan, ctx.retours, ctx.ajustements, jour);
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-6">
        <div>
          <div className="eyebrow text-teal mb-1">{dateLongue(jour)}</div>
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="text-2xl text-indigo">{etape === 'pendant' ? 'Aujourd’hui' : 'Ton plan'}</h1>
            {restants > 0 && <span className="text-sm font-bold text-indigo/70 whitespace-nowrap">J-{restants}</span>}
          </div>
          <p className="text-sm text-indigo/60">{plan.course.format_clair}</p>
        </div>

        {etape === 'pendant' && <EtHier ctx={ctx} />}
        {ajustement && <PropositionAjustement ctx={ctx} p={ajustement} />}
        {etape !== 'avant' && <JaugePreparation ctx={ctx} />}
        {etape !== 'apres' && <EncartProfil ctx={ctx} />}
        {etape === 'avant' && <Avant ctx={ctx} />}
        {etape === 'pendant' && <Pendant ctx={ctx} />}
        {etape === 'apres' && (
          <div className="bg-white shadow-sm p-4 text-indigo">
            <span className="font-bold">{plan.course.nom}</span> — {plan.course.date_lettres}
            <div className="mt-3">
              <Link href={lien('/app/calendrier', ctx)} className="text-teal font-semibold text-sm">Voir le calendrier ›</Link>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function Avant({ ctx }: { ctx: Awaited<ReturnType<typeof contexte>> }) {
  const { plan } = ctx;
  const premiere = plan.semaines.find((s) => !s.passee) ?? plan.semaines[0];
  return (
    <>
      <div className="bg-white shadow-sm p-4 border-l-4 border-teal">
        <p className="font-bold text-indigo">{plan.couverture.debut}</p>
        <p className="text-sm text-indigo/60 mt-1">{plan.couverture.rendez_vous}</p>
      </div>
      <section className="space-y-2">
        <h2 className="eyebrow text-indigo/60">Ta première semaine</h2>
        <BanniereSemaine semaine={premiere} />
        <JoursSemaine semaine={premiere} ctx={ctx} />
      </section>
    </>
  );
}

function Pendant({ ctx }: { ctx: Awaited<ReturnType<typeof contexte>> }) {
  const { plan, jour } = ctx;
  const seance = jourParDate(plan, jour);
  const demain = jourParDate(plan, ajouterJours(jour, 1));
  const semaine = semaineDeDate(plan, jour);
  const semaineDeCourse = semaine?.jours.some((j) => j.famille === 'course');
  return (
    <>
      {seance && seance.famille !== 'repos' ? (
        <div className="space-y-2">
          <CarteSeance jour={seance} repere={texteReperes(seance.reperes, ctx.profil)} />
          {seance.prevu && <p className="text-sm text-indigo/60">{mentionDeplacee(seance)}</p>}
          {seance.ajuste && <p className="text-sm text-indigo/60">{mentionAjustee(plan, seance)}</p>}
          <MentionTest jour={seance} ctx={ctx} />
          {seanceDuJournal(seance) && (ctx.retours[seance.id] ? (
            <p className="text-sm text-indigo/75">Ton retour : {resume(ctx.retours[seance.id], seance)}</p>
          ) : (
            <Link href={lien(`/app/seance/${seance.id}`, ctx, { retour: '1' }) + '#retour'} className="btn btn-primary !py-2.5 inline-block">
              J’ai fait ma séance
            </Link>
          ))}
          <Link href={lien(`/app/seance/${seance.id}`, ctx)} className="inline-block text-teal font-semibold text-sm">
            La séance en détail ›
          </Link>
        </div>
      ) : (
        <div className="bg-white shadow-sm p-4 border-l-4 border-[#C5D5D2]">
          <h3 className="text-lg text-indigo">Repos</h3>
        </div>
      )}
      {demain && (
        <p className="text-sm text-indigo/70">
          <span className="font-semibold text-indigo">Demain :</span>{' '}
          {demain.famille === 'repos' ? (
            'repos'
          ) : (
            <Link href={lien(`/app/seance/${demain.id}`, ctx)} className="underline decoration-indigo/25 underline-offset-2">
              {demain.seance} · {demain.duree}
            </Link>
          )}
        </p>
      )}
      {semaine && (
        <section className="space-y-2">
          <h2 className="eyebrow text-indigo/60">Cette semaine</h2>
          <BanniereSemaine semaine={semaine} />
          <PastillesSemaine semaine={semaine} ctx={ctx} />
          <Link href={lien('/app/calendrier', ctx, { s: semaine.numero })} className="inline-block text-teal font-semibold text-sm">
            Toute la semaine ›
          </Link>
        </section>
      )}
      {semaineDeCourse && (
        <Link href={lien('/app/plan/jour-j', ctx)} className="block bg-teal text-white p-4 shadow-sm">
          <span className="eyebrow text-white/70 block mb-1">Semaine de course</span>
          <span className="font-bold text-lg">{plan.jour_j.titre} ›</span>
        </Link>
      )}
    </>
  );
}

import Link from 'next/link';
import clsx from 'clsx';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import { PasserEnCoaching } from '@/components/app/GestesMode';
import { chiffresParSemaine } from '@/lib/app/mesure';
import { acheteursDesPlans } from '@/lib/app/acheteurs';
import { chiffresDuCoaching } from '@/lib/app/chiffresCoaching';
import { exigerCoach } from '@/lib/app/nolio';
import { supabaseConfigure } from '@/lib/app/supabase';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// « Chiffres » (maquette validée par le coach le 24/10/2026) : deux onglets. Le coaching individualisé : ses coachés,
// leurs objectifs en route, et semaine par semaine ce que le moteur a écrit et ajusté, les Hooper reçus. Les plans : le
// tunnel de la vente (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, L4), semaine par semaine sur 12 semaines, et les
// acheteurs. Les visites du site et leur provenance : Vercel › Analytics.
const COLONNES: [string, string][] = [
  ['offre', 'Page des plans'], ['questionnaire', 'Questionnaires'], ['recap', 'Récapitulatifs'],
  ['paiement', 'Paiements lancés'], ['achats', 'Achats'], ['euros', 'Encaissé'], ['rappels', 'Rappels demandés'],
];

const date = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
// Où en est son invitation dans l'équipe Nolio.
const STATUT_NOLIO: Record<string, string> = {
  a_inviter: 'Invitation en préparation', en_cours: 'Invitation en préparation', invite: 'Invité dans Nolio',
  actif: 'Dans l’équipe Nolio', refuse: 'Invitation sans suite', sorti: 'Sorti de Nolio',
  coaching: 'son plan ne s’écrit pas',
};

export default async function Chiffres({ searchParams }: { searchParams: Promise<{ partie?: string }> }) {
  if (!supabaseConfigure()) notFound();
  const coach = await exigerCoach();
  const plans = (await searchParams).partie === 'plans';
  const onglets: [boolean, string, string][] = [[!plans, 'Coaching individualisé', '/app/coach/chiffres'], [plans, 'Plans', '/app/coach/chiffres?partie=plans']];
  return (
    <CadreCoach actif="chiffres">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-extrabold tracking-tight">Chiffres</h1>
          <p className="mt-1.5 text-sm text-[#5E5C78]">Le coaching individualisé et les plans, chacun de son côté.</p>
        </div>
        <nav aria-label="Partie" className="inline-flex p-1 gap-1 rounded-[14px] bg-[#E6E9E1]">
          {onglets.map(([actif, titre, href]) => (
            <Link key={titre} href={href} aria-current={actif ? 'page' : undefined}
              className={clsx('inline-flex items-center min-h-11 px-4 rounded-[11px] text-sm',
                actif ? 'bg-white text-indigo font-extrabold shadow-sm' : 'text-[#4A4866] font-semibold')}>
              {titre}
            </Link>
          ))}
        </nav>
      </div>
      {plans ? <PartiePlans /> : <PartieCoaching coachId={coach.compteId} />}
    </CadreCoach>
  );
}

// Le coaching individualisé : rien de Nolio, tout de la base.
async function PartieCoaching({ coachId }: { coachId: string }) {
  const c = await chiffresDuCoaching(coachId);
  const [derniere] = c.semaines;
  const quatre = c.semaines.slice(0, 4);
  const compteurs: [number, string][] = [
    [c.coaches, `athlète${c.coaches > 1 ? 's' : ''} coaché${c.coaches > 1 ? 's' : ''}${c.aLaMain ? `, dont ${c.aLaMain} à la main` : ''}`],
    [c.enRoute, `objectif${c.enRoute > 1 ? 's' : ''} en route dans Nolio`],
    [quatre.reduce((t, s) => t + s.ecrites, 0), 'semaines écrites par le moteur, 4 dernières semaines'],
    [quatre.reduce((t, s) => t + s.ajustements, 0), 'ajustements du moteur, 4 dernières semaines'],
  ];
  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        {compteurs.map(([n, texte]) => (
          <div key={texte} className="bg-white rounded-[14px] border border-indigo/[0.08] p-4">
            <div className="text-[1.75rem] font-extrabold">{n}</div>
            <div className="text-[0.78rem] text-[#5E5C78]">{texte}</div>
          </div>
        ))}
      </div>
      <section className="bg-white rounded-2xl border border-indigo/[0.08] p-5 space-y-2">
        <h2 className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-teal">Semaine par semaine</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-[0.6875rem] uppercase tracking-[0.08em] text-[#5E5C78]">
                <th className="py-2.5 pr-3 font-bold">Semaine du</th><th className="py-2.5 px-3 text-right font-bold">Semaines écrites</th>
                <th className="py-2.5 px-3 text-right font-bold">Ajustements</th><th className="py-2.5 pl-3 text-right font-bold">Hooper reçus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo/[0.06]">
              {c.semaines.map((s) => (
                <tr key={s.lundi}>
                  <td className="py-3 pr-3 font-semibold whitespace-nowrap">{date(s.lundi)}{s === derniere ? ' (en cours)' : ''}</td>
                  <td className="py-3 px-3 text-right tabular-nums">{s.ecrites}</td>
                  <td className="py-3 px-3 text-right tabular-nums">{s.ajustements}</td>
                  <td className="py-3 pl-3 text-right tabular-nums">{s === derniere ? '—' : s.resumees ? `${s.hooper} / ${s.resumees}` : '0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[0.8125rem] text-[#5E5C78]">
          Hooper reçus : sur les semaines résumées de tes coachés (accord de lecture donné). La semaine en cours se résume
          dimanche.
        </p>
      </section>
    </>
  );
}

// Les plans : le tunnel de la vente et les acheteurs.
async function PartiePlans() {
  const semaines = await chiffresParSemaine();
  const acheteurs = await acheteursDesPlans().catch(() => []);
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const encaisse = semaines.reduce((t, s) => t + s.euros, 0);
  const compteurs: [string, string][] = [
    [String(acheteurs.length), `plan${acheteurs.length > 1 ? 's' : ''} acheté${acheteurs.length > 1 ? 's' : ''}`],
    [`${encaisse.toLocaleString('fr-FR')} €`, 'encaissés, 12 dernières semaines'],
    [String(acheteurs.filter((a) => a.statut === 'actif').length), 'acheteurs dans l’équipe Nolio'],
    [String(acheteurs.filter((a) => a.accord).length), 'accords de lecture donnés'],
  ];
  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        {compteurs.map(([n, texte]) => (
          <div key={texte} className="bg-white rounded-[14px] border border-indigo/[0.08] p-4">
            <div className="text-[1.75rem] font-extrabold">{n}</div>
            <div className="text-[0.78rem] text-[#5E5C78]">{texte}</div>
          </div>
        ))}
      </div>
      <p className="text-sm text-indigo/70 leading-relaxed">
        Combien de personnes passent chaque étape, semaine par semaine. Les étapes sont comptées sans aucune
        donnée personnelle, une fois par visite. Les visites du site et leur provenance (Instagram, recherche…)
        sont dans Vercel, onglet Analytics.
      </p>
      {semaines.length === 0 ? (
        <p className="text-sm text-indigo/70 bg-white rounded-2xl border border-indigo/[0.08] p-4">Rien encore : les chiffres arrivent avec les premières visites.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-indigo/[0.08] overflow-x-auto">
          <table className="w-full text-sm text-indigo">
            <thead>
              <tr className="text-left text-xs uppercase tracking-cts text-indigo/60">
                <th className="p-3 whitespace-nowrap">Semaine du</th>
                {COLONNES.map(([, nom]) => <th key={nom} className="p-3 text-right whitespace-nowrap">{nom}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo/10">
              {semaines.map((s) => (
                <tr key={s.lundi}>
                  <td className="p-3 whitespace-nowrap font-semibold">{date(s.lundi)}</td>
                  {COLONNES.map(([cle]) => (
                    <td key={cle} className="p-3 text-right tabular-nums">
                      {cle === 'euros' ? `${s.euros.toLocaleString('fr-FR')} €` : s[cle as keyof typeof s]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Les acheteurs (décision coach du 22/10/2026) : à part du coaching, en lecture ; leur accord est le leur. */}
      <section className="bg-white rounded-2xl border border-indigo/[0.08] p-4 space-y-2">
        <h2 className="eyebrow text-indigo/60">Les acheteurs ({acheteurs.length})</h2>
        <p className="text-sm text-indigo/70">
          Leurs séances partent toutes seules dans Nolio. Leur accord de lecture, ils le donnent eux-mêmes dans l’app.
        </p>
        {acheteurs.length > 0 && (
          <ul className="divide-y divide-indigo/10">
            {acheteurs.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-x-3 gap-y-1 py-2 text-sm">
                <span className="text-indigo"><strong>{a.nom}</strong> · {a.course}{a.date ? `, le ${date(a.date)}` : ''}</span>
                <span className="text-indigo/70">
                  {a.statut === 'coaching' ? 'Mode : Coaching' : 'Mode : Plan'}{' · '}
                  {STATUT_NOLIO[a.statut ?? ''] ?? 'Nolio'}{a.statut === 'actif' ? (a.demarre ? `, démarré le ${date(a.demarre)}` : ', pas encore démarré') : ''}
                  {' · '}{a.accord ? 'accord donné' : 'sans accord'}
                </span>
                {/* Passer en coaching (décision coach du 23/10/2026) : une fois dans l'équipe. */}
                {a.usr && a.statut !== 'coaching' && a.date >= jour && (
                  <span className="basis-full"><PasserEnCoaching planId={a.id} nom={a.nom.split(' ')[0]} /></span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

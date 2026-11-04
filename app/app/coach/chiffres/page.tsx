import Link from 'next/link';
import clsx from 'clsx';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import { chiffresParSemaine } from '@/lib/app/mesure';
import { acheteursDesPlans } from '@/lib/app/acheteurs';
import { chiffresDuCoaching, type ChiffresCoaching } from '@/lib/app/chiffresCoaching';
import type { FamilleRetouche } from '@/lib/app/retouches';
import { exigerCoach } from '@/lib/app/nolio';
import { CORRECTIONS, CORRECTIONS_ACTIVES, correctionsComptees, RAISONS } from '@/lib/app/corrections';
import { ajouterJours } from '@/lib/app/plan';
import { espaceCoachOuvert } from '@/lib/app/supabase';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// « Chiffres » (maquette validée par le coach le 24/10/2026 ; décisions coach du 04/11/2026) : deux onglets. Le coaching
// individualisé : en tête un seul chiffre, la part des semaines envoyées qu'il n'a pas retouchées dans Nolio (4 dernières
// semaines, et sa tendance), puis ses retouches par semaine et par famille. Les plans : le tunnel de la vente
// (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, L4), semaine par semaine sur 12 semaines, et les acheteurs. Les
// visites du site et leur provenance : Vercel › Analytics.
const COLONNES: [string, string][] = [
  ['offre', 'Page des plans'], ['questionnaire', 'Questionnaires'], ['recap', 'Récapitulatifs'],
  ['paiement', 'Paiements lancés'], ['achats', 'Achats'], ['euros', 'Encaissé'], ['rappels', 'Rappels demandés'],
];

// Les portes du questionnaire (audit de la programmation trail du 30/10/2026, P6) : les refus avant paiement, par type.
const PORTES: [string, string][] = [
  ['porte_niveau', 'Format fermé au niveau'], ['porte_duree', 'Aucune durée'], ['porte_frequence', 'Séances par semaine'],
  ['porte_sortie_longue', 'Sortie longue sous 45 min'], ['porte_temps', 'Temps au-delà du plafond'],
  ['porte_autre', 'Autre (saisie, course)'],
];

const FAMILLE: Record<FamilleRetouche, string> = {
  ef: 'EF', seuil1: 'Seuil 1', seuil2: 'Seuil 2', vo2max: 'VO2max, côtes, course test', allure: 'Allure de course',
  sl: 'Sortie longue', mecanique: 'Mécanique (navettes, Myocrossmax)', renfo: 'Renfo',
};
const part = (n: number, sur: number) => (sur ? `${Math.round((100 * n) / sur)} %` : '—');
const ecart = (e: number | null) => (e === null ? '—' : `${e > 0 ? '+' : e < 0 ? '−' : ''}${Math.abs(Math.round(e * 100))} %`);

const date = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
// Où en est son invitation dans l'équipe Nolio.
const STATUT_NOLIO: Record<string, string> = {
  a_inviter: 'Invitation en préparation', en_cours: 'Invitation en préparation', invite: 'Invité dans Nolio',
  actif: 'Dans l’équipe Nolio', refuse: 'Invitation sans suite', sorti: 'Sorti de Nolio',
  coaching: 'son plan ne s’écrit pas',
};
const pourcent = (x: number) => `${Math.round(100 * x)} %`;

export default async function Chiffres({ searchParams }: { searchParams: Promise<{ partie?: string }> }) {
  if (!espaceCoachOuvert()) notFound();
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
  return (
    <>
      <SansRetouche c={c.sansRetouche} />
      <Retouches r={c.retouches} enCours={c.lundi} />
      <Corrections coachId={coachId} />
    </>
  );
}

// Le chiffre de tête : la part des semaines envoyées qu'il n'a pas retouchées dans Nolio, sur les 4 dernières semaines
// finies, et sa tendance contre les 4 d'avant ; elle doit monter au fil des dimanches.
function SansRetouche({ c }: { c: ChiffresCoaching['sansRetouche'] }) {
  const d = c?.dernieres;
  const avant = c?.avant;
  const ecart = d?.part !== null && d?.part !== undefined && avant?.part !== null && avant?.part !== undefined ? Math.round(100 * (d.part - avant.part)) : null;
  return (
    <section className="bg-white rounded-2xl border border-indigo/[0.08] p-5 space-y-2">
      <h2 className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-teal">Semaines envoyées sans retouche</h2>
      {!d?.semaines ? (
        <p className="text-sm text-[#5E5C78]">Rien encore : elles se comptent chaque nuit, sur les semaines écrites par le moteur et envoyées dans Nolio.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-[2.5rem] leading-none font-extrabold tabular-nums">{pourcent(d.part as number)}</span>
            {ecart !== null ? (
              <span className={clsx('text-sm font-bold', ecart > 0 ? 'text-teal' : ecart < 0 ? 'text-[#8A3326]' : 'text-[#5E5C78]')}>
                {ecart > 0 ? '↑' : ecart < 0 ? '↓' : '='} {ecart > 0 ? '+' : ecart < 0 ? '−' : ''}{Math.abs(ecart)} point{Math.abs(ecart) > 1 ? 's' : ''}
                <span className="font-normal text-[#5E5C78]"> contre {pourcent(avant?.part as number)} les 4 semaines d’avant</span>
              </span>
            ) : <span className="text-sm text-[#5E5C78]">pas encore de quoi comparer aux 4 semaines d’avant</span>}
          </div>
          <p className="text-sm text-[#3B3957]">
            {d.intactes} semaine{d.intactes > 1 ? 's' : ''} sur {d.semaines} envoyée{d.semaines > 1 ? 's' : ''} ces 4 dernières semaines, sans rien
            modifié, supprimé ni ajouté dans Nolio. Elle doit monter au fil des dimanches.
          </p>
          <p className="text-[0.8125rem] text-[#5E5C78]">
            Une semaine par athlète et par objectif ; les 4 semaines finies avant celle en cours, qui peut encore se retoucher.
          </p>
        </>
      )}
    </section>
  );
}

// Tes corrections avant l'envoi (EC3, décision coach du 04/11/2026) : ce que tu as corrigé sur l'aperçu, et pourquoi,
// ces 8 dernières semaines ; la boussole des prochaines améliorations du moteur, comme tes retouches.
async function Corrections({ coachId }: { coachId: string }) {
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const c = await correctionsComptees(coachId, ajouterJours(jour, -56)).catch(() => null);
  if (!CORRECTIONS_ACTIVES && !c?.semaines) return null;
  return (
    <section className="bg-white rounded-2xl border border-indigo/[0.08] p-5 space-y-3">
      <h2 className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-teal">Tes corrections avant l’envoi</h2>
      {!c?.semaines ? (
        <p className="text-sm text-[#5E5C78]">Rien encore : elles se comptent quand une semaine corrigée sur son aperçu part dimanche.</p>
      ) : (
        <>
          <p className="text-sm text-[#3B3957]">{c.semaines} semaine{c.semaines > 1 ? 's' : ''} corrigée{c.semaines > 1 ? 's' : ''} en 8 semaines.</p>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <ul className="space-y-1">
              {Object.entries(c.parCorrection).sort((x, y) => y[1] - x[1]).map(([k, n]) => (
                <li key={k}><span className="font-semibold tabular-nums">{n}</span> {CORRECTIONS[k as keyof typeof CORRECTIONS] ?? k}</li>
              ))}
            </ul>
            <ul className="space-y-1">
              {Object.entries(c.parRaison).sort((x, y) => y[1] - x[1]).map(([k, n]) => (
                <li key={k}><span className="font-semibold tabular-nums">{n}</span> {RAISONS[k as keyof typeof RAISONS] ?? 'Sans raison dite'}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}

// Tes retouches dans Nolio (décision coach du 26/10/2026) : la part de ce que le moteur envoie que tu corriges, et
// où.
function Retouches({ r, enCours }: { r: ChiffresCoaching['retouches']; enCours: string }) {
  const th = 'py-2.5 px-3 text-right font-bold';
  const td = 'py-3 px-3 text-right tabular-nums';
  return (
    <section className="bg-white rounded-2xl border border-indigo/[0.08] p-5 space-y-3">
      <h2 className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-teal">Tes retouches dans Nolio</h2>
      {!r ? (
        <p className="text-sm text-[#5E5C78]">Rien encore : les retouches se comptent chaque nuit, sur les semaines écrites par le moteur.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-[0.6875rem] uppercase tracking-[0.08em] text-[#5E5C78]">
                  <th className="py-2.5 pr-3 font-bold">Semaine du</th><th className={th}>Semaines sans retouche</th><th className={th}>Séances envoyées</th>
                  <th className={th}>Modifiées</th><th className={th}>Supprimées</th><th className={th}>Part retouchée</th><th className={clsx(th, 'pr-0')}>Ajoutées</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo/[0.06]">
                {r.semaines.map((s) => (
                  <tr key={s.lundi}>
                    <td className="py-3 pr-3 font-semibold whitespace-nowrap">{date(s.lundi)}{s.lundi === enCours ? ' (en cours)' : ''}</td>
                    <td className={td}>{s.semaines ? `${s.intactes} / ${s.semaines}` : '—'}</td>
                    <td className={td}>{s.envoyees}</td><td className={td}>{s.modifiees}</td><td className={td}>{s.supprimees}</td>
                    <td className={clsx(td, 'font-bold')}>{part(s.modifiees + s.supprimees, s.envoyees)}</td>
                    <td className={clsx(td, 'pr-0')}>{s.ajoutees}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="pt-2 text-sm font-bold">Par famille, 4 dernières semaines</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="text-left text-[0.6875rem] uppercase tracking-[0.08em] text-[#5E5C78]">
                  <th className="py-2.5 pr-3 font-bold">Famille</th><th className={th}>Envoyées</th><th className={th}>Modifiées</th>
                  <th className={th}>Supprimées</th><th className={th}>Part retouchée</th><th className={clsx(th, 'pr-0')}>Durée des modifiées</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo/[0.06]">
                {r.familles.map((f) => (
                  <tr key={f.famille}>
                    <td className="py-3 pr-3 font-semibold">{FAMILLE[f.famille]}</td>
                    <td className={td}>{f.envoyees}</td><td className={td}>{f.modifiees}</td><td className={td}>{f.supprimees}</td>
                    <td className={clsx(td, 'font-bold')}>{part(f.modifiees + f.supprimees, f.envoyees)}</td>
                    <td className={clsx(td, 'pr-0')}>{ecart(f.ecart)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="text-[0.8125rem] text-[#5E5C78]">
        Comptées chaque nuit sur la semaine en cours et la précédente. Semaines sans retouche : les semaines envoyées où
        rien n’a été modifié, supprimé ni ajouté. Modifiée : son contenu changé dans Nolio (un
        changement de jour ne compte pas). Ajoutées : les séances de course que tu as posées dans une semaine écrite par
        le moteur. Durée des modifiées : leur durée dans Nolio par rapport à la durée prévue (−15 % : tu les raccourcis).
      </p>
    </section>
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

      {/* Les portes (P6) : combien de visites bloquent sur chacune, semaine par semaine. */}
      {semaines.length > 0 && (
        <section className="space-y-2">
          <p className="text-sm text-indigo/70 leading-relaxed">
            Les portes : combien de visites bloquent sur chacune, une fois par visite, avant le paiement. C’est ce que
            chaque porte coûte en ventes.
          </p>
          <div className="bg-white rounded-2xl border border-indigo/[0.08] overflow-x-auto">
            <table className="w-full text-sm text-indigo">
              <thead>
                <tr className="text-left text-xs uppercase tracking-cts text-indigo/60">
                  <th className="p-3 whitespace-nowrap">Semaine du</th>
                  {PORTES.map(([, nom]) => <th key={nom} className="p-3 text-right whitespace-nowrap">{nom}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo/10">
                {semaines.map((s) => (
                  <tr key={s.lundi}>
                    <td className="p-3 whitespace-nowrap font-semibold">{date(s.lundi)}</td>
                    {PORTES.map(([cle]) => <td key={cle} className="p-3 text-right tabular-nums">{s[cle as keyof typeof s]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Les acheteurs (décision coach du 22/10/2026) : à part du coaching, en lecture ; leur accord est le leur. */}
      <section className="bg-white rounded-2xl border border-indigo/[0.08] p-4 space-y-2">
        <h2 className="eyebrow text-indigo/60">Les acheteurs ({acheteurs.length})</h2>
        <p className="text-sm text-indigo/70">
          Leurs séances partent toutes seules dans Nolio. Leur accord de lecture, ils le donnent eux-mêmes dans l’app. Une
          course qui change de date avant son départ : « Modifier l’objectif ».
        </p>
        {acheteurs.length > 0 && (
          <ul className="divide-y divide-indigo/10">
            {acheteurs.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-x-3 gap-y-1 py-2 text-sm">
                <span className="text-indigo"><strong>{a.nom}</strong> · {a.course}{a.date ? `, le ${date(a.date)}` : ''}</span>
                <span className="text-indigo/70">
                  {STATUT_NOLIO[a.statut ?? ''] ?? 'Nolio'}{a.statut === 'actif' ? (a.demarre ? `, démarré le ${date(a.demarre)}` : ', pas encore démarré') : ''}
                  {' · '}{a.accord ? 'accord donné' : 'sans accord'}
                </span>
                {/* « Modifier l'objectif » (PL6, décision coach du 04/11/2026 au soir) : avant son départ seulement ; une fois
                    parti, rien de nouveau, tu vois au cas par cas. */}
                {!a.demarre && a.statut !== 'coaching' && a.date >= jour && (
                  <Link href={`/app/coach/nouveau?modifier=${a.id}`} className="basis-full inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal">
                    Modifier l’objectif ›
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

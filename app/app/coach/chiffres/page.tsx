import Link from 'next/link';
import clsx from 'clsx';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import { chiffresParSemaine } from '@/lib/app/mesure';
import { acheteursDesPlans, ventesDesPlans } from '@/lib/app/acheteurs';
import { euros, moisDe, moisPrecedent, nomDuMois, parMois, periodeDe, total, ventesDe, type Vente } from '@/lib/app/comptabilite';
import { coachingsParMois } from '@/lib/app/stripeLecture';
import { CIBLE_RETOUCHEES, chiffresDuCoaching, cibleTenue, type ChiffresCoaching } from '@/lib/app/chiffresCoaching';
import type { FamilleRetouche } from '@/lib/app/retouches';
import { exigerCoach } from '@/lib/app/nolio';
import { montrerLInfra } from '@/lib/app/espaceCoachSimple';
import { moteurEstV9 } from '@/lib/app/moteurEnLigne';
import { motsDuCoach } from '@/lib/app/motsDuCoach';
import { ArreterPreparation } from '@/components/app/GestesEcriture';
import { ajouterJours } from '@/lib/app/plan';
import { espaceCoachOuvert } from '@/lib/app/supabase';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// « CHIFFRES », SA COMPTABILITÉ (l'espace par athlète, maquette validée par le coach le 08/11/2026, Q11 à Q13 « A » ;
// première étape) : en tête, ce que les plans ont encaissé, par mois, d'après ce que le site connaît (lib/app/
// comptabilite.ts) ; « Les plans », leurs ventes, puis repliés le tunnel de la vente, les portes et les acheteurs (Q13) ;
// « Les coachings », qui se brancheront sur son Stripe (lib/app/stripeLecture.ts, Q11, Q12) ; en bas, replié, le compte de
// ses retouches dans Nolio (la boussole du moteur, maquette validée le 24/10/2026, décisions coach du 04/11/2026). Les
// visites du site et leur provenance : Vercel › Analytics.
// SOUS LA 9.x (décision 220 du coach, 24/11/2026 ; lib/app/motsDuCoach.ts) : les mots du coach (« endurance », « seuil aérobie »), et plus rien de l'infrastructure : ni la clé Stripe à créer, ni
// Vercel › Analytics ; la phrase simple « Cette partie n'est pas disponible pour l'instant. », et le détail au journal du serveur. Sous la 8.x, rien ne change.
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
  sl: 'Sortie longue', mecanique: 'Mécanique (navettes, côtes et renfo, montée continue)', renfo: 'Renfo',
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

export default async function Chiffres({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  if (!espaceCoachOuvert()) notFound();
  const coach = await exigerCoach();
  const v9 = await moteurEstV9().catch(() => false);
  const mots = motsDuCoach(v9);
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const moisEnCours = jour.slice(0, 7);
  const periode = periodeDe((await searchParams).periode, moisEnCours);
  const [ventes, coachings] = await Promise.all([ventesDesPlans().catch(() => [] as Vente[]), coachingsParMois()]);
  // Sous la 9.x, la clé Stripe en lecture seule qui manque dans Vercel n'est plus dite au coach : une ligne au journal.
  montrerLInfra(v9, `Chiffres : les coachings ne se lisent pas (${coachings.etat === 'a_brancher' ? 'la clé Stripe en lecture seule n’est pas posée dans Vercel' : 'la lecture des coachings n’est pas encore branchée'}).`);
  const choisies = ventesDe(ventes, periode);
  const t = total(choisies);
  const annee = periode.length === 4;
  const enMots = annee ? `en ${periode}` : `en ${nomDuMois(periode, false).toLowerCase()}`;
  const precedent = moisPrecedent(moisEnCours);
  const periodes: [string, string, string][] = [
    [moisEnCours, nomDuMois(moisEnCours), '/app/coach/chiffres'],
    ...(precedent.startsWith(moisEnCours.slice(0, 4)) ? [[precedent, nomDuMois(precedent, false), `/app/coach/chiffres?periode=${precedent}`] as [string, string, string]] : []),
    [moisEnCours.slice(0, 4), 'Sur l’année', '/app/coach/chiffres?periode=annee'],
  ];
  const lignes = parMois(ventes, moisEnCours);
  const anneeEntiere = total(ventesDe(ventes, moisEnCours.slice(0, 4)));
  // Les autres mois vendus, repliés sous la période choisie.
  const autresMois = annee ? [] : [...new Set(ventes.map((v) => moisDe(v.payeLe)))].filter((m) => m !== periode).sort().reverse();
  return (
    <CadreCoach actif="chiffres">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-extrabold tracking-tight">Chiffres</h1>
          {/* Maquette validée par le coach le 08/11/2026 */}
          <p className="mt-1.5 text-sm text-[#5E5C78]">Ta comptabilité : ce que les plans et les coachings ont encaissé.</p>
        </div>
        <nav aria-label="Période" className="inline-flex p-1 gap-1 rounded-[14px] bg-[#E6E9E1]">
          {periodes.map(([cle, titre, href]) => (
            <Link key={cle} href={href} aria-current={cle === periode ? 'page' : undefined}
              className={clsx('inline-flex items-center min-h-11 px-4 rounded-[11px] text-sm',
                cle === periode ? 'bg-white text-indigo font-extrabold shadow-sm' : 'text-[#4A4866] font-semibold')}>
              {titre}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <div className="bg-white rounded-[14px] border border-indigo/[0.08] p-4">
          <div className="text-[1.75rem] font-extrabold">{euros(t.centimes)}</div>
          <div className="text-[0.78rem] text-[#5E5C78]">plans · {t.ventes} vente{t.ventes > 1 ? 's' : ''} {enMots}</div>
        </div>
        <div className="bg-white rounded-[14px] border border-indigo/[0.08] p-4">
          <div className="text-[1.75rem] font-extrabold text-[#5E5C78]">—</div>
          <div className="text-[0.78rem] text-[#5E5C78]">{mots.chiffres.coachingsSous}</div>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-indigo/[0.08] p-5 space-y-3">
        <h2 className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-teal">Par mois</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-[0.6875rem] uppercase tracking-[0.08em] text-[#5E5C78]">
                <th className="py-2.5 pr-3 font-bold">Mois</th><th className="py-2.5 px-3 text-right font-bold">Plans</th>
                <th className="py-2.5 pl-3 text-right font-bold">Coachings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo/[0.06]">
              {lignes.map((m) => (
                <tr key={m.mois}>
                  <td className="py-3 pr-3 font-semibold whitespace-nowrap">{nomDuMois(m.mois)}{m.mois === moisEnCours ? ' (en cours)' : ''}</td>
                  <td className="py-3 px-3 text-right tabular-nums">{m.ventes ? `${euros(m.centimes)} · ${m.ventes}` : euros(0)}</td>
                  <td className="py-3 pl-3 text-right text-[#5E5C78]">—</td>
                </tr>
              ))}
              <tr>
                <td className="py-3 pr-3 font-bold whitespace-nowrap">{moisEnCours.slice(0, 4)}, à ce jour</td>
                <td className="py-3 px-3 text-right font-bold tabular-nums">{anneeEntiere.ventes ? `${euros(anneeEntiere.centimes)} · ${anneeEntiere.ventes}` : euros(0)}</td>
                <td className="py-3 pl-3 text-right text-[#5E5C78]">—</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[0.8125rem] text-[#5E5C78]">Montants encaissés, codes promo déduits ; les frais Stripe et les remboursements ne sont pas lus aujourd’hui.</p>
      </section>

      <PartiePlans ventes={choisies} autres={autresMois.map((m) => [m, ventesDe(ventes, m)] as const)} jour={jour} />

      <section className="bg-white rounded-2xl border border-indigo/[0.08] p-5 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-teal">Les coachings</h2>
          <span className="text-xs text-[#5E5C78]">payés par tes coachés par Stripe, via Nolio</span>
        </div>
        <p className="text-sm text-[#4A4866] leading-relaxed">
          {mots.chiffres.coachingsDetail(coachings.etat)}
        </p>
      </section>

      {/* La boussole des améliorations du moteur, repliée en bas (Q13 ; venue de l'onglet « Coaching individualisé »). */}
      <details className="group bg-white rounded-2xl border border-indigo/[0.08]">
        <summary className="cursor-pointer list-none min-h-14 px-5 flex items-center justify-between gap-3">
          <span className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-teal">Tes retouches dans Nolio</span>
          <span className="text-xs text-[#5E5C78]">Ouvrir <span aria-hidden className="inline-block group-open:rotate-90">›</span></span>
        </summary>
        <div className="px-1 pb-1 space-y-3">
          <PartieCoaching coachId={coach.compteId} />
        </div>
      </details>
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
            modifié, déplacé, supprimé ni ajouté dans Nolio. Elle doit monter au fil des dimanches.
          </p>
          {/* La cible (décision du coach du 16/11/2026) : au plus 15 % de semaines retouchées. */}
          <p className={clsx('text-sm font-semibold', cibleTenue(d) ? 'text-teal' : 'text-[#8A3326]')}>
            Cible : au plus {Math.round(100 * CIBLE_RETOUCHEES)} % de semaines retouchées. {cibleTenue(d)
              ? `Tenue (${pourcent(1 - (d.part as number))} retouchées).` : `Pas encore (${pourcent(1 - (d.part as number))} retouchées).`}
          </p>
          {c?.enCours?.semaines ? (
            <p className="text-sm text-[#3B3957]">
              Semaine en cours : {c.enCours.intactes} sur {c.enCours.semaines} sans retouche pour l’instant ({pourcent(1 - (c.enCours.part as number))} retouchées).
            </p>
          ) : null}
          <p className="text-[0.8125rem] text-[#5E5C78]">
            Une semaine par athlète et par objectif ; les 4 semaines finies avant celle en cours, qui peut encore se retoucher.
          </p>
        </>
      )}
    </section>
  );
}

// Tes retouches dans Nolio (décision coach du 26/10/2026) : la part de ce que le moteur envoie que tu corriges, et
// où.
async function Retouches({ r, enCours }: { r: ChiffresCoaching['retouches']; enCours: string }) {
  const mots = motsDuCoach(await moteurEstV9().catch(() => false));
  const familles: Record<string, string> = { ...FAMILLE, ...mots.chiffres.famille };
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
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="text-left text-[0.6875rem] uppercase tracking-[0.08em] text-[#5E5C78]">
                  <th className="py-2.5 pr-3 font-bold">Semaine du</th><th className={th}>Semaines sans retouche</th><th className={th}>Séances envoyées</th>
                  <th className={th}>Modifiées</th><th className={th}>Dont déplacées</th><th className={th}>Supprimées</th><th className={th}>Part retouchée</th><th className={clsx(th, 'pr-0')}>Ajoutées</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo/[0.06]">
                {r.semaines.map((s) => (
                  <tr key={s.lundi}>
                    <td className="py-3 pr-3 font-semibold whitespace-nowrap">{date(s.lundi)}{s.lundi === enCours ? ' (en cours)' : ''}</td>
                    <td className={td}>{s.semaines ? `${s.intactes} / ${s.semaines}` : '—'}</td>
                    <td className={td}>{s.envoyees}</td><td className={td}>{s.modifiees}</td><td className={td}>{s.deplacees}</td><td className={td}>{s.supprimees}</td>
                    <td className={clsx(td, 'font-bold')}>{part(s.modifiees + s.supprimees, s.envoyees)}</td>
                    <td className={clsx(td, 'pr-0')}>{s.ajoutees}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="pt-2 text-sm font-bold">Par famille, 4 dernières semaines</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="text-left text-[0.6875rem] uppercase tracking-[0.08em] text-[#5E5C78]">
                  <th className="py-2.5 pr-3 font-bold">Famille</th><th className={th}>Envoyées</th><th className={th}>Modifiées</th>
                  <th className={th}>Dont déplacées</th><th className={th}>Supprimées</th><th className={th}>Part retouchée</th><th className={clsx(th, 'pr-0')}>Durée des modifiées</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo/[0.06]">
                {r.familles.map((f) => (
                  <tr key={f.famille}>
                    <td className="py-3 pr-3 font-semibold">{familles[f.famille]}</td>
                    <td className={td}>{f.envoyees}</td><td className={td}>{f.modifiees}</td><td className={td}>{f.deplacees}</td><td className={td}>{f.supprimees}</td>
                    <td className={clsx(td, 'font-bold')}>{part(f.modifiees + f.supprimees, f.envoyees)}</td>
                    <td className={clsx(td, 'pr-0')}>{ecart(f.ecart)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="text-[0.8125rem] text-[#5E5C78]">{mots.chiffres.retouches}</p>
    </section>
  );
}

// « Les plans » (Q13 « A ») : les ventes de la période, une ligne chacune, les autres mois repliés ; puis, repliés, le tunnel
// de la vente, les portes et les acheteurs (avec « Modifier l'objectif » et « Arrêter cette préparation »).
const STATUT_VENTE = (v: Vente) => (v.arretee ? 'Arrêtée, remboursée' : STATUT_NOLIO[v.statut ?? ''] ?? (v.statut ? 'Nolio' : 'Pas encore rangé'));
function LigneVente({ v }: { v: Vente }) {
  return (
    <li className="flex flex-wrap justify-between gap-x-3 gap-y-1 py-2.5 text-sm">
      <span className="text-indigo"><strong>{v.nom ?? 'Acheteur'}</strong>{v.course ? ` · ${v.course}` : ''}{v.formule ? ` · formule ${v.formule} mois` : ''}</span>
      <span className="text-[#4A4866]"><strong className="text-indigo tabular-nums">{euros(v.centimes)}</strong> · {date(v.payeLe.slice(0, 10))} · {STATUT_VENTE(v)}</span>
    </li>
  );
}
function Replie({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <details className="group border-t border-indigo/[0.07]">
      <summary className="cursor-pointer list-none min-h-12 flex items-center justify-between gap-3 text-sm font-semibold text-indigo">
        <span>{titre}</span><span className="text-xs text-[#5E5C78]">Voir <span aria-hidden className="inline-block group-open:rotate-90">›</span></span>
      </summary>
      <div className="pb-3 space-y-2">{children}</div>
    </details>
  );
}

async function PartiePlans({ ventes, autres, jour }: { ventes: Vente[]; autres: (readonly [string, Vente[]])[]; jour: string }) {
  const mots = motsDuCoach(await moteurEstV9().catch(() => false));
  const semaines = await chiffresParSemaine();
  const acheteurs = await acheteursDesPlans().catch(() => []);
  return (
    <section className="bg-white rounded-2xl border border-indigo/[0.08] p-5 space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-teal">Les plans</h2>
        <span className="text-xs text-[#5E5C78]">vendus sur le site, encaissés sur ton Stripe</span>
      </div>
      {ventes.length === 0 ? <p className="py-1 text-sm text-[#5E5C78]">Aucune vente sur cette période.</p> : (
        <ul className="divide-y divide-indigo/[0.06]">{ventes.map((v) => <LigneVente key={v.id} v={v} />)}</ul>
      )}
      {autres.map(([mois, liste]) => (
        <Replie key={mois} titre={`${nomDuMois(mois, mois.slice(0, 4) !== jour.slice(0, 4))} : ${liste.length} vente${liste.length > 1 ? 's' : ''}`}>
          <ul className="divide-y divide-indigo/[0.06]">{liste.map((v) => <LigneVente key={v.id} v={v} />)}</ul>
        </Replie>
      ))}

      <Replie titre="Le tunnel de la vente, 12 semaines">
        <p className="text-sm text-indigo/70 leading-relaxed">{mots.chiffres.tunnel}</p>
        {semaines.length === 0 ? (
          <p className="text-sm text-indigo/70">Rien encore : les chiffres arrivent avec les premières visites.</p>
        ) : (
          <div className="overflow-x-auto">
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
      </Replie>

      {/* Les portes (P6) : combien de visites bloquent sur chacune, semaine par semaine. */}
      <Replie titre="Les portes du questionnaire">
        <p className="text-sm text-indigo/70 leading-relaxed">
          Les portes : combien de visites bloquent sur chacune, une fois par visite, avant le paiement. C’est ce que
          chaque porte coûte en ventes.
        </p>
        {semaines.length > 0 && (
          <div className="overflow-x-auto">
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
        )}
      </Replie>

      {/* Les acheteurs (décision coach du 22/10/2026) : à part du coaching, en lecture ; leur accord est le leur. */}
      <Replie titre={`Les acheteurs (${acheteurs.length})`}>
        <p className="text-sm text-indigo/70">
          Leurs séances partent toutes seules dans Nolio. Leur accord de lecture, ils le donnent eux-mêmes dans l’app. Une
          course qui change de date avant son départ : « Modifier l’objectif ». Un acheteur remboursé : « Arrêter cette
          préparation », puis le remboursement dans Stripe.
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
                {!a.demarre && a.statut !== 'coaching' && a.statut !== 'sorti' && a.date >= jour && (
                  <Link href={`/app/coach/nouveau?modifier=${a.id}`} className="basis-full inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal">
                    Modifier l’objectif ›
                  </Link>
                )}
                {/* E3 (audits du 05/11/2026) : un acheteur remboursé ; plus rien ne s'écrit ni ne part. */}
                {a.statut !== 'coaching' && a.statut !== 'sorti' && a.date >= ajouterJours(jour, -42) && <ArreterPreparation planId={a.id} nom={a.nom} />}
              </li>
            ))}
          </ul>
        )}
      </Replie>
    </section>
  );
}

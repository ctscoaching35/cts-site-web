import Link from 'next/link';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import { Carte } from '@/components/app/Ui';
import { AnnulerSemaine, ReessayerSemaine } from '@/components/app/GestesEcriture';
import { cetteSemaine, type CarteCoache } from '@/lib/app/cetteSemaine';
import { equipeNolio, type ARegarder, type Niveau } from '@/lib/app/espaceCoach';
import { marquerRegle } from '@/lib/app/actionsCoaching';
import { dateLongue, jourMois } from '@/lib/app/plan';
import { espaceCoachOuvert } from '@/lib/app/supabase';
import { exigerCoach } from '@/lib/app/nolio';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// « Cette semaine », l'accueil de l'espace coach (EC1, refonte par exception, décision coach du 04/11/2026, « A » ;
// lib/app/cetteSemaine.ts) : le bilan du dimanche, puis une carte par coaché qui a besoin de lui (décision coach du
// 04/11/2026, relecture écran par écran), ses raisons regroupées et un seul geste ; ce que le moteur a réglé seul, une
// ligne par coaché et par semaine, replié ; ce qui arrive ; les autres ne s'affichent pas. Pensée pour le téléphone
// d'abord (EC5).
const RAISON: Partial<Record<Niveau, string>> = { bloque: 'Ce qui bloque', sante: 'Santé', arrive: 'À venir' };
const PASTILLE: Partial<Record<Niveau, string>> = {
  bloque: 'bg-[#F6E1DD] text-[#8A3326]', sante: 'bg-[#F6E3E8] text-[#8A2E4A]', arrive: 'bg-[#E3EFE9] text-[#22604F]',
};
const bouton = 'inline-flex items-center justify-center min-h-11 px-4 rounded-xl text-[0.8125rem] font-bold whitespace-nowrap';
const pastille = 'text-[0.6875rem] font-bold px-2 py-0.5 rounded-full';

function Geste({ r, plein }: { r: ARegarder; plein: boolean }) {
  const style = plein ? `${bouton} bg-teal text-white` : `${bouton} bg-white text-indigo border border-indigo/20 hover:bg-sand`;
  if (r.genre === 'semaine' && r.planId) return <ReessayerSemaine planId={r.planId} />;
  if (r.externe) return <a href={r.href} target="_blank" rel="noopener" className={style}>{r.action}</a>;
  return <Link href={r.href} className={style}>{r.action}</Link>;
}

function Regle({ cles }: { cles: string[] }) {
  return (
    <form action={marquerRegle.bind(null, cles)}>
      <button type="submit" className={`${bouton} text-[#5E5C78] hover:text-indigo hover:bg-sand`}>Réglé</button>
    </form>
  );
}

// La carte d'un coaché : ses raisons, ce qui bloque d'abord, puis la santé ; le geste de la première ; « Réglé » pour toutes.
function CarteDuCoache({ c, plein }: { c: CarteCoache; plein: boolean }) {
  const groupes = (['bloque', 'sante'] as const).map((n) => [n, c.raisons.filter((r) => r.niveau === n)] as const).filter(([, rs]) => rs.length);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3.5 border-t first:border-t-0 border-indigo/[0.07]">
      <div className="min-w-0 flex-[1_1_300px] space-y-1.5">
        <span className="block font-bold">{c.athlete}</span>
        {groupes.map(([n, rs]) => (
          <div key={n} className="flex flex-wrap items-start gap-x-2 gap-y-1">
            <span className={`${pastille} mt-0.5 ${PASTILLE[n]}`}>{RAISON[n]}</span>
            <ul className="min-w-0 flex-[1_1_220px] space-y-0.5 text-sm text-[#4A4866] leading-snug">
              {rs.map((r) => <li key={r.cle} className="first-letter:uppercase">{r.texte}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Geste r={c.raisons[0]} plein={plein} />
        <Regle cles={c.raisons.map((r) => r.cle)} />
      </div>
    </li>
  );
}

// Une ligne d'« À venir ».
function Ligne({ r }: { r: ARegarder }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3.5 border-t first:border-t-0 border-indigo/[0.07]">
      <div className="min-w-0 flex-[1_1_300px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold">{r.athlete}</span>
          <span className={`${pastille} ${PASTILLE[r.niveau]}`}>{RAISON[r.niveau]}</span>
        </div>
        <p className="mt-1 text-sm text-[#4A4866] leading-snug first-letter:uppercase">{r.texte}</p>
      </div>
      <div className="flex items-center gap-2">
        <Geste r={r} plein={false} />
        <Regle cles={[r.cle]} />
      </div>
    </li>
  );
}

export default async function CetteSemaine() {
  if (!espaceCoachOuvert()) notFound();
  const coach = await exigerCoach();
  const { nolio } = await equipeNolio();
  const s = await cetteSemaine(coach.compteId, nolio ? new Set(nolio.map((x) => x.id)) : null);
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  return (
    <CadreCoach actif="semaine" aRegarder={s.cartes.length}>
      <div>
        <h1 className="text-[1.75rem] font-extrabold tracking-tight">Cette semaine</h1>
        <p className="mt-1.5 text-sm text-[#5E5C78] first-letter:uppercase">{dateLongue(jour)} · qui a besoin de toi, et pourquoi</p>
      </div>

      {s.bilan && (
        <Link href="/app/coach/dimanche" className="flex items-center justify-between gap-3 bg-indigo text-white rounded-[14px] p-4">
          <span className="text-sm">
            <strong>Dimanche {jourMois(s.bilan.dimanche)}</strong> : {s.bilan.parties} semaine{s.bilan.parties > 1 ? 's' : ''} partie{s.bilan.parties > 1 ? 's' : ''},{' '}
            {s.bilan.pasParties} pas partie{s.bilan.pasParties > 1 ? 's' : ''}.
          </span>
          <span className="text-xs text-[#D6D5E6] whitespace-nowrap">Détail ›</span>
        </Link>
      )}

      <Carte className="!p-5">
        <h2 className="text-[0.8125rem] font-extrabold tracking-[0.1em] uppercase text-[#8A3326]">
          À regarder · {s.cartes.length} coaché{s.cartes.length > 1 ? 's' : ''} sur {s.coaches}
        </h2>
        {s.cartes.length === 0 ? <p className="mt-2 text-sm text-teal font-semibold">Personne n’a besoin de toi pour l’instant.</p> : (
          <ul className="mt-1">{s.cartes.map((c, i) => <CarteDuCoache key={c.athlete} c={c} plein={i === 0} />)}</ul>
        )}
        {!s.signaux && (
          <p className="mt-3 text-xs text-[#5E5C78]">
            Les signaux de la semaine (commentaires, sensations, Hooper, rien de remonté) ne sont pas encore gardés : la migration
            du 04/11/2026 est à passer dans Supabase.
          </p>
        )}
      </Carte>

      <Carte className="!p-5">
        <details>
          <summary className="cursor-pointer min-h-11 flex items-center justify-between gap-3">
            <span className="text-[0.8125rem] font-extrabold tracking-[0.1em] uppercase text-[#6E4A0C]">Le moteur s’en est chargé · {s.moteur.length}</span>
            <span className="text-xs text-[#5E5C78]">Relire ›</span>
          </summary>
          <p className="text-[0.8125rem] text-[#5E5C78]">Ses décisions des semaines écrites ces 8 derniers jours, qui ne demandent rien. Chacune s’annule sur la dernière semaine écrite.</p>
          {s.moteur.length > 0 && (
            <ul className="mt-2">
              {s.moteur.map((l) => (
                <li key={`${l.athlete}-${l.lundi ?? l.planId}`} className="py-3 border-t first:border-t-0 border-indigo/[0.07] space-y-1 text-sm">
                  <div>
                    <Link href={`/app/coach/plan/${l.planId}`} className="font-bold hover:underline">{l.athlete}</Link>
                    <span className="text-[#4A4866]"> · {l.lundi ? `semaine du ${jourMois(l.lundi)}` : `semaine ${l.ajustements[0].numero.slice(1)}`}{l.raisons.length > 0 && ` · ${l.raisons.join(', ')}`}</span>
                  </div>
                  {l.ajustements.filter((a) => a.raisons.length > 0 && a.annulable).map((a) => <AnnulerSemaine key={a.planId} planId={a.planId} numero={a.numero} />)}
                  {l.ajustements.flatMap((a) => a.allegees.map((j) => (
                    <p key={`${a.planId}-${j.id}`} className="text-[#4A4866]">
                      {j.nom} allégée en EF (fatigue franche) ·{' '}
                      <Link href={`/app/garder?plan=${a.planId}&seance=${encodeURIComponent(j.id)}`} className="font-semibold text-teal">Garder la séance d’origine</Link>
                    </p>
                  )))}
                </li>
              ))}
            </ul>
          )}
        </details>
      </Carte>

      {s.aVenir.length > 0 && (
        <Carte className="!p-5">
          <details>
            <summary className="cursor-pointer min-h-11 flex items-center justify-between gap-3">
              <span className="text-[0.8125rem] font-extrabold tracking-[0.1em] uppercase text-[#22604F]">À venir, rien d’urgent · {s.aVenir.length}</span>
              <span className="text-xs text-[#5E5C78]">Voir ›</span>
            </summary>
            <ul className="mt-1">{s.aVenir.map((r) => <Ligne key={r.cle} r={r} />)}</ul>
          </details>
        </Carte>
      )}

      <Link href="/app/coach/mes-athletes" className="flex items-center justify-between gap-3 text-sm text-[#4A4866]">
        <span>{s.calmes} coaché{s.calmes > 1 ? 's' : ''} sans rien à signaler.</span>
        <span className="font-bold text-teal whitespace-nowrap">Mes athlètes ›</span>
      </Link>
    </CadreCoach>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import { Carte } from '@/components/app/Ui';
import { AnnulerSemaine, ReessayerSemaine } from '@/components/app/GestesEcriture';
import { cetteSemaine } from '@/lib/app/cetteSemaine';
import { equipeNolio, type ARegarder } from '@/lib/app/espaceCoach';
import { marquerRegle } from '@/lib/app/actionsCoaching';
import { dateLongue, jourMois } from '@/lib/app/plan';
import { clientService, supabaseConfigure } from '@/lib/app/supabase';
import { exigerCoach } from '@/lib/app/nolio';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// « Cette semaine », l'accueil de l'espace coach (EC1, refonte par exception, décision coach du 04/11/2026, « A » ;
// lib/app/cetteSemaine.ts) : le bilan du dimanche, puis une ligne par coaché qui a besoin de lui, la raison en une phrase
// et le geste en un clic ; ce que le moteur a réglé seul, replié ; ce qui arrive ; les autres ne s'affichent pas. Pensée
// pour le téléphone d'abord (EC5) : des cartes, un geste par ligne.
const RAISON: Record<string, string> = {
  bloque: 'Ce qui bloque', sante: 'Santé', moteur: 'Le moteur', arrive: 'À venir',
};
const PASTILLE: Record<string, string> = {
  bloque: 'bg-[#F6E1DD] text-[#8A3326]', sante: 'bg-[#F6E3E8] text-[#8A2E4A]', moteur: 'bg-[#F6ECD8] text-[#6E4A0C]', arrive: 'bg-[#E3EFE9] text-[#22604F]',
};
const bouton = 'inline-flex items-center justify-center min-h-11 px-4 rounded-xl text-[0.8125rem] font-bold whitespace-nowrap';

function Geste({ r, plein }: { r: ARegarder; plein: boolean }) {
  const style = plein ? `${bouton} bg-teal text-white` : `${bouton} bg-white text-indigo border border-indigo/20 hover:bg-sand`;
  if (r.genre === 'semaine' && r.planId) return <ReessayerSemaine planId={r.planId} />;
  if (r.externe) return <a href={r.href} target="_blank" rel="noopener" className={style}>{r.action}</a>;
  return <Link href={r.href} className={style}>{r.action}</Link>;
}

function Ligne({ r, plein = false }: { r: ARegarder; plein?: boolean }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3.5 border-t first:border-t-0 border-indigo/[0.07]">
      <div className="min-w-0 flex-[1_1_300px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold">{r.athlete}</span>
          <span className={`text-[0.6875rem] font-bold px-2 py-0.5 rounded-full ${PASTILLE[r.niveau]}`}>{RAISON[r.niveau]}</span>
        </div>
        <p className="mt-1 text-sm text-[#4A4866] leading-snug first-letter:uppercase">{r.texte}</p>
      </div>
      <div className="flex items-center gap-2">
        <Geste r={r} plein={plein} />
        <form action={marquerRegle.bind(null, r.cle)}>
          <button type="submit" className={`${bouton} text-[#5E5C78] hover:text-indigo hover:bg-sand`}>Réglé</button>
        </form>
      </div>
    </li>
  );
}

export default async function CetteSemaine() {
  if (!supabaseConfigure()) notFound();
  const coach = await exigerCoach();
  const { data: compte } = await clientService().from('comptes').select('nom').eq('id', coach.compteId).maybeSingle();
  const { nolio } = await equipeNolio();
  const s = await cetteSemaine(coach.compteId, nolio ? new Set(nolio.map((x) => x.id)) : null);
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const decisions = s.moteur.length + s.ajustements.length;
  return (
    <CadreCoach actif="semaine" aRegarder={s.pourToi.length} coach={String(compte?.nom ?? '')}>
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
          À regarder · {new Set(s.pourToi.map((r) => r.athlete)).size} coaché{new Set(s.pourToi.map((r) => r.athlete)).size > 1 ? 's' : ''} sur {s.coaches}
        </h2>
        {s.pourToi.length === 0 ? <p className="mt-2 text-sm text-teal font-semibold">Personne n’a besoin de toi pour l’instant.</p> : (
          <ul className="mt-1">{s.pourToi.map((r, i) => <Ligne key={r.cle} r={r} plein={i === 0} />)}</ul>
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
            <span className="text-[0.8125rem] font-extrabold tracking-[0.1em] uppercase text-[#6E4A0C]">Le moteur s’en est chargé · {decisions}</span>
            <span className="text-xs text-[#5E5C78]">Relire ›</span>
          </summary>
          <p className="text-[0.8125rem] text-[#5E5C78]">Ses décisions, qui ne demandent rien. Chacune s’annule sur la dernière semaine écrite.</p>
          {s.ajustements.length > 0 && (
            <ul className="mt-2">
              {s.ajustements.map((a) => (
                <li key={`${a.planId}-${a.numero}`} className="py-3 border-t first:border-t-0 border-indigo/[0.07] space-y-1 text-sm">
                  <div>
                    <Link href={`/app/coach/plan/${a.planId}`} className="font-bold hover:underline">{a.nom}</Link>
                    <span className="text-[#4A4866]"> · {a.lundi ? `semaine du ${jourMois(a.lundi)}` : `semaine ${a.numero.slice(1)}`}{a.raisons.length > 0 && ` · ${a.raisons.join(', ')}`}</span>
                  </div>
                  {a.raisons.length > 0 && a.annulable && <AnnulerSemaine planId={a.planId} numero={a.numero} />}
                  {a.allegees.map((j) => (
                    <p key={j.id} className="text-[#4A4866]">
                      {j.nom} allégée en EF (fatigue franche) ·{' '}
                      <Link href={`/app/garder?plan=${a.planId}&seance=${encodeURIComponent(j.id)}`} className="font-semibold text-teal">Garder la séance d’origine</Link>
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          )}
          {s.moteur.length > 0 && <ul className="mt-2">{s.moteur.map((r) => <Ligne key={r.cle} r={r} />)}</ul>}
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

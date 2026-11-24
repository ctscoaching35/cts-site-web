import Link from 'next/link';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import { Carte } from '@/components/app/Ui';
import { lienNolioAthlete } from '@/lib/app/liensNolio';
import { moteurEstV9 } from '@/lib/app/moteurEnLigne';
import { exigerCoach } from '@/lib/app/nolio';
import { dateLongue } from '@/lib/app/plan';
import { lireLesSeriesDuSamedi, TEXTES_SERIES as T } from '@/lib/app/seriesDuSamedi';
import { motsDuCoach } from '@/lib/app/motsDuCoach';
import { espaceCoachOuvert } from '@/lib/app/supabase';

// Toujours calculée à la visite : la page lit la session du coach et la base du site.
export const dynamic = 'force-dynamic';

const aujourdhuiParis = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());

// « SÉRIES DU SAMEDI À RETIRER » (entrée 198 du coach, 24/11/2026) : une ligne par athlète dont « Ta semaine prochaine » est encore en place dans Nolio,
// construite par la base du site seule (lib/app/seriesDuSamedi.ts) : le site ne lit pas Nolio et n'y retire rien, c'est le coach qui retire. Les textes de
// cet écran sont NOUVEAUX : le coach les valide en le regardant, le 28/11/2026.
export default async function SeriesDuSamedi() {
  if (!espaceCoachOuvert()) notFound();
  const coach = await exigerCoach();
  const [series, enLigne] = await Promise.all([
    lireLesSeriesDuSamedi(coach.compteId, aujourdhuiParis()).catch(() => null),
    moteurEstV9().catch(() => false),
  ]);
  return (
    <CadreCoach actif="urgent">
      <div>
        <h1 className="text-[1.75rem] font-extrabold tracking-tight">{T.titre}</h1>
        <p className="mt-1.5 text-sm text-[#5E5C78]">{T.sousTitre}</p>
      </div>

      {!enLigne && (
        <Carte className="!p-5"><p className="text-sm text-[#8A3326] font-semibold">{T.pasEncore}</p></Carte>
      )}

      <Carte className="!p-5">
        <h2 className="text-[0.8125rem] font-extrabold tracking-[0.1em] uppercase text-teal">Dans Nolio</h2>
        <ol className="mt-2 list-decimal pl-5 space-y-1 text-sm text-[#4A4866]">
          {/* Sous la 9.x (décision 220 du coach, 24/11/2026) : « la question de fatigue du dimanche » et non « le Hooper » (lib/app/motsDuCoach.ts). */}
          {motsDuCoach(enLigne).series.marche.map((m) => <li key={m}>{m}</li>)}
        </ol>
      </Carte>

      {series === null ? (
        <Carte className="!p-5"><p className="text-sm text-[#8A3326] font-semibold">{T.pasLue}</p></Carte>
      ) : series.length === 0 ? (
        <Carte className="!p-5"><p className="text-sm text-teal font-semibold">{T.vide}</p></Carte>
      ) : (
        <Carte className="!p-5">
          <h2 className="text-[0.8125rem] font-extrabold tracking-[0.1em] uppercase text-[#8A3326]">{T.carte(series.length)}</h2>
          <ul className="mt-1">
            {series.map((s) => (
              <li key={s.cle} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-3 border-t first:border-t-0 border-indigo/[0.07]">
                <p className="min-w-0 flex-[1_1_300px] text-sm text-[#4A4866] leading-snug">
                  {s.athleteId
                    ? <Link href={`/app/coach/athlete/${s.athleteId}`} className="font-bold text-indigo hover:underline">{s.nom}</Link>
                    : s.planId
                      ? <Link href={`/app/coach/plan/${s.planId}`} className="font-bold text-indigo hover:underline">{s.nom}</Link>
                      : <span className="font-bold text-indigo">{s.nom}</span>}
                  {' · '}« Ta semaine prochaine » du <span className="font-semibold">{dateLongue(s.samedi)}</span>
                  <span className="block mt-0.5 text-xs text-[#5E5C78]">Le {dateLongue(s.dimanche)} si elle a été posée le samedi même.</span>
                </p>
                <a href={lienNolioAthlete(s.usr)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center min-h-11 px-4 rounded-[11px] bg-indigo text-white text-sm font-bold">{T.ouvrirNolio}</a>
              </li>
            ))}
          </ul>
        </Carte>
      )}
    </CadreCoach>
  );
}

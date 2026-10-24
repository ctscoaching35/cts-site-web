import Link from 'next/link';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import { Carte } from '@/components/app/Ui';
import { ReessayerSemaine } from '@/components/app/GestesEcriture';
import { equipeNolio, NIVEAUX, vueDuCoach } from '@/lib/app/espaceCoach';
import { clientService, supabaseConfigure } from '@/lib/app/supabase';
import { exigerCoach } from '@/lib/app/nolio';
import { marquerRegle } from '@/lib/app/actionsCoaching';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// La couleur de chaque niveau (décision coach du 21/10/2026, « une liste, quatre niveaux ») et ce qu'il veut dire.
const ENCRE = { bloque: '#8A3326', sante: '#8A2E4A', moteur: '#6E4A0C', arrive: '#22604F' } as const;
const COMPTE = { bloque: 'bg-[#F6E1DD] text-[#8A3326]', sante: 'bg-[#F6E1DD] text-[#8A3326]', moteur: 'bg-[#F6ECD8] text-[#6E4A0C]', arrive: 'bg-[#E3EFE9] text-[#22604F]' } as const;
const AIDE = {
  bloque: 'Rien ne part tant que ce n’est pas fait.',
  sante: 'Un arrêt, une fatigue franche, un mot : à regarder avant dimanche.',
  moteur: 'Ce que le moteur a changé seul, à relire.',
  arrive: 'Rien d’urgent : à préparer.',
} as const;

// « À regarder » (maquette validée par le coach le 24/10/2026) : sa propre page, seulement ce qui attend un geste du
// coach, du plus urgent au moins urgent ; une ligne disparaît dès que c'est réglé, ou d'un clic sur « Réglé » (décision
// coach du 24/10/2026 : ce point-là ne revient jamais, un nouveau point du même genre s'affiche).
export default async function ARegarderPage() {
  if (!supabaseConfigure()) notFound();
  const coach = await exigerCoach();
  const { data: compte } = await clientService().from('comptes').select('nom').eq('id', coach.compteId).maybeSingle();
  const { nolio } = await equipeNolio();
  const vue = await vueDuCoach(coach.compteId, nolio ? new Set(nolio.map((x) => x.id)) : null);
  const bouton = 'inline-flex items-center justify-center min-h-11 px-4 rounded-xl text-[0.8125rem] font-bold whitespace-nowrap';
  return (
    <CadreCoach actif="regarder" aRegarder={vue.aRegarder.length} coach={String(compte?.nom ?? '')}>
      <div>
        <h1 className="text-[1.75rem] font-extrabold tracking-tight">À regarder</h1>
        <p className="mt-1.5 text-sm text-[#5E5C78] leading-relaxed">
          Seulement ce qui attend un geste de toi, du plus urgent au moins urgent. Une ligne disparaît dès que c’est réglé,
          ou quand tu cliques « Réglé » : ce point-là ne revient pas, un nouveau s’affichera.
        </p>
      </div>
      {vue.aRegarder.length === 0 ? (
        <Carte className="!p-5"><p className="text-sm text-teal font-semibold">Rien qui attende ton regard.</p></Carte>
      ) : NIVEAUX.filter((n) => vue.aRegarder.some((r) => r.niveau === n.cle)).map((n) => {
        const items = vue.aRegarder.filter((r) => r.niveau === n.cle);
        return (
          <Carte key={n.cle} className="!p-5">
            <h2 className="flex items-center gap-2.5 text-[0.8125rem] font-extrabold tracking-[0.1em] uppercase" style={{ color: ENCRE[n.cle] }}>
              {n.titre} <span className={`text-xs font-extrabold rounded-full px-2 py-0.5 ${COMPTE[n.cle]}`}>{items.length}</span>
            </h2>
            <p className="mt-1 text-[0.8125rem] text-[#5E5C78]">{AIDE[n.cle]}</p>
            <ul className="mt-1">
              {items.map((r, i) => {
                // Le premier geste d'un groupe bloquant ou santé est en plein, les autres en contour.
                const plein = i === 0 && (n.cle === 'bloque' || n.cle === 'sante');
                const style = plein ? `${bouton} bg-teal text-white` : `${bouton} bg-white text-indigo border border-indigo/20 hover:bg-sand`;
                return (
                  <li key={r.cle} className="flex flex-wrap items-center justify-between gap-3 py-3.5 border-t first:border-t-0 border-indigo/[0.07]">
                    <div className="min-w-0 flex-[1_1_380px]">
                      <div className="font-bold">{r.athlete}</div>
                      <div className="mt-0.5 text-sm text-[#4A4866] leading-snug">{r.texte}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.genre === 'semaine' && r.planId ? <ReessayerSemaine planId={r.planId} />
                        : r.externe ? <a href={r.href} target="_blank" rel="noopener" className={style}>{r.action}</a>
                          : <Link href={r.href} className={style}>{r.action}</Link>}
                      <form action={marquerRegle.bind(null, r.cle)}>
                        <button type="submit" className={`${bouton} text-[#5E5C78] hover:text-indigo hover:bg-sand`}>Réglé</button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Carte>
        );
      })}
    </CadreCoach>
  );
}

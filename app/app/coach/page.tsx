import Link from 'next/link';
import clsx from 'clsx';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import { Carte, Surtitre } from '@/components/app/Ui';
import { vueDuCoach, type ARegarder } from '@/lib/app/espaceCoach';
import { dateLongue } from '@/lib/app/plan';
import { clientService, supabaseConfigure } from '@/lib/app/supabase';
import { athletesNolio, ErreurNolio, exigerCoach, nolioConfigure, type AthleteNolio } from '@/lib/app/nolio';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

const PASTILLE: Record<ARegarder['genre'], { libelle: string; fond: string; encre: string }> = {
  demande: { libelle: 'Objectif demandé', fond: '#E3EFE9', encre: '#0C6E5F' },
  ajustement: { libelle: 'Ajustement', fond: '#F6E3E8', encre: '#8A2E4A' },
  demarrer: { libelle: 'À démarrer', fond: '#E4E3EE', encre: '#2F2D4E' },
  nolio: { libelle: 'Nolio', fond: '#F6ECD8', encre: '#7A520D' },
};
const TON = { bien: '#0C6E5F', retrait: '#C2410C', retard: '#9A3B2C' } as const;

// L'espace coach, « Tes athlètes » (CTS_NOLIO_CADRAGE.md, N2 ; maquette validée par le coach le 19/10/2026) : réservé
// aux comptes de CTS_COACHS. Quatre compteurs, ce qui mérite son regard d'abord, puis tous ses athlètes ; en bas, ceux de
// Nolio qui n'ont pas encore de fiche.
export default async function Coach() {
  if (!supabaseConfigure()) notFound();
  const coach = await exigerCoach();
  const vue = await vueDuCoach(coach.compteId);
  const { data: compte } = await clientService().from('comptes').select('nom').eq('id', coach.compteId).maybeSingle();
  let nolio: AthleteNolio[] | null = null;
  let erreur: string | null = null;
  if (nolioConfigure()) {
    try {
      nolio = await athletesNolio();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('Athlètes Nolio :', message);
      erreur = e instanceof ErreurNolio ? message : 'Nolio ne répond pas pour l’instant : réessaie dans un moment.';
    }
  }
  // Les athlètes de Nolio qui n'ont pas encore de fiche (le coach lui-même, « (toi) », à part).
  const relies = new Set(vue.athletes.map((a) => a.usr).filter(Boolean));
  const sansFiche = (nolio ?? []).filter((x) => !relies.has(x.id) && !x.name.endsWith('(toi)'));
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const compteurs: [number, string, string][] = [
    [vue.athletes.length, `athlète${vue.athletes.length > 1 ? 's' : ''} coaché${vue.athletes.length > 1 ? 's' : ''}`, 'text-indigo'],
    [vue.enRoute, `objectif${vue.enRoute > 1 ? 's' : ''} en route dans Nolio`, 'text-indigo'],
    [vue.aRegarder.length, 'à regarder', vue.aRegarder.length ? 'text-[#9A3B2C]' : 'text-indigo'],
    [vue.demandes.length, `objectif${vue.demandes.length > 1 ? 's' : ''} demandé${vue.demandes.length > 1 ? 's' : ''} à valider`, 'text-teal'],
  ];
  return (
    <CadreCoach actif="athletes" demandes={vue.demandes.length} coach={String(compte?.nom ?? '')}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-extrabold tracking-tight">Tes athlètes</h1>
          <p className="mt-1.5 text-sm text-[#5E5C78] first-letter:uppercase">{dateLongue(jour)} · ce qui mérite ton regard d’abord</p>
        </div>
        <Link href="/app/coach/nouveau" className="inline-flex items-center min-h-12 px-5 rounded-xl bg-teal text-white text-sm font-bold">
          + Ajouter un athlète
        </Link>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        {compteurs.map(([n, texte, ton]) => (
          <div key={texte} className="bg-white rounded-[14px] border border-indigo/[0.08] p-4">
            <div className={clsx('text-[1.75rem] font-extrabold', ton)}>{n}</div>
            <div className="text-[0.78rem] text-[#5E5C78]">{texte}</div>
          </div>
        ))}
      </div>

      <Carte id="demandes" className="!p-5 scroll-mt-6">
        <Surtitre>À regarder</Surtitre>
        {vue.aRegarder.length === 0 ? (
          <p className="mt-3 text-sm text-teal font-semibold">Rien qui attende ton regard.</p>
        ) : (
          <ul className="mt-2">
            {vue.aRegarder.map((r, i) => (
              <li key={`${r.genre}-${r.athlete}-${i}`} className="flex flex-wrap items-center gap-3 min-h-14 py-2 border-b last:border-b-0 border-indigo/[0.06]">
                <span className="text-[0.72rem] font-bold px-2.5 py-1 rounded-xl" style={{ backgroundColor: PASTILLE[r.genre].fond, color: PASTILLE[r.genre].encre }}>
                  {PASTILLE[r.genre].libelle}
                </span>
                <span className="flex-[1_1_260px] text-sm"><strong>{r.athlete}</strong> · {r.texte}</span>
                <Link href={r.href} className="inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal">{r.action}</Link>
              </li>
            ))}
          </ul>
        )}
      </Carte>

      <Carte className="!p-5 !pb-2">
        <Surtitre>Tous tes athlètes</Surtitre>
        {vue.athletes.length === 0 ? (
          <p className="mt-3 pb-3 text-sm text-[#4A4866]">Aucun pour l’instant : ajoute ton premier athlète.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[1.3fr_1.6fr_0.8fr_1.3fr_0.9fr_1.3fr] gap-x-3 py-2.5 text-[0.656rem] font-bold tracking-[0.08em] uppercase text-[#5E5C78] border-b border-indigo/10">
                <span>Athlète</span><span>Objectif</span><span>Semaine</span><span>Préparation</span><span>Nolio · App</span><span>Ensuite</span>
              </div>
              {vue.athletes.map((a) => {
                const o = a.objectif;
                return (
                  <Link key={a.id} href={`/app/coach/athlete/${a.id}`}
                    className="grid grid-cols-[1.3fr_1.6fr_0.8fr_1.3fr_0.9fr_1.3fr] gap-x-3 items-center min-h-14 text-[0.84rem] border-b last:border-b-0 border-indigo/[0.06] hover:bg-sand/50">
                    <span className="font-bold">{a.nom}</span>
                    <span className={o ? '' : 'text-[#5E5C78]'}>{o ? `${o.course_nom} · ${dateLongue(o.course_date, true)}` : 'Aucun objectif'}</span>
                    <span className={o?.semaine ? '' : 'text-[#5E5C78]'}>{o?.semaine && o.total ? `S${o.semaine} / ${o.total}` : '—'}</span>
                    <span className="inline-flex items-center gap-2">
                      {o?.verdict ? (
                        <><span className="w-[9px] h-[9px] rounded-full" style={{ backgroundColor: TON[o.verdict.ton] }} aria-hidden />{o.verdict.libelle}</>
                      ) : (
                        <span className="text-[#5E5C78]">{!o ? '—' : !o.ecrit ? 'Envoyé en entier' : o.prevu ? `Démarre le ${dateLongue(o.prevu, true)}` : o.demarre ? 'Pas encore de semaine faite' : 'Pas encore démarré'}</span>
                      )}
                    </span>
                    <span className="font-bold">
                      <span className={a.nolio ? 'text-teal' : 'text-[#7A520D]'}>{a.nolio ? '✓' : 'à associer'}</span>
                      <span className="text-[#5E5C78] font-normal"> · </span>
                      <span className={a.app ? 'text-teal' : 'text-[#5E5C78] font-semibold'}>{a.app ? '✓' : 'à inviter'}</span>
                    </span>
                    <span className={clsx(a.ensuite.ton === 'rien' ? 'text-[#5E5C78]' : a.ensuite.ton === 'alerte' ? 'text-[#9A3B2C] font-semibold' : 'text-teal font-bold')}>
                      {a.ensuite.texte}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </Carte>

      <Carte className="!p-5 space-y-2">
        <Surtitre>Dans Nolio</Surtitre>
        {!nolioConfigure() ? (
          <p className="text-sm text-[#4A4866]">La clé de l’API Nolio manque dans Vercel (NOLIO_API_KEY).</p>
        ) : erreur ? (
          <p className="text-sm text-[#4A4866]">{erreur}</p>
        ) : (
          <details className="text-sm">
            <summary className="cursor-pointer min-h-11 flex items-center font-semibold text-indigo">
              {sansFiche.length ? `${sansFiche.length} athlète${sansFiche.length > 1 ? 's' : ''} de Nolio sans fiche ici` : 'Tous tes athlètes de Nolio ont leur fiche'}
            </summary>
            <ul className="pb-2 text-[#4A4866] divide-y divide-indigo/[0.06]">
              {sansFiche.map((x) => <li key={x.id} className="py-1.5">{x.name}</li>)}
            </ul>
          </details>
        )}
      </Carte>
    </CadreCoach>
  );
}

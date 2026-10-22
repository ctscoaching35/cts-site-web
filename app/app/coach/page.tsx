import Link from 'next/link';
import clsx from 'clsx';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import { Carte, Surtitre } from '@/components/app/Ui';
import { ReessayerSemaine } from '@/components/app/GestesEcriture';
import { NIVEAUX, vueDuCoach } from '@/lib/app/espaceCoach';
import { creerFicheDepuisNolio } from '@/lib/app/actionsCoaching';
import { usrAcheteurs } from '@/lib/app/acheteurs';
import { dateLongue, jMoins } from '@/lib/app/plan';
import { clientService, supabaseConfigure } from '@/lib/app/supabase';
import { athletesNolio, ErreurNolio, exigerCoach, nolioConfigure, type AthleteNolio } from '@/lib/app/nolio';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// La couleur de chaque niveau de « À regarder » (décision coach du 21/10/2026, « une liste, quatre niveaux »).
const ENCRE = { bloque: '#9A3B2C', sante: '#8A2E4A', moteur: '#2F2D4E', arrive: '#0C6E5F' } as const;
const TON = { bien: '#0C6E5F', retrait: '#C2410C', retard: '#9A3B2C' } as const;

// L'espace coach, « Tes athlètes » (CTS_NOLIO_CADRAGE.md, N2 ; maquette validée par le coach le 19/10/2026) : réservé
// aux comptes de CTS_COACHS. Quatre compteurs, ce qui mérite son regard d'abord, puis tous ses athlètes ; en bas, ceux de
// Nolio qui n'ont pas encore de fiche.
export default async function Coach() {
  if (!supabaseConfigure()) notFound();
  const coach = await exigerCoach();
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
  // L'équipe Nolio, pour dire qui l'a quittée ; sans réponse de Nolio, personne.
  const vue = await vueDuCoach(coach.compteId, nolio ? new Set(nolio.map((x) => x.id)) : null);
  // Les athlètes de Nolio qui n'ont pas encore de fiche (le coach lui-même, « (toi) », à part).
  const relies = new Set(vue.athletes.map((a) => a.usr).filter(Boolean));
  // Sans les acheteurs de plans (décision coach du 22/10/2026) : ils sont dans « Chiffres de la vente ».
  const acheteurs = await usrAcheteurs(coach.compteId).catch(() => new Set<string>());
  const sansFiche = (nolio ?? []).filter((x) => !relies.has(x.id) && !acheteurs.has(x.id) && !x.name.endsWith('(toi)'));
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
          <div className="mt-2 space-y-4">
            {NIVEAUX.filter((n) => vue.aRegarder.some((r) => r.niveau === n.cle)).map((n) => (
              <section key={n.cle}>
                <h3 className="text-[0.6875rem] font-bold tracking-[0.12em] uppercase" style={{ color: ENCRE[n.cle] }}>{n.titre}</h3>
                <ul className="mt-1">
                  {vue.aRegarder.filter((r) => r.niveau === n.cle).map((r, i) => (
                    <li key={`${r.genre}-${r.athlete}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 min-h-12 py-2 border-b last:border-b-0 border-indigo/[0.06]">
                      <span className="flex-[1_1_260px] text-sm"><strong>{r.athlete}</strong> · {r.texte}</span>
                      {r.genre === 'semaine' && r.planId ? <ReessayerSemaine planId={r.planId} />
                        : r.externe ? <a href={r.href} target="_blank" rel="noopener" className="inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal">{r.action}</a>
                          : <Link href={r.href} className="inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal">{r.action}</Link>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
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
                <span>Athlète</span><span>Objectif</span><span>Avant la course</span><span>Préparation</span><span>Nolio · App</span><span>Ensuite</span>
              </div>
              {vue.athletes.map((a) => {
                const o = a.objectif;
                return (
                  <Link key={a.id} href={`/app/coach/athlete/${a.id}`}
                    className="grid grid-cols-[1.3fr_1.6fr_0.8fr_1.3fr_0.9fr_1.3fr] gap-x-3 items-center min-h-14 text-[0.84rem] border-b last:border-b-0 border-indigo/[0.06] hover:bg-sand/50">
                    <span className="font-bold">
                      {a.nom}
                      {a.entree && (
                        <span className="ml-2 text-[0.72rem] font-bold px-2 py-0.5 rounded-lg bg-[#F6ECD8] text-[#7A520D] whitespace-nowrap">
                          Entrée {a.entree.faites}/{a.entree.total}
                        </span>
                      )}
                    </span>
                    <span className={o ? '' : 'text-[#5E5C78]'}>{o ? `${o.course_nom} · ${dateLongue(o.course_date, true)}` : 'Aucun objectif'}</span>
                    <span className={o && o.course_date >= jour ? '' : 'text-[#5E5C78]'}>{o && o.course_date >= jour ? jMoins(jour, o.course_date) : '—'}</span>
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
          <details className="text-sm" open={sansFiche.length > 0}>
            <summary className="cursor-pointer min-h-11 flex items-center font-semibold text-indigo">
              {sansFiche.length ? `${sansFiche.length} athlète${sansFiche.length > 1 ? 's' : ''} de Nolio sans fiche ici` : 'Tous tes athlètes de Nolio ont leur fiche'}
            </summary>
            {/* « Créer sa fiche » (décision coach du 22/10/2026) : d'un clic, déjà reliée à Nolio. */}
            <ul className="pb-2 text-[#4A4866] divide-y divide-indigo/[0.06]">
              {sansFiche.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span>{x.name}</span>
                  <form action={creerFicheDepuisNolio.bind(null, x.id)}>
                    <button type="submit" className="min-h-10 px-3 rounded-[10px] border border-teal text-teal text-[0.8125rem] font-bold">Créer sa fiche ›</button>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Carte>
    </CadreCoach>
  );
}

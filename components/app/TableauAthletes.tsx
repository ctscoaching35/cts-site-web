import Link from 'next/link';
import clsx from 'clsx';
import { Carte, Surtitre } from './Ui';
import type { LigneAthlete } from '@/lib/app/espaceCoach';
import { jMoins } from '@/lib/app/plan';

// Les pastilles et le signal de chaque ligne (maquette validée par le coach le 24/10/2026).
const PASTILLE = {
  ok: 'bg-[#E3EFE9] text-[#22604F]', warn: 'bg-[#F6ECD8] text-[#6E4A0C]', ko: 'bg-[#F6E1DD] text-[#8A3326]',
  neutre: 'bg-[#ECEBF2] text-[#4A4866]',
} as const;
const TENDANCE = { hausse: 'en hausse', baisse: 'en baisse', stable: 'stable' } as const;
const COLONNES = 'grid-cols-[1.35fr_1.35fr_1.15fr_0.7fr_1fr_0.85fr_1.3fr]';
// Une date courte, « 6 déc. », l'année si ce n'est pas celle d'aujourd'hui.
const dateCourte = (iso: string, jour: string) => new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'short', ...(iso.slice(0, 4) !== jour.slice(0, 4) ? { year: 'numeric' } : {}), timeZone: 'UTC',
}).format(new Date(`${iso}T12:00:00Z`));

// Les filtres du tableau : en route (démarré dans Nolio), à démarrer (écrit, pas encore parti), sans objectif à venir,
// en mode plan.
export type Filtre = 'tous' | 'route' | 'demarrer' | 'sans' | 'plan';
const FILTRES: [Filtre, string][] = [['tous', 'Tous'], ['route', 'En route'], ['demarrer', 'À démarrer'], ['sans', 'Sans objectif'], ['plan', 'Mode plan']];
export const filtreDe = (demande?: string): Filtre => FILTRES.find(([cle]) => cle === demande)?.[0] ?? 'tous';
function categorie(a: LigneAthlete, jour: string): Exclude<Filtre, 'tous'> {
  if (a.mode === 'plan') return 'plan';
  const o = a.objectif;
  if (!o || o.course_date < jour) return 'sans';
  return o.demarre ? 'route' : 'demarrer';
}

// « Tes athlètes » du tableau de bord : les filtres (un lien chacun, ?filtre=), puis une ligne par athlète.
export default function TableauAthletes({ athletes, jour, filtre, base = '/app/coach' }: {
  athletes: LigneAthlete[]; jour: string; filtre: Filtre; base?: string;
}) {
  const parCategorie = (f: Filtre) => f === 'tous' ? athletes.length : athletes.filter((a) => categorie(a, jour) === f).length;
  const lignes = athletes.filter((a) => filtre === 'tous' || categorie(a, jour) === filtre);
  return (
    <Carte className="!p-5 !pb-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Surtitre>Tes athlètes</Surtitre>
        <nav aria-label="Filtrer" className="flex flex-wrap gap-1.5">
          {FILTRES.map(([cle, titre]) => (
            <Link key={cle} href={cle === 'tous' ? base : `${base}?filtre=${cle}`} aria-current={cle === filtre ? 'true' : undefined}
              className={clsx('inline-flex items-center min-h-10 px-3 rounded-full text-[0.8125rem] border',
                cle === filtre ? 'bg-indigo text-white border-indigo font-bold' : 'bg-white text-[#4A4866] border-indigo/15 font-semibold hover:border-indigo/30')}>
              {titre} ({parCategorie(cle)})
            </Link>
          ))}
        </nav>
      </div>
      {athletes.length === 0 ? (
        <p className="mt-3 pb-3 text-sm text-[#4A4866]">Aucun pour l’instant : ajoute ton premier athlète.</p>
      ) : lignes.length === 0 ? (
        <p className="mt-3 pb-3 text-sm text-[#4A4866]">Personne dans ce filtre.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <div className="min-w-[900px]">
            <div className={clsx('grid gap-x-3 py-2.5 text-[0.656rem] font-bold tracking-[0.08em] uppercase text-[#5E5C78] border-b border-indigo/10', COLONNES)}>
              <span>Athlète</span><span>Objectif</span><span>Sa semaine</span><span>Séances</span><span>Charge tenue</span><span>Hooper</span><span>Signal</span>
            </div>
            <p className="py-1.5 text-[0.72rem] text-[#5E5C78] border-b border-indigo/[0.06]">
              Séances, charge tenue et Hooper : sa semaine passée. La semaine en cours est dans « Suivi des 7 jours ».
            </p>
            {lignes.map((a) => <Ligne key={a.id} a={a} jour={jour} />)}
          </div>
        </div>
      )}
    </Carte>
  );
}

// Une ligne du tableau : toute la ligne ouvre sa fiche.
function Ligne({ a, jour }: { a: LigneAthlete; jour: string }) {
  const o = a.objectif;
  const avenir = Boolean(o && o.course_date >= jour);
  const sous = 'block text-[0.72rem] text-[#5E5C78] mt-0.5';
  const pastille = 'inline-block text-[0.66rem] font-bold px-2 py-0.5 rounded-full whitespace-nowrap';
  const mode = a.mode === 'plan' ? ['Mode plan', PASTILLE.neutre] : a.aLaMain ? ['À la main', PASTILLE.warn] : ['Coaching', PASTILLE.ok];
  const manque = [!a.nolio && 'Nolio à associer', a.nolio && !a.accord && 'sans accord', !a.app && 'app à inviter'].filter(Boolean) as string[];
  // Sa semaine : sa place dans le plan, sinon où en est son objectif.
  const [semaine, bloc] = a.mode === 'plan' ? ['—', 'Rien ne s’écrit ici']
    // La saison de fond (décisions coach du 24/10/2026) : le thème de la semaine.
    : o?.fond && avenir ? [o.cours?.type === 'Assimilation' ? 'Semaine allégée' : o.fond.theme ? `Bloc ${o.fond.theme}` : 'Saison de fond',
      o.fond.tests_dans ? `tests dans ${o.fond.tests_dans} sem.` : 'semaine de tests']
    : !o || !avenir ? [a.aLaMain ? 'Programmé à la main' : 'Sans objectif', '']
      : o.cours && o.demarre ? [`${o.cours.numero} / ${o.total ?? '?'} · ${o.cours.type}`, o.cours.bloc]
        : !o.ecrit ? ['Envoyé en entier', '']
          : o.prevu ? [`Démarre le ${dateCourte(o.prevu, jour)}`, 'Programmé']
            : o.demarre ? ['Entre deux semaines', ''] : ['Pas encore démarré', ''];
  const s = a.semaine;
  return (
    <Link href={`/app/coach/athlete/${a.id}`}
      className={clsx('grid gap-x-3 items-center min-h-16 py-2 text-[0.84rem] border-b last:border-b-0 border-indigo/[0.06] hover:bg-sand/50', COLONNES)}>
      <span className="min-w-0">
        <span className="block font-bold">{a.nom}</span>
        <span className="mt-1 flex flex-wrap gap-1">
          <span className={clsx(pastille, mode[1])}>{mode[0]}</span>
          {a.entree && <span className={clsx(pastille, PASTILLE.warn)}>Entrée {a.entree.faites}/{a.entree.total}</span>}
          {a.mode !== 'plan' && manque.length > 0 && <span className={clsx(pastille, PASTILLE.neutre)}>{manque.join(' · ')}</span>}
        </span>
      </span>
      <span className={o ? '' : 'text-[#5E5C78]'}>
        {o ? o.course_nom : 'Aucun objectif'}
        {o && <span className={sous}>{o.fond ? `jusqu’au ${dateCourte(o.course_date, jour)}`
          : `${dateCourte(o.course_date, jour)}${avenir ? ` · ${jMoins(jour, o.course_date)}` : ' · couru'}`}</span>}
      </span>
      <span>
        {semaine}
        {bloc && <span className={sous}>{bloc}</span>}
      </span>
      <span className={s ? '' : 'text-[#5E5C78]'}>{s ? `${s.faites} / ${s.prevues}` : '—'}</span>
      <span className="inline-flex items-center gap-2">
        {s && s.tenue !== null ? (
          <>
            <span aria-hidden className="w-12 h-1.5 rounded-full bg-indigo/10 overflow-hidden">
              <span className={clsx('block h-full rounded-full', s.tenue >= 85 ? 'bg-teal' : s.tenue >= 65 ? 'bg-[#C8952E]' : 'bg-[#B4513F]')}
                style={{ width: `${Math.min(100, s.tenue)}%` }} />
            </span>
            {s.tenue} %
          </>
        ) : <span className="text-[#5E5C78]">—</span>}
      </span>
      <span className={a.hooper ? '' : 'text-[#5E5C78]'}>
        {a.hooper ? `${a.hooper.valeur}${a.hooper.tendance ? ` · ${TENDANCE[a.hooper.tendance]}` : ''}` : '—'}
      </span>
      <span><span className={clsx('inline-block text-[0.75rem] font-bold px-2.5 py-1 rounded-full', PASTILLE[a.signal.niveau])}>{a.signal.texte}</span></span>
    </Link>
  );
}

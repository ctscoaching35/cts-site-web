import Link from 'next/link';
import clsx from 'clsx';
import { Carte, Surtitre } from './Ui';
import type { EtatAthlete } from '@/lib/app/mesAthletes';
import type { Etiquette } from '@/lib/app/espaceParAthlete';
import type { Niveau as Couleur } from '@/lib/app/prevision';
import { SEMAINE_DE_REPRISE, typeCoteCoach } from '@/lib/app/nomsSeances';
import { ajouterJours, dateAbregee, jMoins } from '@/lib/app/plan';
import { texteCourtDeLaMontee } from '@/lib/app/tableau';

// Les pastilles et les étiquettes de chaque ligne (maquette validée par le coach le 24/10/2026, puis l'espace par athlète,
// maquette validée le 08/11/2026).
export const PASTILLE = {
  ok: 'bg-[#E3EFE9] text-[#22604F]', warn: 'bg-[#F6ECD8] text-[#6E4A0C]', ko: 'bg-[#F6E1DD] text-[#8A3326]',
  neutre: 'bg-[#ECEBF2] text-[#4A4866]',
} as const;
// Le point de couleur de « Dimanche » (Q1) : rouge, le moteur changera sa semaine ; orange, proche d'un seuil ; vert, elle
// suit le plan ; gris, rien de lu.
export const POINT: Record<Couleur, string> = { rouge: 'bg-[#B4513F]', orange: 'bg-[#C8952E]', vert: 'bg-[#0C6E5F]', rien: 'bg-[#A9A8BC]' };
const LEGENDE: [Couleur, string][] = [['rouge', 'le moteur changera sa semaine'], ['orange', 'proche d’un seuil'],
  ['vert', 'elle suit le plan'], ['rien', 'rien de lu']];
const TENDANCE = { hausse: 'en hausse', baisse: 'en baisse', stable: 'stable' } as const;
const COLONNES = 'grid-cols-[1.45fr_1.2fr_1.05fr_1.05fr_2.05fr_16px]';
// Une date courte, « 6 déc. », l'année si ce n'est pas celle d'aujourd'hui.
const dateCourte = (iso: string, jour: string) => new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'short', ...(iso.slice(0, 4) !== jour.slice(0, 4) ? { year: 'numeric' } : {}), timeZone: 'UTC',
}).format(new Date(`${iso}T12:00:00Z`));

// Les filtres du tableau : en route (démarré dans Nolio), à démarrer (écrit, pas encore parti), sans objectif à venir.
export type Filtre = 'tous' | 'route' | 'demarrer' | 'sans';
const FILTRES: [Filtre, string][] = [['tous', 'Tous'], ['route', 'En route'], ['demarrer', 'À démarrer'], ['sans', 'Sans objectif']];
export const filtreDe = (demande?: string): Filtre => FILTRES.find(([cle]) => cle === demande)?.[0] ?? 'tous';
function categorie(e: EtatAthlete, jour: string): Exclude<Filtre, 'tous'> {
  const o = e.a.objectif;
  if (!o || o.course_date < jour) return 'sans';
  return o.demarre ? 'route' : 'demarrer';
}

// « Tes athlètes » (l'accueil, maquette du 08/11/2026) : les filtres (un lien chacun, ?filtre=), puis une ligne par
// athlète, dans l'ordre de Nolio, alphabétique du prénom (09/11/2026) ; toute la ligne ouvre sa page. passee : le lundi de la
// semaine des chiffres (VueCoach.semainePassee).
export default function TableauAthletes({ lignes: toutes, jour, passee, filtre, base = '/app/coach' }: {
  lignes: EtatAthlete[]; jour: string; passee: string; filtre: Filtre; base?: string;
}) {
  const parCategorie = (f: Filtre) => f === 'tous' ? toutes.length : toutes.filter((e) => categorie(e, jour) === f).length;
  const lignes = toutes.filter((e) => filtre === 'tous' || categorie(e, jour) === filtre);
  // La semaine des chiffres (décision 2A du coach, 05/11/2026) : la dernière finie, du lundi au dimanche ; le dimanche, dès
  // le passage, celle qui finit ce soir (décision A du coach, 06/11/2026). « 1er nov. » finit déjà par son point.
  const dimanche = dateAbregee(ajouterJours(passee, 6));
  return (
    <Carte className="!p-5 !pb-3">
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
      {toutes.length === 0 ? (
        <p className="mt-3 pb-3 text-sm text-[#4A4866]">Aucun pour l’instant : ajoute ton premier athlète.</p>
      ) : lignes.length === 0 ? (
        <p className="mt-3 pb-3 text-sm text-[#4A4866]">Personne dans ce filtre.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <div className="min-w-[940px]">
            <div className={clsx('grid gap-x-3.5 py-2.5 text-[0.656rem] font-bold tracking-[0.08em] uppercase text-[#5E5C78] border-b border-indigo/10', COLONNES)}>
              <span>Athlète</span><span>Objectif</span><span>Sa semaine</span><span>Semaine passée</span><span>Ce qui l’attend</span><span />
            </div>
            {/* Validé par le coach le 06/11/2026 (1A) */}
            <p className="py-1.5 text-[0.72rem] text-[#5E5C78] border-b border-indigo/[0.06]">
              Séances, charge tenue et Hooper : semaine du {dateAbregee(passee)} au {dimanche}{dimanche.endsWith('.') ? '' : '.'}
            </p>
            {lignes.map((e) => <Ligne key={e.id} e={e} jour={jour} />)}
          </div>
        </div>
      )}
      {toutes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.72rem] text-[#5E5C78]">
          {LEGENDE.map(([c, texte]) => (
            <span key={c} className="inline-flex items-center gap-1.5"><span aria-hidden className={clsx('w-2.5 h-2.5 rounded-full', POINT[c])} />{texte}</span>
          ))}
        </div>
      )}
    </Carte>
  );
}

// Une étiquette de « Ce qui l'attend » et sa ligne de dessous.
export function EtiquetteAthlete({ e }: { e: Etiquette }) {
  return (
    <span className="block min-w-0">
      <span className={clsx('inline-block text-[0.75rem] font-bold px-2.5 py-0.5 rounded-full', PASTILLE[e.ton])}>{e.texte}</span>
      {e.detail && <span className="block mt-0.5 max-w-[250px] text-[0.72rem] leading-snug text-[#5E5C78] line-clamp-2">{e.detail}</span>}
    </span>
  );
}

// « Partie » / « Pas partie » (Q1 : à part de la couleur).
const Partie = ({ partie }: { partie: boolean }) => (
  <span className={clsx('inline-block text-[0.66rem] font-bold px-2 py-0.5 rounded-full whitespace-nowrap', partie ? PASTILLE.ok : PASTILLE.ko)}>
    {partie ? 'Partie' : 'Pas partie'}
  </span>
);

// Sa semaine : sa place dans le plan et « Partie / Pas partie » ; le dimanche après le passage, la semaine qui arrive,
// écrite ce soir (maquette du 08/11/2026). La saison de fond (décisions coach du 24/10/2026) : le thème de la semaine. Le
// type en mots (décisions coach du 08/11/2026) : « Semaine allégée », « Semaine de reprise ». Un plan démarré ne dit jamais
// « Démarre le … » (bogue du 05/11/2026).
export function SaSemaine({ e, jour }: { e: EtatAthlete; jour: string }) {
  const a = e.a;
  const o = a.objectif;
  const avenir = Boolean(o && o.course_date >= jour);
  const cours = o?.suivante ?? o?.cours ?? null;
  const partie = o?.suivante ? o.suivante.partie : o?.partie ?? null;
  const sous = 'block text-[0.72rem] text-[#5E5C78] mt-0.5';
  const [semaine, bloc] = o?.fond && avenir ? [cours?.reprise ? SEMAINE_DE_REPRISE : cours?.type === 'Assimilation' ? 'Semaine allégée'
      : o.fond.theme ? `Bloc ${o.fond.theme}` : 'Saison de fond',
      o.fond.tests_dans ? `tests dans ${o.fond.tests_dans} sem.` : 'semaine de tests']
    // Sa récupération, après la course (une semaine écrite au-delà de la trame).
    : o && !avenir && o.demarre && cours?.type === 'Récupération' ? ['Récupération', '']
      : !o || !avenir ? [a.aLaMain ? 'Programmé à la main' : 'Sans objectif', '']
        : cours && o.demarre ? [`${cours.numero.replace('S', '')} / ${o.total ?? '?'} · ${typeCoteCoach(cours.type, cours.reprise)}`, '']
          : !o.ecrit ? ['Envoyé en entier', '']
            : o.demarre ? ['Entre deux semaines', '']
              : o.prevu ? [`Démarre le ${dateCourte(o.prevu, jour)}`, 'Programmé'] : ['Pas encore démarré', ''];
  return (
    <span>
      {semaine}
      {(bloc || partie !== null) && (
        <span className={sous}>{bloc}{bloc && partie !== null ? ' · ' : ''}{partie !== null && <Partie partie={partie} />}</span>
      )}
    </span>
  );
}

// Une ligne du tableau : toute la ligne ouvre sa page (le lien de son nom, étiré sur la ligne).
function Ligne({ e, jour }: { e: EtatAthlete; jour: string }) {
  const a = e.a;
  const o = a.objectif;
  const avenir = Boolean(o && o.course_date >= jour);
  const sous = 'block text-[0.72rem] text-[#5E5C78] mt-0.5';
  const pastille = 'inline-block text-[0.66rem] font-bold px-2 py-0.5 rounded-full whitespace-nowrap';
  // Ce qui lui manque (« app à inviter » reste sur sa page, décision coach du 04/11/2026).
  const manque = [!a.nolio && 'Nolio à associer', a.nolio && !a.accord && 'sans accord'].filter(Boolean) as string[];
  return (
    <div className={clsx('relative grid gap-x-3.5 items-start min-h-16 py-3 text-[0.84rem] border-b last:border-b-0 border-indigo/[0.06] hover:bg-sand/50', COLONNES)}>
      <span className="min-w-0 flex gap-2.5">
        <span aria-hidden className={clsx('mt-[5px] w-2.5 h-2.5 rounded-full shrink-0', POINT[e.prevision.niveau])} />
        <span className="min-w-0">
          <Link href={`/app/coach/athlete/${a.id}`} className="block font-bold after:absolute after:inset-0 after:content-['']">{a.nom}</Link>
          <span className={sous}>{e.raison}</span>
          {(a.aLaMain || a.entree || (a.coache && manque.length > 0)) && (
            <span className="mt-1 flex flex-wrap gap-1">
              {a.aLaMain && <span className={clsx(pastille, PASTILLE.warn)}>À la main</span>}
              {a.entree && <span className={clsx(pastille, PASTILLE.warn)}>Entrée {a.entree.faites}/{a.entree.total}</span>}
              {a.coache && manque.length > 0 && <span className={clsx(pastille, PASTILLE.neutre)}>{manque.join(' · ')}</span>}
            </span>
          )}
        </span>
      </span>
      <span className={o ? '' : 'text-[#5E5C78]'}>
        {o ? o.course_nom : 'Aucun objectif'}
        {o && <span className={sous}>{o.fond ? `jusqu’au ${dateCourte(o.course_date, jour)}`
          : `${dateCourte(o.course_date, jour)}${avenir ? ` · ${jMoins(jour, o.course_date)}` : ' · couru'}`}</span>}
        {/* Sa montée, en forme courte (lot 2, réponses du coach du 12/11/2026 : le message de l'athlète, puis « B », court
            dans le tableau), tant que sa course est à venir. */}
        {o?.montee && avenir && !o.fond && <span className={clsx(sous, 'leading-snug')}>{texteCourtDeLaMontee(o.montee, o.route)}</span>}
      </span>
      <SaSemaine e={e} jour={jour} />
      <SemainePassee a={a} />
      <span className="min-w-0 flex flex-col gap-2">{e.etiquettes.map((x) => <EtiquetteAthlete key={x.texte} e={x} />)}</span>
      <span aria-hidden className="text-[#5E5C78]">›</span>
    </div>
  );
}

// « Semaine passée » : séances, charge tenue et Hooper, en une colonne (maquette du 08/11/2026). Des séances faites, aucun
// RPE noté : « sans RPE » à la place de sa charge (validé par le coach le 06/11/2026).
function SemainePassee({ a }: { a: EtatAthlete['a'] }) {
  const s = a.semaine;
  if (!s && !a.hooper) return <span className="text-[#5E5C78]">—</span>;
  return (
    <span className="flex flex-col gap-0.5">
      <span>{s ? `${s.faites} / ${s.prevues}` : '—'}</span>
      <span className="inline-flex items-center gap-2 text-[0.78rem]">
        {s?.sansRpe ? <span className="text-[#5E5C78]">sans RPE</span> : s && s.tenue !== null ? (
          <>
            <span aria-hidden className="w-12 h-1.5 rounded-full bg-indigo/10 overflow-hidden">
              <span className={clsx('block h-full rounded-full', s.tenue >= 85 ? 'bg-teal' : s.tenue >= 65 ? 'bg-[#C8952E]' : 'bg-[#B4513F]')}
                style={{ width: `${Math.min(100, s.tenue)}%` }} />
            </span>
            {s.tenue} %
          </>
        ) : null}
      </span>
      {a.hooper && <span className="text-[0.78rem] text-[#4A4866]">{a.hooper.valeur}{a.hooper.tendance ? ` · ${TENDANCE[a.hooper.tendance]}` : ''}</span>}
    </span>
  );
}

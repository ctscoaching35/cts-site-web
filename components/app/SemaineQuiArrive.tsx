import clsx from 'clsx';
import Link from 'next/link';
import BanniereSemaine from './BanniereSemaine';
import CeQuIlALu from './CeQuIlALu';
import PourquoiSemaine from './PourquoiSemaine';
import SuiteDeLObjectif from './SuiteDeLObjectif';
import { ReessayerSemaine } from './GestesEcriture';
import { Carte, Surtitre } from './Ui';
import type { Pourquoi, Realise } from '@/lib/app/ecriture';
import { rienDeLu } from '@/lib/app/derniereCourse';
import type { Lu } from './CeQuIlALu';
import { ajouterJours, type Semaine } from '@/lib/app/plan';
import type { Prevision } from '@/lib/app/prevision';
import { aujourdhuiIso } from '@/lib/app/plan';
import { septReponses, type LigneNolio, type Reponse, type SemaineComparee } from '@/lib/app/semaineDansNolio';
import { heureDe, heureDuPassage, jourDeLInstant, reponseAncienne, type SemaineQuiArrive } from '@/lib/app/semaineQuiArrive';
import { enHeures } from '@/lib/app/tableau';

// « Sa semaine qui arrive » (maquette validée par le coach le 08/11/2026, Q4 « A » ; les écrans de la doctrine, décision 11
// du coach du 09/11/2026) : la semaine à gauche, TELLE QU'ELLE EST DANS NOLIO une fois partie, chaque retouche marquée
// pour le coach, avec ce que le moteur avait écrit ; « Pourquoi cette semaine » en sept réponses à droite (empilé sur
// téléphone), à la place de « Ce que le moteur change » et d'« Annuler les ajustements » (retirés) ; la note « Ta semaine »
// et « Ce qu'il a lu » repliées dessous, l'aperçu complet en lien. Sans les sept réponses (un moteur d'avant 8.460),
// « Pourquoi cette semaine » reste replié dessous, comme avant. course : la date de sa course ; vers, le prochain objectif
// d'une saison de fond (son J-).
// TOUS LES TEXTES NOUVEAUX DE LA DÉCISION 11 SONT EN BROUILLON (à valider par le coach) : les marques, leurs sous-lignes,
// « Retouchée par toi », « Dans Nolio, tes retouches comprises · écrite … », « Lue dans Nolio à … », « écrit …, avant tes
// retouches », « La note « Ta semaine » qu’il a lue », « Manque : … », la phrase de Nolio muet.
type Vers = { date: string; nom: string } | null;

const pastille = 'text-[0.6875rem] font-bold px-2 py-0.5 rounded-full whitespace-nowrap';
const PAR_TOI = 'bg-[#F6ECD8] text-[#6E4A0C]';
const SANS_AUTEUR = 'bg-[#ECEBF2] text-[#4A4866]';

// Le jour d'une ligne, « Lun. 16/11 » : celui de la semaine écrite, sinon calculé.
function etiquetteDuJour(semaine: Semaine, iso: string) {
  const ecrit = semaine.jours.find((j) => j.date_iso === iso)?.date;
  if (ecrit) return ecrit;
  const d = new Date(`${iso}T12:00:00Z`);
  const j = d.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
  return `${j.charAt(0).toUpperCase()}${j.slice(1)}. ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

// La semaine telle que le moteur l'a écrite (l'aperçu, ou Nolio pas lu).
function JoursEcrits({ semaine }: { semaine: Semaine }) {
  return (
    <ul className="divide-y divide-indigo/10 text-sm">
      {semaine.jours.map((j) => (
        <li key={j.id} className="flex gap-3 px-1 py-2">
          <span className="w-[4.6rem] shrink-0 text-xs text-indigo/55 pt-0.5">{j.date}</span>
          <span className={j.famille === 'repos' ? 'text-indigo/40' : 'text-indigo font-semibold'}>
            {j.seance}
            {j.famille !== 'repos' && j.duree !== '—' && <span className="font-normal text-indigo/55"> · {j.duree}{j.rpe !== '—' ? ` · RPE ${j.rpe}` : ''}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

// Une séance telle qu'elle est dans Nolio, ses marques et ce que le moteur avait écrit.
function LigneDeNolio({ l }: { l: LigneNolio }) {
  return (
    <span className="block">
      <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
        {l.barree ? (
          <s className="font-medium text-indigo/45 decoration-[1.5px]">{l.nom}</s>
        ) : (
          <span className="font-semibold text-indigo">
            {l.nom}
            {(l.minutes || l.rpe !== null) && (
              <span className="font-normal text-indigo/55">{l.minutes ? ` · ${enHeures(l.minutes)}` : ''}{l.rpe !== null ? ` · RPE ${l.rpe}` : ''}</span>
            )}
          </span>
        )}
        {l.marques.map((m) => (
          <span key={`${m.quoi}-${m.texte}`} className={clsx(pastille, m.quoi === 'retiree' || m.quoi === 'deplacee' ? SANS_AUTEUR : PAR_TOI)}>{m.texte}</span>
        ))}
      </span>
      {l.marques.filter((m) => m.avant).map((m) => (
        <span key={`${m.quoi}-avant`} className="block mt-0.5 text-xs text-[#5E5C78]">{m.avant}</span>
      ))}
    </span>
  );
}

// La semaine telle qu'elle est dans Nolio, du lundi au dimanche ; un jour sans séance, « Repos ».
function JoursNolio({ semaine, comparee }: { semaine: Semaine; comparee: SemaineComparee }) {
  const lundi = semaine.lundi ?? comparee.lignes[0]?.date ?? '';
  const jours = Array.from({ length: 7 }, (_, i) => ajouterJours(lundi, i));
  return (
    <ul className="text-sm">
      {jours.map((iso) => {
        const du = comparee.lignes.filter((l) => l.date === iso);
        const touche = du.some((l) => l.marques.length > 0);
        return (
          <li key={iso} className={clsx('flex gap-3 px-1 py-2 border-t first:border-t-0 border-indigo/10', touche && 'bg-[#FFFBF2]')}>
            <span className="w-[4.6rem] shrink-0 text-xs text-indigo/55 pt-0.5">{etiquetteDuJour(semaine, iso)}</span>
            <span className="min-w-0 flex-1 space-y-1">
              {du.length ? du.map((l) => <LigneDeNolio key={l.cle} l={l} />) : <span className="text-indigo/40">Repos</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// « Pourquoi cette semaine » en sept réponses, une ligne chacune (doctrine de la semaine : « Ce que voit le coach ») ; la
// dernière (« Donc ») mise en avant ; une donnée manquante, sous sa réponse.
function SeptReponses({ reponses, sousTitre }: { reponses: Reponse[]; sousTitre: string | null }) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <Surtitre as="h3">Pourquoi cette semaine</Surtitre>
        {sousTitre && <span className="text-xs text-[#5E5C78]">{sousTitre}</span>}
      </div>
      <ol>
        {reponses.map((r, i) => {
          const donc = i === reponses.length - 1 && reponses.length > 1;
          return (
            <li key={`${r.n}-${r.libelle}`} className={clsx('grid grid-cols-[22px_minmax(0,1fr)] xl:grid-cols-[22px_96px_minmax(0,1fr)] gap-x-2.5 gap-y-0.5 items-start text-[0.85rem] leading-relaxed text-[#3B3957]',
              donc ? 'mt-1 rounded-xl bg-[#E1EFEA] p-2.5 pl-2' : 'py-2 border-t first:border-t-0 border-indigo/10')}>
              <span aria-hidden className={clsx('w-[22px] h-[22px] rounded-full flex items-center justify-center text-[0.6875rem] font-extrabold',
                donc ? 'bg-teal text-white' : 'bg-[#E4E3EE] text-indigo')}>{r.n}</span>
              <span className="font-bold text-indigo"><span className="sr-only">{r.n}. </span>{r.libelle}</span>
              <span className={clsx('col-start-2 xl:col-start-3 xl:row-start-1', donc && 'text-[#0B4A40] font-semibold')}>
                {r.texte}
                {r.manque.map((m) => (
                  <span key={m} className="mt-1.5 flex gap-2 items-start rounded-[10px] bg-[#FFF6E5] px-2.5 py-1.5 text-[0.8rem] font-semibold leading-snug text-[#7A520D]">
                    <span aria-hidden className="mt-px w-[18px] h-[18px] shrink-0 rounded-full bg-[#C8952E] text-white text-[0.6875rem] font-extrabold flex items-center justify-center">!</span>
                    <span>{m}</span>
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// fond : une saison de fond n'a pas de course (sa date est une sentinelle) : son J- compte vers son prochain objectif, s'il
// en a un (vers) ; une course passée (sa récupération) n'a pas de J-. lue : la semaine lue dans Nolio (une fois partie) ;
// erreur : Nolio n'a pas répondu ; ecriteLe : l'heure du passage ; reponses : les sept réponses, à droite.
function LaSemaine({ semaine, course, fond, vers, lue = null, erreur = null, ecriteLe = null, reponses, sousTitre = null }: {
  semaine: Semaine; course: string; fond: boolean; vers: Vers; lue?: { comparee: SemaineComparee; lue_le: string } | null;
  erreur?: string | null; ecriteLe?: string | null; reponses: Reponse[] | null; sousTitre?: string | null;
}) {
  const versLa = fond ? vers?.date : course;
  const jMoinsVers = versLa && semaine.lundi && versLa >= semaine.lundi ? versLa : undefined;
  const c = lue?.comparee ?? null;
  const marquee = Boolean(c?.lignes.some((l) => l.marques.length > 0));
  return (
    <div className="flex flex-wrap gap-5 items-start">
      <div className={clsx('flex-[1_1_340px] min-w-0 space-y-2', !reponses && 'max-w-2xl')}>
        <BanniereSemaine semaine={semaine} course={jMoinsVers} vers={fond && jMoinsVers ? vers?.nom : undefined}
          volume={c ? enHeures(c.volume_min) : undefined} seances={c ? c.seances_texte : undefined} />
        {c && marquee && ecriteLe && (
          <p className="text-xs text-[#5E5C78]">
            {c.retouchee ? 'Dans Nolio, tes retouches comprises' : 'Dans Nolio'} · écrite {jourDeLInstant(ecriteLe)} : {semaine.volume}, {semaine.seances}
          </p>
        )}
        {c ? <JoursNolio semaine={semaine} comparee={c} /> : <JoursEcrits semaine={semaine} />}
        {lue && (
          <p className="rounded-xl bg-sand px-3 py-2.5 text-[0.78rem] leading-relaxed text-[#4A4866]">
            Lue dans Nolio à {heureDe(lue.lue_le)}. Dimanche, tes retouches comptent comme les séances du moteur : chaque séance
            est lue par son contenu, quel que soit son nom{c && c.retirees > 0 ? ', et une séance retirée compte comme non faite' : ''}.
          </p>
        )}
        {erreur && <p className="text-[0.78rem] text-[#8A3326] font-semibold">{erreur}</p>}
      </div>
      {reponses && (
        <div className="flex-[1_1_300px] min-w-0">
          <SeptReponses reponses={reponses} sousTitre={sousTitre} />
        </div>
      )}
    </div>
  );
}

// La note « Ta semaine », repliée sous la carte : elle part dimanche avec la semaine et ne suit pas les retouches.
function NoteDeLaSemaine({ titre, textes }: { titre: string; textes: string[] }) {
  if (!textes.length) return null;
  return (
    <details className="group bg-white rounded-2xl border border-indigo/[0.08] p-5">
      <summary className="cursor-pointer list-none min-h-8 flex items-center justify-between gap-3">
        <Surtitre as="div">{titre}</Surtitre>
        <span className="text-xs text-[#5E5C78] whitespace-nowrap">Ouvrir <span aria-hidden className="inline-block group-open:rotate-90">›</span></span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-[#3B3957] whitespace-pre-line">{textes.join(' ')}</p>
    </details>
  );
}

// Le pourquoi d'avant (sans les sept réponses) et ce qu'il a lu, repliés.
function Replies({ pourquoi, lu, realise, ancienne }: { pourquoi: Pourquoi | null; lu: Lu | null; realise: Realise | null; ancienne: boolean }) {
  return (
    <>
      {pourquoi && <PourquoiSemaine pourquoi={pourquoi} />}
      {lu && <CeQuIlALu lu={lu} realise={realise} ancienne={ancienne} />}
    </>
  );
}

export default function SemainesQuiArrivent({ semaines, prevision, vers, aLaMain }: {
  semaines: SemaineQuiArrive[]; prevision: Prevision; vers: Vers; aLaMain: boolean;
}) {
  if (!semaines.length) {
    return aLaMain ? (
      <Carte id="semaine-qui-arrive" className="!p-5 space-y-2 scroll-mt-6">
        <Surtitre>Sa semaine qui arrive</Surtitre>
        <p className="text-sm text-[#4A4866]">Programmé à la main : le moteur n’écrit rien.</p>
      </Carte>
    ) : null;
  }
  return (
    <div id="semaine-qui-arrive" className="space-y-3 scroll-mt-6">
      {semaines.map((s) => {
        const versDe = s.fond ? vers : null;
        const apercuComplet = (
          <Link href={`/app/coach/plan/${s.planId}/apercu`} className="inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal">Ouvrir l’aperçu complet ›</Link>
        );
        if (s.etat === 'ecrite') {
          const l = s.ligne;
          const textes = l.bilan ? [l.bilan] : (l.notes ?? []).map((n) => n.texte);
          const r = l.revue ?? null;
          const lue = s.nolio && 'comparee' in s.nolio ? s.nolio : null;
          const retouchee = Boolean(lue?.comparee.retouchee);
          // Les sept réponses : celles que la semaine écrite porte (`semaine.pourquoi`, moteur 8.460), sinon le pourquoi
          // d'avant, replié.
          const reponses = septReponses((l.donnees as Semaine).pourquoi);
          return (
            <section key={s.planId} className="space-y-3">
              <Carte className="!p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Surtitre>Sa semaine qui arrive</Surtitre>
                  <span className={`${pastille} bg-[#E3EFE9] text-[#22604F]`}>Partie dans Nolio</span>
                  <span className="text-xs text-[#5E5C78]">{heureDuPassage(l.ecrite_le)}</span>
                  {retouchee && <span className={`${pastille} ${PAR_TOI}`}>Retouchée par toi</span>}
                </div>
                <LaSemaine semaine={l.donnees} course={s.course} fond={s.fond} vers={versDe} lue={lue}
                  erreur={s.nolio && 'erreur' in s.nolio ? s.nolio.erreur : null} ecriteLe={l.ecrite_le} reponses={reponses}
                  sousTitre={retouchee ? `écrit ${jourDeLInstant(l.ecrite_le)}, avant tes retouches` : `écrit ${heureDuPassage(l.ecrite_le)}`} />
              </Carte>
              <NoteDeLaSemaine titre="La note « Ta semaine » qu’il a lue" textes={textes} />
              {r ? (
                <Replies pourquoi={reponses ? null : r.pourquoi ?? null} lu={r.lu ?? null} realise={r.realise ?? null}
                  ancienne={reponseAncienne(r.lu?.questionnaire_du, l.ecrite_le)} />
              ) : (
                <p className="text-[0.8125rem] text-[#5E5C78]">
                  {s.revueGardee
                    ? 'Son « pourquoi » et ce qu’il a lu n’ont pas été gardés pour cette semaine : ils le sont à partir du prochain passage du dimanche.'
                    : 'Son « pourquoi » et ce qu’il a lu ne sont pas encore gardés au passage : la migration du 08/11/2026 est à passer.'}
                </p>
              )}
              {apercuComplet}
            </section>
          );
        }
        if (s.etat === 'pas_partie') {
          return (
            <Carte key={s.planId} className="!p-5 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Surtitre>Sa semaine qui arrive</Surtitre>
                {!s.laissee && <span className={`${pastille} bg-[#F6E1DD] text-[#8A3326]`}>Pas encore partie</span>}
              </div>
              {s.laissee ? (
                <p className="text-sm text-[#4A4866]">Semaine laissée : tu as déjà posé des séances cette semaine-là, elles restent les tiennes.</p>
              ) : s.ceSoir ? (
                <p className="text-sm text-[#4A4866]">Ce soir, elle se refait aux reprises de 20 h et 22 h ; lundi, ce qui manque encore est dans « Urgent », avec « Réessayer ».</p>
              ) : (
                <ReessayerSemaine planId={s.planId} />
              )}
              {apercuComplet}
            </Carte>
          );
        }
        const a = s.apercu;
        const sortie = a?.sortie;
        const reponses = sortie ? septReponses((sortie.semaine as Semaine).pourquoi) : null;
        return (
          <section key={s.planId} className="space-y-3">
            <Carte className="!p-5 space-y-3">
              <Surtitre>Sa semaine qui arrive</Surtitre>
              {!a && !s.erreur && (
                <>
                  {/* La phrase de « Dimanche » (Q1) : ce que le moteur prévoit d'après ses signaux du soir. */}
                  {prevision.prevoit && (
                    <p className="text-sm text-[#4A4866]">{prevision.prevoit}{prevision.pourquoi ? ` (${prevision.pourquoi})` : ''}.</p>
                  )}
                  <Link href={`?apercu=${s.planId}#semaine-qui-arrive`} scroll={false}
                    className="inline-flex items-center justify-center min-h-11 px-4 rounded-xl border border-teal text-teal text-[0.8125rem] font-bold">
                    Voir ce que le moteur écrirait
                  </Link>
                </>
              )}
              {s.erreur && <p className="text-sm text-[#8A3326] font-semibold">{s.erreur}</p>}
              {a && !sortie && <p className="text-sm font-semibold">{a.suite !== undefined ? <SuiteDeLObjectif suite={a.suite} /> : a.quoi}</p>}
              {a && sortie && (
                <>
                  <p className="text-sm text-[#5E5C78]">Calculée maintenant comme dimanche soir, avec ce qui est remonté dans Nolio. Rien n’est envoyé.</p>
                  <LaSemaine semaine={sortie.semaine} course={s.course} fond={s.fond} vers={versDe} reponses={reponses} />
                </>
              )}
            </Carte>
            {a && sortie && (
              <>
                <NoteDeLaSemaine titre="La note « Ta semaine » qu’il lira" textes={sortie.bilan ? [sortie.bilan] : sortie.notes.map((n) => n.texte)} />
                <Replies pourquoi={reponses ? null : sortie.pourquoi ?? null} realise={sortie.realise}
                  ancienne={reponseAncienne(a.retours?.questionnaire_du, aujourdhuiIso())}
                  lu={rienDeLu(a.retours) ? { sansRetours: true } : { questionnaire: a.retours?.questionnaire, questionnaire_du: a.retours?.questionnaire_du,
                    lues: a.retours?.lues, ...(a.premiere ? { premiere: true } : {}) }} />
              </>
            )}
            {apercuComplet}
          </section>
        );
      })}
    </div>
  );
}

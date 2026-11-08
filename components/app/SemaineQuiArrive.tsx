import Link from 'next/link';
import BanniereSemaine from './BanniereSemaine';
import CeQuIlALu from './CeQuIlALu';
import PourquoiSemaine from './PourquoiSemaine';
import SuiteDeLObjectif from './SuiteDeLObjectif';
import { AnnulerSemaine, ReessayerSemaine } from './GestesEcriture';
import { Carte, Surtitre } from './Ui';
import { PAS_UN_AJUSTEMENT, type Pourquoi, type Realise } from '@/lib/app/ecriture';
import { enClair } from '@/lib/app/journalEnClair';
import type { Lu } from './CeQuIlALu';
import type { Semaine } from '@/lib/app/plan';
import type { Prevision } from '@/lib/app/prevision';
import { aujourdhuiIso } from '@/lib/app/plan';
import { heureDuPassage, reponseAncienne, type SemaineQuiArrive } from '@/lib/app/semaineQuiArrive';

// « Sa semaine qui arrive » (maquette validée par le coach le 08/11/2026, Q4 « A ») : la semaine à gauche, ce que le moteur
// change et la note à droite (empilés sur téléphone), « Pourquoi » et « Ce qu'il a lu » repliés dessous, l'aperçu complet en
// lien. course : la date de sa course ; vers, le prochain objectif d'une saison de fond (son J-).
type Vers = { date: string; nom: string } | null;

const pastille = 'text-[0.6875rem] font-bold px-2 py-0.5 rounded-full whitespace-nowrap';

// fond : une saison de fond n'a pas de course (sa date est une sentinelle) : son J- compte vers son prochain objectif, s'il
// en a un (vers) ; une course passée (sa récupération) n'a pas de J-.
function LaSemaine({ semaine, journal, realise, textes, nomDe, annuler, course, fond, vers }: {
  semaine: Semaine; journal: Record<string, unknown>[]; realise: Realise | null; textes: string[];
  nomDe?: (id: string) => string | undefined; annuler: { planId: string; numero: string } | null; course: string; fond: boolean; vers: Vers;
}) {
  const noms = semaine.jours.map((j) => j.seance);
  const versLa = fond ? vers?.date : course;
  const jMoinsVers = versLa && semaine.lundi && versLa >= semaine.lundi ? versLa : undefined;
  const lignes = journal.flatMap((e) => enClair(e, noms, realise, nomDe));
  return (
    <div className="flex flex-wrap gap-5 items-start">
      <div className="flex-[1_1_340px] min-w-0 space-y-2">
        <BanniereSemaine semaine={semaine} course={jMoinsVers} vers={fond && jMoinsVers ? vers?.nom : undefined} />
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
      </div>
      <div className="flex-[1_1_300px] min-w-0 space-y-2">
        <h3 className="text-sm font-bold">Ce que le moteur change</h3>
        {lignes.length ? (
          <ul className="space-y-1.5 text-sm leading-relaxed text-[#3B3957] list-disc pl-5">{lignes.map((t, i) => <li key={i}>{t}</li>)}</ul>
        ) : <p className="text-sm text-[#3B3957]">Rien : la semaine suit le plan.</p>}
        {annuler && <AnnulerSemaine planId={annuler.planId} numero={annuler.numero} />}
        {textes.length > 0 && (
          <div className="pt-2">
            <p className="text-[0.8125rem] font-bold">La note « Ta semaine » qu’il lira</p>
            <p className="mt-1 text-sm leading-relaxed text-[#3B3957] whitespace-pre-line">{textes.join(' ')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Le pourquoi et ce qu'il a lu, repliés.
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
          const journal = l.sans_ajustement ? [] : l.journal ?? [];
          const ajustee = journal.some((e) => !PAS_UN_AJUSTEMENT.has(String(e.regle ?? '')));
          const textes = l.bilan ? [l.bilan] : (l.notes ?? []).map((n) => n.texte);
          const r = l.revue ?? null;
          return (
            <section key={s.planId} className="space-y-3">
              <Carte className="!p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Surtitre>Sa semaine qui arrive</Surtitre>
                  <span className={`${pastille} bg-[#E3EFE9] text-[#22604F]`}>Partie dans Nolio</span>
                  <span className="text-xs text-[#5E5C78]">{heureDuPassage(l.ecrite_le)}</span>
                </div>
                <LaSemaine semaine={l.donnees} journal={journal} realise={s.realise} textes={textes} nomDe={s.nomDe} course={s.course} fond={s.fond} vers={versDe}
                  annuler={ajustee && s.derniere && /^S\d+$/.test(l.numero) ? { planId: s.planId, numero: l.numero } : null} />
              </Carte>
              {r ? (
                <Replies pourquoi={r.pourquoi ?? null} lu={r.lu ?? null} realise={r.realise ?? null} ancienne={reponseAncienne(r.lu?.questionnaire_du, l.ecrite_le)} />
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
                  <LaSemaine semaine={sortie.semaine} journal={sortie.journal} realise={sortie.realise} nomDe={s.nomDe} course={s.course} fond={s.fond} vers={versDe}
                    textes={sortie.bilan ? [sortie.bilan] : sortie.notes.map((n) => n.texte)} annuler={null} />
                </>
              )}
            </Carte>
            {a && sortie && (
              <Replies pourquoi={sortie.pourquoi ?? null} realise={sortie.realise}
                ancienne={reponseAncienne(a.retours?.questionnaire_du, aujourdhuiIso())}
                lu={a.retours === null ? { sansRetours: true } : { questionnaire: a.retours?.questionnaire, questionnaire_du: a.retours?.questionnaire_du,
                  lues: a.retours?.lues, ...(a.premiere ? { premiere: true } : {}) }} />
            )}
            {apercuComplet}
          </section>
        );
      })}
    </div>
  );
}

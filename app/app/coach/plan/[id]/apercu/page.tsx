import Link from 'next/link';
import { notFound } from 'next/navigation';
import BanniereSemaine from '@/components/app/BanniereSemaine';
import CadreCoach from '@/components/app/CadreCoach';
import { Carte, Surtitre } from '@/components/app/Ui';
import { objectifCoache } from '@/lib/app/coaching';
import { apercuDuDimanche } from '@/lib/app/ecriture';
import { dose, enClair, FAMILLE, reponsesDuSamedi } from '@/lib/app/journalEnClair';
import PourquoiSemaine from '@/components/app/PourquoiSemaine';
import { exigerCoach } from '@/lib/app/nolio';
import { dateLongue, jourMois } from '@/lib/app/plan';
import { supabaseConfigure } from '@/lib/app/supabase';
import { CorrigerSemaine } from '@/components/app/GestesEcriture';
import { choixDeLaSemaine, CORRECTIONS_ACTIVES } from '@/lib/app/corrections';

// Toujours calculée à la visite : la page lit Nolio et demande la semaine au moteur, sans rien garder.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// L'aperçu du dimanche (lib/app/ecriture.apercuDuDimanche) : ce que le passage du dimanche ferait maintenant de cet
// objectif ; rien n'est envoyé.
export default async function ApercuDimanche({ params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigure()) notFound();
  const coach = await exigerCoach();
  const { id } = await params;
  const o = await objectifCoache(coach.compteId, id);
  if (!o) notFound();
  let a: Awaited<ReturnType<typeof apercuDuDimanche>> | null = null;
  let erreur: string | null = null;
  try {
    a = await apercuDuDimanche(id);
  } catch (e) {
    console.error(`Aperçu de ${id} :`, e instanceof Error ? e.message : e);
    erreur = 'Nolio ou le moteur ne répond pas pour l’instant : réessaie dans un moment.';
  }
  const sortie = a?.sortie;
  const lues = a?.retours?.lues;
  const textes = sortie ? (sortie.bilan ? [sortie.bilan] : sortie.notes.map((n) => n.texte)) : [];
  const r = sortie?.realise ?? null;
  // Une saison de fond n'a pas de course (sa date est une sentinelle à 40 semaines) : le J- compte vers son prochain
  // objectif (retour coach du 01/11/2026 : « J-278 », « je n'arrive pas à savoir si tu es sur un bloc de fond »).
  const prochain = o.plan.fond
    ? [...o.athlete.objectifs].filter((x) => x.plan_id !== id && x.course_date >= (a?.lundi ?? ''))
      .sort((x, y) => x.course_date.localeCompare(y.course_date))[0] ?? null
    : null;
  const seancesSemaine = sortie ? sortie.semaine.jours.map((j) => j.seance) : undefined;
  // EC3 : les corrections avant l'envoi, sur une semaine de préparation qui partira dimanche (interrupteur éteint : rien).
  const corrigeable = CORRECTIONS_ACTIVES && a?.quoi === 'Semaine' && Boolean(sortie);
  const choix = corrigeable && a ? await choixDeLaSemaine(id, a.lundi).catch(() => null) : null;
  return (
    <CadreCoach actif="athletes">
      <Link href={`/app/coach/plan/${id}`} className="inline-flex items-center min-h-9 text-[0.8125rem] font-bold text-teal">‹ {o.athlete.nom}</Link>
      <div className="!mt-2">
        <h1 className="text-[1.75rem] font-extrabold tracking-tight">Aperçu du dimanche</h1>
        <p className="mt-1.5 text-sm text-[#5E5C78] leading-relaxed">
          {a ? `La semaine du ${dateLongue(a.lundi, true)}, ` : ''}calculée maintenant comme dimanche soir, avec ce qui est
          remonté dans Nolio. Rien n’est envoyé. Ce qui sera couru ou rempli d’ici dimanche peut encore la changer.
        </p>
      </div>
      {erreur && <Carte className="!p-5"><p className="text-sm text-[#8A3326] font-semibold">{erreur}</p></Carte>}
      {a && !sortie && <Carte className="!p-5"><p className="text-sm font-semibold">{a.quoi}</p></Carte>}
      {sortie && (
        <>
          <Carte className="!p-5 space-y-3">
            <Surtitre>{a?.quoi === 'Semaine' ? 'La semaine qui partira' : a?.quoi}</Surtitre>
            <BanniereSemaine semaine={sortie.semaine} course={o.plan.fond ? prochain?.course_date : o.plan.course.date}
              vers={o.plan.fond ? prochain?.course_nom : undefined} />
            <ul className="bg-white divide-y divide-indigo/10 text-sm">
              {sortie.semaine.jours.map((j) => (
                <li key={j.id} className="flex gap-3 px-1 py-2">
                  <span className="w-[4.6rem] shrink-0 text-xs text-indigo/55 pt-0.5">{j.date}</span>
                  <span className={j.famille === 'repos' ? 'text-indigo/40' : 'text-indigo font-semibold'}>
                    {j.seance}
                    {j.famille !== 'repos' && j.duree !== '—' && <span className="font-normal text-indigo/55"> · {j.duree}{j.rpe !== '—' ? ` · RPE ${j.rpe}` : ''}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Carte>
          {corrigeable && a && (
            <Carte className="!p-5 space-y-2">
              <Surtitre>Corriger avant l’envoi</Surtitre>
              <p className="text-sm text-[#4A4866]">
                Ce que tu corrigerais dans Nolio, choisi ici : le moteur l’applique dimanche soir, et ta raison se compte dans
                « Chiffres ». Tu peux le retirer jusque-là.
              </p>
              <CorrigerSemaine planId={id} lundi={a.lundi} choix={choix} />
            </Carte>
          )}
          {sortie.pourquoi && <PourquoiSemaine pourquoi={sortie.pourquoi} />}
          <Carte className="!p-5 space-y-2">
            <Surtitre>Ce que le moteur change</Surtitre>
            {sortie.journal.length ? (
              <ul className="space-y-1.5 text-sm leading-relaxed text-[#3B3957] list-disc pl-5">
                {sortie.journal.flatMap((e, i) => enClair(e, seancesSemaine).map((t, k) => <li key={`${i}-${k}`}>{t}</li>))}
              </ul>
            ) : <p className="text-sm text-[#3B3957]">Rien : la semaine suit le plan.</p>}
            {textes.length > 0 && (
              <div className="pt-2">
                <p className="text-[0.8125rem] font-bold">La note « Ta semaine » qu’il lira</p>
                <p className="mt-1 text-sm leading-relaxed text-[#3B3957] whitespace-pre-line">{textes.join(' ')}</p>
              </div>
            )}
          </Carte>
          <Carte className="!p-5 space-y-2">
            <Surtitre>Ce qu’il a lu</Surtitre>
            {a?.retours && <p className="text-sm text-[#3B3957]">{reponsesDuSamedi(a.retours.questionnaire)}</p>}
            {r && (
              <p className="text-sm text-[#3B3957]">
                Semaine écoulée : {r.seances_faites} séance{r.seances_faites > 1 ? 's' : ''} faite{r.seances_faites > 1 ? 's' : ''} sur {r.seances_prevues}
                {r.charge_prevue ? `, ${Math.round((100 * r.charge_tenue) / r.charge_prevue)} % de la charge prévue` : ''}
                {r.rpe_lu ? '' : ' (sans RPE lu : la charge faite compte le RPE prévu)'}.
              </p>
            )}
            {lues === undefined ? (
              <p className="text-sm text-[#3B3957]">{a?.retours === null ? 'Première semaine : rien n’est lu.' : 'Ses séances de qualité n’ont pas pu être lues : la marche suit le plan.'}</p>
            ) : lues.length === 0 ? (
              <p className="text-sm text-[#3B3957]">Aucune séance de qualité faite sur les 4 dernières semaines.</p>
            ) : (
              <>
                <p className="text-[0.8125rem] text-[#5E5C78]">Ses séances de qualité faites des 4 dernières semaines, classées par leur structure. La dernière de chaque famille, quand c’est la tienne, fixe la marche.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[0.72rem] uppercase tracking-[0.08em] text-[#5E5C78]">
                        <th className="py-1.5 pr-3 font-bold">Date</th><th className="py-1.5 pr-3 font-bold">Famille</th>
                        <th className="py-1.5 pr-3 font-bold">Qualité</th><th className="py-1.5 pr-3 font-bold">RPE</th><th className="py-1.5 font-bold">Écrite par</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo/10">
                      {[...lues].sort((x, y) => y.date.localeCompare(x.date)).map((l, i) => (
                        <tr key={`${l.date}-${i}`}>
                          <td className="py-1.5 pr-3 whitespace-nowrap">{jourMois(l.date)}</td>
                          <td className="py-1.5 pr-3">{FAMILLE[l.famille]}</td>
                          <td className="py-1.5 pr-3 whitespace-nowrap">{dose(l)}</td>
                          <td className="py-1.5 pr-3 whitespace-nowrap">{l.rpe ?? '—'} pour {l.rpe_prevu ?? '—'}</td>
                          <td className="py-1.5">{l.moteur ? 'le moteur' : 'toi'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Carte>
        </>
      )}
    </CadreCoach>
  );
}

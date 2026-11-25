'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition, useState } from 'react';
import clsx from 'clsx';
import { Carte, Surtitre } from './Ui';
import { enregistrerLeCoureur, enregistrerTestVc, enregistrerValeurs, type EtatCoach } from '@/lib/app/actionsCoaching';
import {
  champsDuCoureur, CLES_DE_L_OBJECTIF, CLES_DES_REPERES, CLES_DU_COUREUR, completer, distanceChangee, erreurDeLaCarte, intakeDeLObjectif, JOURS_DE_LA_SEMAINE, objectifChange, reperesAEnvoyer,
  testSaisi, TEXTES_CARTE, type EffortsDuTest, type ReponsesDeLObjectif, type ValeursDeLaCarte,
} from '@/lib/app/carteSavoir';
import { TEXTES_COTE } from '@/lib/cote';
import { TEXTES_COURSES } from '@/lib/app/sesCourses';
import { CRITERES, REPONSES_CRITERE, SANS_CRITERE, TITRE_CRITERES_FICHE } from '@/lib/criteres';
import { API_URL, formatDepuisDistance } from '@/lib/plan';

// « CE QUE J’AI BESOIN DE SAVOIR », SUR LA PAGE D’UN ATHLÈTE, SOUS LA 9.x SEULEMENT (décision 241 du coach, 25/11/2026, moment 2) : une carte, un formulaire, un bouton « Enregistrer » (lib/app/carteSavoir.ts).
// En tête, « Complet » ou « Il manque : … » (le même repère que « Ses objectifs ») ; chaque manque est surligné dans son champ. L'objectif d'abord (« Modifier l'objectif » : app/app/coach/athletes/route.ts, comme le
// questionnaire), puis sa fiche, ses repères (s'ils ont changé) et son test (s'il est saisi), le test en dernier : il l'emporte sur l'allure d'avant. Un champ vide n'efface rien.
// « son-profil », « geste-profil », « geste-test-vc », « geste-reperes » : les adresses que d'autres écrans donnent à cette page ; chacune est sur sa partie de la carte.

export type ObjectifDeLaCarte = {
  planId: string; nom: string; route: boolean; enRoute: boolean; programme: boolean; envoyeEnEntier: boolean; traceDonnee: boolean; base: ReponsesDeLObjectif;
};
type Repere = [titre: string, valeur: string | null, source: string | null];
type Ligne = { ok: boolean; texte: string };
type Cle = keyof ValeursDeLaCarte;

const CHAMP = 'mt-1.5 w-full min-h-11 rounded-[10px] border border-indigo/20 px-3 text-sm font-normal text-indigo bg-white disabled:bg-sand disabled:text-[#5E5C78]';
const LIBELLE = 'block text-xs font-semibold text-indigo';
const AIDE = 'text-[0.72rem] leading-relaxed text-[#5E5C78]';
const SURLIGNE = 'rounded-xl bg-[#FFF6E5] ring-1 ring-[#C8952E] p-2.5';
const PUCE = 'inline-flex items-center gap-1.5 min-h-10 px-2.5 rounded-[10px] border border-indigo/20 bg-white text-[0.8rem] text-indigo has-[:checked]:bg-teal has-[:checked]:text-white has-[:checked]:border-teal';
const SECTION = 'text-sm font-extrabold text-indigo';
const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const sansEfforts = (le: string): EffortsDuTest => ({ le, duree1: '', distance1: '', duree2: '', distance2: '' });
const formulaire = (champs: [string, string][]) => {
  const f = new FormData();
  for (const [k, v] of champs) f.append(k, v);
  return f;
};
// Un enregistrement qui n'arrive pas au serveur ne laisse pas la carte en attente.
const appeler = async (geste: () => Promise<EtatCoach>): Promise<{ ok: boolean; message: string; avertissement?: string }> => {
  try {
    return (await geste()) ?? { ok: false, message: TEXTES_CARTE.erreur };
  } catch {
    return { ok: false, message: TEXTES_CARTE.serviceMuet };
  }
};

export default function CarteSavoir({
  athleteId, nom, email, aujourdhui, repere, complet, manquants, valeurs, niveau, objectif, reperes, allures, aideDuTest, aideDesReperes, titreDesZones, zonesEtStyle = null, courses = null,
}: {
  athleteId: string; nom: string; email: string; aujourdhui: string;
  // Le repère en tête et les champs qui manquent (lib/app/pageAthleteSimple.ts, etatDeLaCarte).
  repere: string; complet: boolean; manquants: string[];
  valeurs: ValeursDeLaCarte; niveau: string; objectif: ObjectifDeLaCarte | null;
  // Ses repères tels que la page les dit : FC au seuil 1, vitesse critique, FC au seuil 2 ; les deux allures telles qu'elles sont gardées.
  reperes: Repere[]; allures: { vs1: string | null; vc: string | null };
  aideDuTest: string; aideDesReperes: string; titreDesZones: string; zonesEtStyle?: React.ReactNode;
  // « Ses courses » : toutes, dans l'ordre (components/app/ObjectifsAVerifier.tsx, en `plat`), sous le formulaire : elles ont leurs propres formulaires.
  courses?: React.ReactNode;
}) {
  const t = TEXTES_CARTE;
  const router = useRouter();
  const [saisie, setSaisie] = useState<Partial<ValeursDeLaCarte>>({});
  const [efforts, setEfforts] = useState<EffortsDuTest>(sansEfforts(aujourdhui));
  const [gpx, setGpx] = useState<File | null>(null);
  const [cleGpx, setCleGpx] = useState(0);
  const [enCours, setEnCours] = useState(false);
  const [messages, setMessages] = useState<Ligne[]>([]);
  const v = { ...valeurs, ...saisie };
  const maj = (cle: Cle, valeur: string | string[]) => setSaisie((s) => ({ ...s, [cle]: valeur }));
  const manque = (cle: string) => manquants.includes(cle) && SURLIGNE;
  const modifiable = objectif && !objectif.envoyeEnEntier ? objectif : null;
  const [fc1, vc, fc2] = reperes;

  async function envoyerObjectif(o: ObjectifDeLaCarte, apres: ValeursDeLaCarte): Promise<string | null> {
    let format: string | undefined;
    if (!o.route && distanceChangee(valeurs, apres)) {
      // La distance change : son format se relit comme le questionnaire le lit.
      const config = await fetch(`${API_URL}/v1/config`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      format = config ? formatDepuisDistance(apres.distance_km, config) : '';
      if (!format) return t.serviceMuet;
    }
    const donnees = new FormData();
    donnees.append('intake', JSON.stringify(intakeDeLObjectif({ base: o.base, avant: valeurs, apres, nom, email, niveau, format })));
    donnees.append('plan_id', o.planId);
    donnees.append('athlete_id', athleteId);
    if (gpx && !o.route) donnees.append('gpx', gpx);
    try {
      const r = await fetch('/app/coach/athletes', { method: 'POST', body: donnees });
      const corps = await r.json().catch(() => null);
      return r.ok && corps?.page ? null : corps?.message || t.erreur;
    } catch {
      return t.serviceMuet;
    }
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    const apres = completer(valeurs, saisie);
    const erreur = erreurDeLaCarte(apres, modifiable);
    if (erreur) {
      setMessages([{ ok: false, texte: erreur }]);
      return;
    }
    setEnCours(true);
    setMessages([]);
    const echecs: Ligne[] = [];
    const dits: Ligne[] = [];
    const enregistres: Cle[] = [];
    let reussi = false;
    // L'objectif, seulement s'il a changé ou qu'une trace est donnée ; ses jours ne se recopient sur sa fiche que s'il les a bien.
    let semaineAJour = Boolean(modifiable);
    let traceEnvoyee = false;
    // Rien à renvoyer : un champ vidé reprend ce qu'il avait.
    if (!modifiable || (!objectifChange(valeurs, apres) && !gpx)) enregistres.push(...CLES_DE_L_OBJECTIF);
    else {
      const refus = await envoyerObjectif(modifiable, apres);
      if (refus) {
        semaineAJour = false;
        echecs.push({ ok: false, texte: `${t.sonObjectif} : ${refus}` });
      } else {
        reussi = true;
        traceEnvoyee = true;
        enregistres.push(...CLES_DE_L_OBJECTIF);
        if (modifiable.programme) dits.push({ ok: true, texte: t.departAnnule });
      }
    }
    const fiche = await appeler(() => enregistrerLeCoureur(athleteId, formulaire(champsDuCoureur(apres, semaineAJour))));
    if (fiche.ok) {
      reussi = true;
      enregistres.push(...CLES_DU_COUREUR);
    } else echecs.push({ ok: false, texte: `${t.leCoureur} : ${fiche.message}` });
    const marques = reperesAEnvoyer(valeurs, apres, allures);
    if (!marques) enregistres.push(...CLES_DES_REPERES);
    else {
      const r = await appeler(() => enregistrerValeurs(athleteId, null, formulaire(marques)));
      if (r.ok) {
        reussi = true;
        enregistres.push(...CLES_DES_REPERES);
        dits.push({ ok: true, texte: r.message });
      } else echecs.push({ ok: false, texte: `${t.reperes} : ${r.message}` });
    }
    let testEnregistre = false;
    if (testSaisi(efforts)) {
      const r = await appeler(() => enregistrerTestVc(athleteId, null, formulaire(Object.entries(efforts))));
      if (r.ok) {
        reussi = true;
        testEnregistre = true;
        dits.push({ ok: true, texte: r.message });
        if (r.avertissement) dits.push({ ok: false, texte: r.avertissement });
      } else echecs.push({ ok: false, texte: `${t.test} : ${r.message}` });
    }
    setEnCours(false);
    setMessages(echecs.length
      ? [...echecs, ...(reussi ? [{ ok: true, texte: t.leResteEnregistre }] : []), ...dits]
      : dits.length ? dits : [{ ok: true, texte: t.enregistre }]);
    // Ce qui est enregistré reprend la valeur que la page relit ; ce qui a été refusé reste saisi, à corriger.
    startTransition(() => {
      router.refresh();
      setSaisie((s) => Object.fromEntries(Object.entries(s).filter(([k]) => !enregistres.includes(k as Cle))) as Partial<ValeursDeLaCarte>);
      if (testEnregistre) setEfforts(sansEfforts(aujourdhui));
      if (traceEnvoyee) {
        setGpx(null);
        setCleGpx((k) => k + 1);
      }
    });
  }

  const effort = (i: 1 | 2, titre: string, exemples: [string, string]) => (
    <div role="group" aria-label={titre} className="grid grid-cols-2 gap-2.5">
      <span className="col-span-2 text-xs font-bold text-indigo">{titre}</span>
      <label className={LIBELLE}>{t.duree}
        <input value={efforts[`duree${i}`]} onChange={(e) => setEfforts((x) => ({ ...x, [`duree${i}`]: e.target.value }))} placeholder={exemples[0]} className={CHAMP} />
      </label>
      <label className={LIBELLE}>{t.distanceDeLEffort}
        <input value={efforts[`distance${i}`]} onChange={(e) => setEfforts((x) => ({ ...x, [`distance${i}`]: e.target.value }))} inputMode="decimal" placeholder={exemples[1]} className={CHAMP} />
      </label>
    </div>
  );
  const frequence = (cle: 'fc_seuil1' | 'fc_seuil2', [titre, valeur, source]: Repere) => (
    <label className={LIBELLE}>{titre}
      <input value={v[cle]} onChange={(e) => maj(cle, e.target.value)} inputMode="numeric" placeholder="bpm" className={CHAMP} />
      <span className={clsx('mt-1 block font-normal', AIDE)}>{valeur ? source : t.aTester}</span>
    </label>
  );
  const nombre = (cle: 'distance_km' | 'dplus_m', titre: string, bloque = false) => (
    <label className={LIBELLE}>{titre}
      <input value={v[cle]} onChange={(e) => maj(cle, e.target.value)} inputMode="decimal" disabled={bloque} className={CHAMP} />
    </label>
  );

  return (
    // « son-profil » : l'adresse que prennent « Son profil › » et la revue du dimanche.
    <Carte id="son-profil" className="!p-5 space-y-4 scroll-mt-6">
      <Surtitre>{t.titre}</Surtitre>
      <p className={clsx('flex gap-2 items-start rounded-xl p-3 text-sm font-bold', complet ? 'bg-[#E3EFE9] text-[#22604F]' : 'bg-[#FFF6E5] text-[#7A520D]')}>
        <span aria-hidden>{complet ? '✓' : '!'}</span>
        <span>{repere}</span>
      </p>

      <form onSubmit={enregistrer} noValidate className="space-y-5">
        <div className="space-y-4">
          <h3 className={SECTION}>{t.leCoureur}</h3>
          <div id="geste-profil" className="space-y-3 scroll-mt-6">
            <label className={clsx(LIBELLE, manque('cote'))}>{TEXTES_COTE.sa}
              <input value={v.cote_min} onChange={(e) => maj('cote_min', e.target.value)} inputMode="decimal" className={clsx(CHAMP, '!w-28 block')} />
            </label>
            <div role="radiogroup" aria-label={t.tapis} className={clsx('space-y-1.5', manque('tapis'))}>
              <span className={LIBELLE}>{t.tapis}</span>
              <div className="flex gap-1.5">
                {([['oui', t.oui], ['non', t.non]] as const).map(([valeur, titre]) => (
                  <label key={valeur} className={PUCE}>
                    <input type="radio" name="tapis" value={valeur} checked={v.tapis === valeur} onChange={() => maj('tapis', valeur)} className="sr-only" />
                    {titre}
                  </label>
                ))}
              </div>
            </div>
            <div role="group" aria-label={TITRE_CRITERES_FICHE} className="space-y-3">
              {CRITERES.map((q) => (
                <label key={q.champ} className={clsx(LIBELLE, manque(q.champ === 'critere_intensite' ? 'intensite' : 'mecanique'))}>{q.fiche}
                  <span className={clsx('block font-normal', AIDE)}>{q.fichePrecision}</span>
                  <select value={v[q.champ]} onChange={(e) => maj(q.champ, e.target.value)} className={CHAMP}>
                    <option value="">{SANS_CRITERE}</option>
                    {REPONSES_CRITERE.map((r) => <option key={r.valeur} value={r.valeur}>{r.precision ? `${r.titre} — ${r.precision}` : r.titre}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <div id="geste-test-vc" className="space-y-2.5 pt-3 border-t border-indigo/[0.07] scroll-mt-6">
            <h4 className="text-[0.8125rem] font-bold text-indigo">{t.test}</h4>
            <p className="text-[0.8125rem] text-[#4A4866]">
              {vc[0]} : <span className="font-bold text-indigo">{vc[1] ?? t.aTester}</span>{vc[1] && vc[2] ? ` · ${vc[2]}` : ''}
            </p>
            <p className={AIDE}>{aideDuTest}</p>
            <label className={LIBELLE}>{t.dateDuTest}
              <input type="date" value={efforts.le} max={aujourdhui} onChange={(e) => setEfforts((x) => ({ ...x, le: e.target.value }))} className={CHAMP} />
            </label>
            {effort(1, t.effortCourt, ['3 ou 3:00', '1000 m ou 1'])}
            {effort(2, t.effortLong, ['12 ou 12:00', '3150 m ou 3,15'])}
            <p className={AIDE}>{t.autresDurees}</p>
            <label className={LIBELLE}>{t.vcConnue}
              <input value={v.vc_allure} onChange={(e) => maj('vc_allure', e.target.value)} placeholder="4:10" className={clsx(CHAMP, '!w-28 block')} />
            </label>
          </div>

          <div id="geste-reperes" className="space-y-2.5 pt-3 border-t border-indigo/[0.07] scroll-mt-6">
            <h4 className="text-[0.8125rem] font-bold text-indigo">{t.reperes}</h4>
            <div className="grid grid-cols-2 gap-2.5 items-start">
              {frequence('fc_seuil1', fc1)}
              {frequence('fc_seuil2', fc2)}
            </div>
            <p className={AIDE}>{aideDesReperes}</p>
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t border-indigo/[0.12]">
          <h3 className={SECTION}>{TEXTES_COURSES.sesCourses}</h3>
          {objectif && <h4 className="text-[0.8125rem] font-bold text-indigo">{TEXTES_COURSES.prochaine} · {objectif.nom}</h4>}
          {!objectif ? (
            <div className={clsx('flex flex-wrap gap-2', SURLIGNE)}>
              <Link href={`/app/coach/nouveau?athlete=${athleteId}&discipline=route`} className="inline-flex items-center min-h-10 px-3.5 rounded-[10px] border border-teal text-teal text-[0.8125rem] font-bold">
                + Objectif route
              </Link>
              <Link href={`/app/coach/nouveau?athlete=${athleteId}`} className="inline-flex items-center min-h-10 px-3.5 rounded-[10px] bg-teal text-white text-[0.8125rem] font-bold">
                + Objectif trail
              </Link>
            </div>
          ) : objectif.envoyeEnEntier ? (
            <Link href={`/app/coach/nouveau?athlete=${athleteId}&modifier=${objectif.planId}`} className="inline-flex items-center min-h-10 px-3.5 rounded-[10px] border border-teal text-teal text-[0.8125rem] font-bold">
              {t.modifierObjectif}
            </Link>
          ) : (
            <>
              {objectif.enRoute && <p className={AIDE}>{t.enRoute}</p>}
              {objectif.programme && <p className="text-[0.8125rem] text-[#7A520D]">{t.programme}</p>}
              <div className="grid grid-cols-2 gap-2.5">
                <label className={LIBELLE}>{t.dateDeLaCourse}
                  <input type="date" value={v.date_course} onChange={(e) => maj('date_course', e.target.value)} disabled={objectif.enRoute} className={CHAMP} />
                </label>
                <label className={LIBELLE}>{t.chrono}
                  <input value={v.temps_cible} onChange={(e) => maj('temps_cible', e.target.value)} placeholder={objectif.route ? '0h46' : '5h30'} className={CHAMP} />
                </label>
                {!objectif.route && nombre('distance_km', t.km, objectif.enRoute)}
                {!objectif.route && nombre('dplus_m', t.denivele)}
              </div>
              {!objectif.route && (
                <div id="champ-gpx" className={clsx('space-y-1 scroll-mt-6', manque('gpx'))}>
                  <label className={LIBELLE}>{objectif.traceDonnee ? t.nouvelleTrace : t.trace}
                    <input key={cleGpx} type="file" accept=".gpx" onChange={(e) => setGpx(e.target.files?.[0] ?? null)}
                      className="mt-1.5 block w-full max-w-full text-sm font-normal text-indigo file:mr-3 file:min-h-10 file:px-3 file:rounded-[10px] file:border-0 file:bg-[#E1EFEA] file:text-teal-dark file:font-bold" />
                  </label>
                  {objectif.traceDonnee && <p className={AIDE}>{t.traceGardee}</p>}
                </div>
              )}
              <div id="champ-semaine" className={clsx('space-y-2.5 scroll-mt-6', manque('semaine'))}>
                <div role="group" aria-label={t.jours}>
                  <div className={LIBELLE}>{t.jours}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {JOURS_DE_LA_SEMAINE.map((j) => (
                      <label key={j} className={PUCE}>
                        <input type="checkbox" checked={v.jours_disponibles.includes(j)} className="sr-only"
                          onChange={(e) => maj('jours_disponibles', e.target.checked ? [...v.jours_disponibles, j] : v.jours_disponibles.filter((x) => x !== j))} />
                        {majuscule(j.slice(0, 3))}.
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5 items-end">
                  <label className={LIBELLE}>{t.sortieLongue}
                    <select value={v.jour_sl} onChange={(e) => maj('jour_sl', e.target.value)} className={CHAMP}>
                      <option value="" disabled>{t.choisis}</option>
                      {JOURS_DE_LA_SEMAINE.map((j) => <option key={j} value={j}>{majuscule(j)}</option>)}
                    </select>
                  </label>
                  <label className={LIBELLE}>{t.seances}
                    <input value={v.freq_hebdo} onChange={(e) => maj('freq_hebdo', e.target.value)} inputMode="numeric" className={CHAMP} />
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        <button type="submit" disabled={enCours} className="w-full min-h-12 px-5 rounded-xl bg-teal text-white text-sm font-bold disabled:opacity-50">
          {enCours ? t.enregistrement : t.enregistrer}
        </button>
        {messages.length > 0 && (
          <div role="status" className="space-y-1">
            {messages.map((m, i) => <p key={`${i}:${m.texte}`} className={clsx('text-sm', m.ok ? 'text-teal font-semibold' : 'text-[#8A5E10]')}>{m.texte}</p>)}
          </div>
        )}
      </form>

      {courses}

      {zonesEtStyle && (
        <details className="pt-3 border-t border-indigo/[0.07]">
          <summary className="cursor-pointer min-h-10 flex items-center text-[0.8125rem] font-bold text-teal">{titreDesZones}</summary>
          <div className="pt-3 space-y-5">{zonesEtStyle}</div>
        </details>
      )}
    </Carte>
  );
}

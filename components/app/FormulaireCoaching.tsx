'use client';

import Link from 'next/link';
import { useState } from 'react';
import clsx from 'clsx';
import { envoyerDemandeCoaching } from '@/lib/app/actionsDemandesCoaching';
import { COTE_MAX_MIN, SANS_COTE } from '@/lib/cote';
import { JOURS, PLAGES, QUESTIONS_COACHING as Q, type ReponsesCoaching } from '@/lib/app/coachingRegles';
import { EXPERIENCES, PHRASE_SOUS_LA_GRILLE, type Experience } from '@/lib/app/profilGratuit';
import { BOUTON, BOUTON_SECONDAIRE, CHAMP, Carte, Surtitre } from './Ui';

// LE FORMULAIRE DE DEMANDE DE COACHING (app gratuite, lot A2 ; maquette « Demander le coaching » du 16/11/2026, questions du
// coach du 16/11/2026). Tous les textes viennent de QUESTIONS_COACHING (lib/app/coachingRegles.ts). Ce que l'app sait déjà
// (l'expérience, les tests, les courses) n'est pas redemandé : le serveur le joint. Le contrôle est refait côté serveur.
const etiquette = 'block text-xs font-semibold text-indigo mb-1.5';
const aide = 'mt-1 text-xs text-[#5E5C78] leading-relaxed';

type Valeurs = {
  nom: string; naissance: string; ville: string;
  course_depuis: string; experience_trail: Experience | ''; courses_marquantes: string;
  seances: string; heures: string; longue: string;
  terrain: string[]; dplus_pres: string; montagne: string; cote_min: string;
  objectif_kind: 'app' | 'libre' | 'aucune' | ''; course_id: string; autre_nom: string; autre_date: string; autre_km: string; autre_dplus: string;
  vise: string; vise_autre: string;
  jours: string[]; temps_seance: string; jour_sl: string;
  montre: string; nolio: string;
  attentes: string;
  consentement_sante: boolean; sante: string;
  telephone: string; moments: string[]; mot: string;
};

export type CourseDuCompte = { id: string; nom: string; resume: string };

// Les valeurs de départ : vides, ou celles de la demande déjà envoyée (la renvoyer la met à jour).
function depart(d: Partial<ReponsesCoaching> | null, extra: { sante: string | null; consentement: boolean; telephone: string; moments: string[] }): Valeurs {
  const ob = d?.objectif;
  return {
    nom: d?.nom ?? '', naissance: d?.naissance ? String(d.naissance) : '', ville: d?.ville ?? '',
    course_depuis: d?.course_depuis ?? '', experience_trail: d?.experience_trail ?? '', courses_marquantes: d?.courses_marquantes ?? '',
    seances: d?.seances ?? '', heures: d?.heures != null ? String(d.heures) : '', longue: d?.longue ?? '',
    // Une demande d'avant garde « Montées de plus de 10 minutes » : plus une case, mais la case cochée ne gêne pas (le serveur la
    // retire), et la côte se redit en minutes.
    terrain: d?.terrain ?? [], dplus_pres: d?.dplus_pres ?? '', montagne: d?.montagne ?? '', cote_min: d?.cote_min ?? '',
    objectif_kind: ob?.kind ?? '', course_id: ob?.kind === 'app' ? ob.course_id : '',
    autre_nom: ob?.kind === 'libre' ? ob.nom : '', autre_date: ob?.kind === 'libre' ? ob.date ?? '' : '',
    autre_km: ob?.kind === 'libre' && ob.distance_km != null ? String(ob.distance_km) : '',
    autre_dplus: ob?.kind === 'libre' && ob.dplus_m != null ? String(ob.dplus_m) : '',
    vise: d?.vise ?? '', vise_autre: d?.vise_autre ?? '',
    jours: d?.jours ?? [], temps_seance: d?.temps_seance ?? '', jour_sl: d?.jour_sl ?? '',
    montre: d?.montre ?? '', nolio: d?.nolio ?? '', attentes: d?.attentes ?? '',
    consentement_sante: extra.consentement, sante: extra.sante ?? '',
    telephone: extra.telephone, moments: extra.moments, mot: d?.mot ?? '',
  };
}

function Section({ n, titre, facultatif, children }: { n: string; titre: string; facultatif?: string; children: React.ReactNode }) {
  return (
    <Carte className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Surtitre>{n} · {titre}</Surtitre>
        {facultatif && <span className="text-[0.6875rem] font-semibold text-[#5E5C78]">{facultatif}</span>}
      </div>
      {children}
    </Carte>
  );
}

function Texte({ id, titre, valeur, onChange, aideTexte, type = 'text', inputMode, autoComplete, placeholder, required }: {
  id: string; titre: string; valeur: string; onChange: (v: string) => void; aideTexte?: string; type?: string;
  inputMode?: 'numeric' | 'decimal' | 'tel' | 'text'; autoComplete?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className={etiquette}>{titre}</label>
      <input id={id} type={type} inputMode={inputMode} autoComplete={autoComplete} placeholder={placeholder} required={required}
        value={valeur} onChange={(e) => onChange(e.target.value)} className={CHAMP} />
      {aideTexte && <p className={aide}>{aideTexte}</p>}
    </div>
  );
}

function Zone({ id, titre, valeur, onChange, aideTexte, lignes = 3 }: { id: string; titre: string; valeur: string; onChange: (v: string) => void; aideTexte?: string; lignes?: number }) {
  return (
    <div>
      <label htmlFor={id} className={etiquette}>{titre}</label>
      <textarea id={id} rows={lignes} value={valeur} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[10px] border border-indigo/20 bg-white px-3 py-2.5 text-sm text-indigo outline-none focus:border-teal" />
      {aideTexte && <p className={aide}>{aideTexte}</p>}
    </div>
  );
}

// Un seul choix parmi quelques-uns : des boutons radio, rendus en pastilles de 44 px.
function Un({ nom, titre, choix, valeur, onChange, large, sous }: { nom: string; titre: string; choix: { cle: string; titre: string }[]; valeur: string; onChange: (v: string) => void; large?: boolean; sous?: string }) {
  return (
    <fieldset>
      <legend className={etiquette}>{titre}</legend>
      <div className={clsx('flex gap-2', large ? 'flex-col' : 'flex-wrap')}>
        {choix.map((c) => (
          <label key={c.cle} className={clsx(large ? 'flex items-start py-2.5 leading-relaxed' : 'inline-flex items-center', 'min-h-11 px-3.5 rounded-xl border text-sm font-semibold cursor-pointer focus-within:ring-2 focus-within:ring-teal/50',
            valeur === c.cle ? 'border-teal bg-[#E1EFEA] text-teal-dark' : 'border-indigo/20 bg-white text-indigo')}>
            <input type="radio" name={nom} value={c.cle} checked={valeur === c.cle} onChange={() => onChange(c.cle)} className="sr-only" />
            {c.titre}
          </label>
        ))}
      </div>
      {sous && <p className="text-sm text-[#5E5C78] leading-relaxed mt-2">{sous}</p>}
    </fieldset>
  );
}

// La plus longue côte, en minutes (décision du coach du 23/11/2026, entrée 188) : un nombre, ou « Je n'ai pas de côte ».
function Cote({ valeur, onChange }: { valeur: string; onChange: (v: string) => void }) {
  const sans = valeur === SANS_COTE;
  return (
    <fieldset>
      <legend className={`${etiquette} leading-relaxed`}>{Q.terrain.cote.question}</legend>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <input type="number" inputMode="decimal" step="any" min="0.5" max={COTE_MAX_MIN} aria-label={Q.terrain.cote.unite} disabled={sans}
          value={sans ? '' : valeur} onChange={(e) => onChange(e.target.value)} className={`${CHAMP} !w-24`} />
        <span className="text-sm text-indigo">{Q.terrain.cote.unite}</span>
        <label className={clsx('inline-flex items-center min-h-11 px-3.5 rounded-xl border text-sm font-semibold cursor-pointer focus-within:ring-2 focus-within:ring-teal/50',
          sans ? 'border-teal bg-[#E1EFEA] text-teal-dark' : 'border-indigo/20 bg-white text-indigo')}>
          <input type="checkbox" checked={sans} onChange={(e) => onChange(e.target.checked ? SANS_COTE : '')} className="sr-only" />
          {Q.terrain.cote.aucune}
        </label>
      </div>
    </fieldset>
  );
}

// Plusieurs choix : des cases.
function Plusieurs({ titre, choix, valeur, onChange, aideTexte }: {
  titre: string; choix: { cle: string; titre: string }[]; valeur: string[]; onChange: (v: string[]) => void; aideTexte?: string;
}) {
  const bascule = (cle: string) => onChange(valeur.includes(cle) ? valeur.filter((x) => x !== cle) : [...valeur, cle]);
  return (
    <fieldset>
      <legend className={etiquette}>{titre}</legend>
      <div className="flex flex-wrap gap-2">
        {choix.map((c) => (
          <label key={c.cle} className={clsx('inline-flex items-center min-h-11 px-3.5 rounded-xl border text-sm font-semibold cursor-pointer focus-within:ring-2 focus-within:ring-teal/50',
            valeur.includes(c.cle) ? 'border-teal bg-[#E1EFEA] text-teal-dark' : 'border-indigo/20 bg-white text-indigo')}>
            <input type="checkbox" checked={valeur.includes(c.cle)} onChange={() => bascule(c.cle)} className="sr-only" />
            {c.titre}
          </label>
        ))}
      </div>
      {aideTexte && <p className={aide}>{aideTexte}</p>}
    </fieldset>
  );
}

export default function FormulaireCoaching({ experienceConnue, courses, demande, envoyeeLe }: {
  experienceConnue: Experience | null; courses: CourseDuCompte[];
  demande: { reponses: Partial<ReponsesCoaching>; sante: string | null; consentementSante: boolean; telephone: string; moments: string[] } | null;
  envoyeeLe: string | null;
}) {
  const [v, setV] = useState<Valeurs>(() => depart(demande?.reponses ?? null, {
    sante: demande?.sante ?? null, consentement: demande?.consentementSante ?? false, telephone: demande?.telephone ?? '', moments: demande?.moments ?? [],
  }));
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const pose = <K extends keyof Valeurs>(cle: K) => (valeur: Valeurs[K]) => setV((x) => ({ ...x, [cle]: valeur }));
  const titreExperience = EXPERIENCES.map((e) => ({ cle: e.cle, titre: `${e.titre} · ${e.texte}` }));

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setErreur('');
    const objectif = v.objectif_kind === 'app' ? { kind: 'app', course_id: v.course_id }
      : v.objectif_kind === 'libre' ? { kind: 'libre', nom: v.autre_nom, date: v.autre_date, distance_km: v.autre_km, dplus_m: v.autre_dplus }
      : v.objectif_kind === 'aucune' ? { kind: 'aucune' } : {};
    setEnCours(true);
    const r = await envoyerDemandeCoaching({
      nom: v.nom, naissance: v.naissance, ville: v.ville, course_depuis: v.course_depuis, experience_trail: v.experience_trail,
      courses_marquantes: v.courses_marquantes, seances: v.seances, heures: v.heures, longue: v.longue,
      terrain: v.terrain, dplus_pres: v.dplus_pres, montagne: v.montagne, cote_min: v.cote_min, objectif, vise: v.vise, vise_autre: v.vise_autre,
      jours: v.jours, temps_seance: v.temps_seance, jour_sl: v.jour_sl, montre: v.montre, nolio: v.nolio, attentes: v.attentes,
      telephone: v.telephone, moments: v.moments, mot: v.mot, consentement_sante: v.consentement_sante, sante: v.consentement_sante ? v.sante : '',
    });
    setEnCours(false);
    if (r.ok) {
      setEnvoye(true);
      window.scrollTo({ top: 0 });
    } else setErreur(r.message);
  }

  if (envoye) {
    return (
      <div className="space-y-5" role="status">
        <span className="w-12 h-12 rounded-full bg-[#E1EFEA] text-teal flex items-center justify-center" aria-hidden>
          <svg viewBox="0 0 24 24" className="w-6 h-6"><path d="M5 12.5 10 17 19 7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <h1 className="text-[1.625rem] font-extrabold text-indigo tracking-tight leading-tight">{Q.apres}</h1>
        <p className="text-sm text-[#5E5C78] leading-relaxed">{Q.apresSuite}</p>
        <div className="flex flex-col gap-2.5">
          <Link href="/app/profil" className={BOUTON}>Retour à mon profil</Link>
          <Link href="/app/compte" className={BOUTON_SECONDAIRE}>Ma demande, dans mon compte</Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={envoyer} className="space-y-4">
      <div className="space-y-2.5">
        <Surtitre as="div">Le coaching humain · 89&nbsp;€ par mois</Surtitre>
        <h1 className="text-[1.625rem] font-extrabold text-indigo tracking-tight leading-tight">{Q.titre}</h1>
        <p className="text-sm text-[#5E5C78] leading-relaxed">{Q.intro}</p>
        <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">{Q.dejaConnu}</p>
        {envoyeeLe && <p className="text-[0.8125rem] font-semibold text-teal-dark leading-relaxed">{Q.deja}</p>}
      </div>

      <Section n="01" titre={Q.toi.titre}>
        <Texte id="nom" titre={Q.toi.nom} valeur={v.nom} onChange={pose('nom')} autoComplete="name" required />
        <Texte id="naissance" titre={Q.toi.naissance} valeur={v.naissance} onChange={pose('naissance')} inputMode="numeric" placeholder="1988" required />
        <Texte id="ville" titre={Q.toi.ville} valeur={v.ville} onChange={pose('ville')} autoComplete="address-level2" required />
      </Section>

      <Section n="02" titre={Q.vecu.titre}>
        <Un nom="depuis" titre={Q.vecu.depuis} choix={Q.vecu.depuisChoix} valeur={v.course_depuis} onChange={pose('course_depuis')} />
        {!experienceConnue && <Un nom="experience" titre={Q.vecu.experience} choix={titreExperience} valeur={v.experience_trail} onChange={(x) => pose('experience_trail')(x as Experience)} large sous={PHRASE_SOUS_LA_GRILLE} />}
        <Zone id="marquantes" titre={Q.vecu.marquantes} valeur={v.courses_marquantes} onChange={pose('courses_marquantes')} aideTexte={Q.vecu.marquantesAide} />
      </Section>

      <Section n="03" titre={Q.semaine.titre}>
        <Un nom="seances" titre={Q.semaine.seances} choix={Q.semaine.seancesChoix} valeur={v.seances} onChange={pose('seances')} />
        <Texte id="heures" titre={Q.semaine.heures} valeur={v.heures} onChange={pose('heures')} inputMode="decimal" placeholder="5" />
        <Texte id="longue" titre={Q.semaine.longue} valeur={v.longue} onChange={pose('longue')} aideTexte={Q.semaine.longueAide} />
      </Section>

      <Section n="04" titre={Q.terrain.titre}>
        <Plusieurs titre={Q.terrain.pres} choix={Q.terrain.presChoix} valeur={v.terrain} onChange={pose('terrain')} />
        <Cote valeur={v.cote_min} onChange={pose('cote_min')} />
        <Texte id="dplus" titre={Q.terrain.dplus} valeur={v.dplus_pres} onChange={pose('dplus_pres')} aideTexte={Q.terrain.dplusAide} />
        <Un nom="montagne" titre={Q.terrain.montagne} choix={Q.terrain.montagneChoix} valeur={v.montagne} onChange={pose('montagne')} />
      </Section>

      <Section n="05" titre={Q.objectif.titre}>
        <Un nom="objectif" titre={Q.objectif.quelle}
          choix={[...(courses.length ? [{ cle: 'app', titre: Q.objectif.deLApp }] : []), { cle: 'libre', titre: Q.objectif.autre }, { cle: 'aucune', titre: Q.objectif.aucune }]}
          valeur={v.objectif_kind} onChange={(x) => pose('objectif_kind')(x as Valeurs['objectif_kind'])} />
        {v.objectif_kind === 'app' && (
          <div>
            <label htmlFor="course" className={etiquette}>{Q.objectif.deLApp}</label>
            <select id="course" value={v.course_id} onChange={(e) => pose('course_id')(e.target.value)} className={CHAMP} required>
              <option value="">Choisis une course</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.nom}{c.resume ? ` · ${c.resume}` : ''}</option>)}
            </select>
          </div>
        )}
        {v.objectif_kind === 'libre' && (
          <div className="space-y-3">
            <Texte id="autre-nom" titre={Q.objectif.nom} valeur={v.autre_nom} onChange={pose('autre_nom')} required />
            <Texte id="autre-date" titre={Q.objectif.date} valeur={v.autre_date} onChange={pose('autre_date')} type="date" />
            <div className="grid grid-cols-2 gap-3">
              <Texte id="autre-km" titre={Q.objectif.distance} valeur={v.autre_km} onChange={pose('autre_km')} inputMode="decimal" />
              <Texte id="autre-dplus" titre={Q.objectif.dplus} valeur={v.autre_dplus} onChange={pose('autre_dplus')} inputMode="numeric" />
            </div>
          </div>
        )}
        <Un nom="vise" titre={Q.objectif.vise} choix={Q.objectif.viseChoix} valeur={v.vise} onChange={pose('vise')} />
        {v.vise === 'autre' && <Texte id="vise-autre" titre={Q.objectif.viseAutre} valeur={v.vise_autre} onChange={pose('vise_autre')} />}
      </Section>

      <Section n="06" titre={Q.dispos.titre}>
        <Plusieurs titre={Q.dispos.jours} choix={JOURS.map((j) => ({ cle: j.cle, titre: j.titre }))} valeur={v.jours} onChange={pose('jours')} />
        <Un nom="temps" titre={Q.dispos.tempsSeance} choix={Q.dispos.tempsChoix} valeur={v.temps_seance} onChange={pose('temps_seance')} />
        <Un nom="jour-sl" titre={Q.dispos.jourSl} choix={[...JOURS.map((j) => ({ cle: j.cle, titre: j.titre })), { cle: 'peu_importe', titre: Q.dispos.jourSlIndifferent }]}
          valeur={v.jour_sl} onChange={pose('jour_sl')} />
      </Section>

      <Section n="07" titre={Q.montre.titre}>
        <Un nom="montre" titre={Q.montre.type} choix={Q.montre.typeChoix} valeur={v.montre} onChange={pose('montre')} />
        <Un nom="nolio" titre={Q.montre.nolio} choix={Q.montre.nolioChoix} valeur={v.nolio} onChange={pose('nolio')} />
      </Section>

      <Section n="08" titre={Q.attentes.titre} facultatif={Q.attentes.facultatif}>
        <Zone id="attentes" titre={Q.attentes.label} valeur={v.attentes} onChange={pose('attentes')} />
      </Section>

      <Section n="09" titre={Q.sante.titre} facultatif={Q.sante.facultatif}>
        <label className="flex gap-2.5 items-start text-sm text-[#4A4866] cursor-pointer">
          <input type="checkbox" className="mt-1 w-4 h-4 accent-teal shrink-0" checked={v.consentement_sante} onChange={(e) => pose('consentement_sante')(e.target.checked)} />
          <span>{Q.sante.consentement}</span>
        </label>
        {v.consentement_sante
          ? <Zone id="sante" titre={Q.sante.label} valeur={v.sante} onChange={pose('sante')} lignes={4} />
          : <p className={aide}>{Q.sante.sansCase}</p>}
      </Section>

      <Section n="10" titre={Q.appel.titre}>
        <Texte id="telephone" titre={Q.appel.telephone} valeur={v.telephone} onChange={pose('telephone')} type="tel" inputMode="tel" autoComplete="tel" placeholder="06 12 34 56 78" required />
        <fieldset>
          <legend className={etiquette}>{Q.appel.moments}</legend>
          <div role="group" className="grid grid-cols-[1fr_repeat(3,minmax(0,1fr))] gap-x-2 gap-y-1.5 items-center">
            <span />
            {PLAGES.map((p) => <span key={p.cle} className="text-center text-xs font-semibold text-[#5E5C78]">{p.titre}</span>)}
            {JOURS.map((j) => (
              <div key={j.cle} className="contents">
                <span className="text-sm font-semibold text-indigo">{j.titre}</span>
                {PLAGES.map((p) => {
                  const cle = `${j.cle}_${p.cle}`;
                  const coche = v.moments.includes(cle);
                  return (
                    <label key={cle} className={clsx('flex items-center justify-center min-h-11 rounded-xl border cursor-pointer focus-within:ring-2 focus-within:ring-teal/50',
                      coche ? 'border-teal bg-[#E1EFEA] text-teal-dark' : 'border-indigo/20 bg-white text-transparent')}>
                      <input type="checkbox" className="sr-only" checked={coche} aria-label={`${j.titre} ${p.titre.toLowerCase()}`}
                        onChange={() => pose('moments')(coche ? v.moments.filter((x) => x !== cle) : [...v.moments, cle])} />
                      <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden><path d="M5 12.5 10 17 19 7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
          <p className={aide}>{Q.appel.momentsAide}</p>
        </fieldset>
        <Zone id="mot" titre={`${Q.appel.mot} · ${Q.attentes.facultatif.toLowerCase()}`} valeur={v.mot} onChange={pose('mot')} lignes={2} />
      </Section>

      <div className="space-y-3">
        {erreur && <p role="alert" className="text-sm text-[#9A3B2C]">{erreur}</p>}
        <button type="submit" disabled={enCours} className={`${BOUTON} w-full`}>{envoyeeLe ? Q.metAJour : Q.envoyer}</button>
        <p className="text-xs text-[#5E5C78] leading-relaxed">{Q.ensuite} {Q.effacement}</p>
      </div>
    </form>
  );
}

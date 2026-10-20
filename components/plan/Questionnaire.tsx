'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { compterEtape } from '@/lib/mesure';
import clsx from 'clsx';
import { alerteSortieLongue, API_URL, avertissements, bandeTempsCible, type Champs, champsVides, type ConfigPlan, dureeConseillee, dureesPossibles, formatDepuisDistance, formatOuvert, intakePourApi, noteFormat, plancherSeances, reperesChrono, textes } from '@/lib/plan';

const NOMS_JOURS: Record<string, string> = {
  lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi', jeudi: 'Jeudi',
  vendredi: 'Vendredi', samedi: 'Samedi', dimanche: 'Dimanche',
};
const CLE_BROUILLON = 'cts-plan-brouillon';

// Les formes de l'app (décision coach du 20/10/2026 : le questionnaire est la porte d'entrée de l'app, il en prend la
// mise en page) : champs et cartes aux coins arrondis, libellés en surtitre, boutons pleins.
const inputCls =
  'w-full bg-white border border-indigo/15 rounded-xl focus:border-teal focus:ring-2 focus:ring-teal/15 px-4 py-3 text-[0.9375rem] text-indigo outline-none transition-colors';
const labelCls = 'block text-[0.6875rem] font-bold tracking-[0.12em] uppercase text-[#5E5C78] mb-2';
const aideCls = 'text-[0.8125rem] text-[#5E5C78] leading-relaxed mt-2';
const boutonCls = 'inline-flex items-center justify-center min-h-12 px-6 rounded-xl bg-teal text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed';
const boutonSecondaireCls = 'inline-flex items-center justify-center min-h-11 px-4 rounded-xl border border-indigo/20 text-indigo text-sm font-bold';
// Nombres à la française dans le récapitulatif : « 13,3 km », « 2 706 m », pas la saisie
// brute « 13.3 » (audit du 27/09/2026, K1).
const nombreFr = (v: string) => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : v;
};

function Section({ numero, titre, children }: { numero: number; titre: string; children: React.ReactNode }) {
  return (
    <section id={`section-${numero}`} className="bg-white rounded-2xl border border-indigo/[0.08] p-5 sm:p-6 scroll-mt-6">
      <div className="flex items-baseline gap-2.5 mb-5">
        {/* Le numéro à la taille du titre (retour du coach du 07/10/2026 : trop petit à côté). */}
        <span className="text-teal font-extrabold text-[1.25rem]">{String(numero).padStart(2, '0')}</span>
        <h2 className="text-[1.25rem] font-extrabold text-indigo tracking-tight">{titre}</h2>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Choix({
  nom, valeur, courant, onChange, titre, description, detail,
}: {
  nom: string; valeur: string; courant: string; onChange: (v: string) => void;
  titre: string; description?: string; detail?: string;
}) {
  const actif = courant === valeur;
  return (
    <label
      className={clsx(
        'flex gap-4 p-4 rounded-xl border cursor-pointer transition-colors',
        actif ? 'border-teal bg-teal/5' : 'border-indigo/15 hover:border-indigo/40'
      )}
    >
      <input
        type="radio" name={nom} value={valeur} checked={actif} required
        onChange={() => onChange(valeur)} className="mt-1 accent-teal"
      />
      <span>
        <span className="block font-bold text-indigo">{titre}</span>
        {description && <span className="block text-[0.8125rem] text-[#5E5C78] leading-relaxed mt-1">{description}</span>}
        {detail && <span className="block text-xs text-teal font-semibold mt-2">{detail}</span>}
      </span>
    </label>
  );
}

// coach : le questionnaire rempli par le coach pour un athlète coaché (CTS_NOLIO_CADRAGE.md, N1, N2) : sans
// paiement ni brouillon gardé, le plan part dans son espace coach. demande (OM1, 19/10/2026) : le même, rempli par le
// coaché dans l'app, qui part en demande chez son coach ; demandeId : le coach lance l'objectif d'une demande. Sans
// coach, initial préremplit le « Nouvel objectif » d'un acheteur depuis l'app. court (PO1, décision coach du 19/10/2026) :
// un athlète déjà connu, son profil rempli une fois (repris d'initial) ; seules sa charge du moment (PO2, préremplie) et
// la course se demandent.
export default function Questionnaire({
  coach = false, emailCoach = '', athleteId, initial, demande = false, demandeId, court = false,
}: {
  coach?: boolean; emailCoach?: string; athleteId?: string; initial?: Record<string, string | string[]>; demande?: boolean;
  demandeId?: string; court?: boolean;
} = {}) {
  const [config, setConfig] = useState<ConfigPlan | null>(null);
  const [erreurConfig, setErreurConfig] = useState('');
  // En mode coach : l'e-mail est celui du coach (rien n'est envoyé à l'athlète, N5) ; un nouvel objectif part des
  // réponses du précédent (N9).
  // Le coaching individualisé n'a pas de durée (QD1, décision coach du 19/10/2026) : « auto », fixée par l'API à la
  // commande, la formule qui couvre le temps jusqu'à la course.
  const [c, setC] = useState<Champs>(coach ? { ...champsVides, ...(initial as Partial<Champs>), email: emailCoach, duree_mois: 'auto' }
    : { ...champsVides, ...((initial ?? {}) as Partial<Champs>) });
  const [gpx, setGpx] = useState<File | null>(null);
  // Trace vérifiée dès son choix, sans rien bloquer (audit du 27/09/2026, T3 ; décision coach
  // du 28/09/2026) : l'athlète apprenait après avoir payé qu'elle était illisible.
  const [avisTrace, setAvisTrace] = useState('');
  const traceDemandee = useRef(0);
  const [etape, setEtape] = useState<'formulaire' | 'recap'>('formulaire');
  const [confirme, setConfirme] = useState(false);
  // Le début immédiat de la préparation (décision coach du 19/10/2026 : un service qui s'exécute semaine après semaine
  // jusqu'à la course, Code de la consommation, art. L221-25) : il ne commence pendant le délai de rétractation qu'à la
  // demande expresse de l'acheteur, qui garde son droit de rétractation, remboursé au prorata. Pas pour le coach.
  const [debutImmediat, setDebutImmediat] = useState(false);
  // La relance (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, L3) : une seule, le lendemain, seulement si la
  // case est cochée ; l'accord part au serveur avec l'e-mail, rien d'autre (lib/app/relance.ts).
  const [rappel, setRappel] = useState(false);
  const rappelEnregistre = useRef('');
  // NOLIO (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, P1 et T5 ; décisions coach du 18-19/10/2026) : les séances
  // arrivent dans Nolio ; l'acheteur y est invité avec l'adresse de l'achat, ou celle de son compte Nolio s'il en a un
  // sous une autre adresse ; et, s'il le veut, l'app lit son RPE, son ressenti et son Hooper pour ajuster son plan.
  const [autreNolio, setAutreNolio] = useState(false);
  const [nolioEmail, setNolioEmail] = useState('');
  const [accordLecture, setAccordLecture] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/v1/config`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setConfig)
      .catch(() => setErreurConfig('Le service de génération ne répond pas. Réessaie dans quelques minutes.'));
    // Un questionnaire prérempli (« Nouvel objectif » dans l'app) ne reprend pas de brouillon.
    if (coach || initial) return;
    try {
      const brouillon = localStorage.getItem(CLE_BROUILLON);
      // La réponse de santé n'est jamais reprise d'un brouillon, même ancien.
      if (brouillon) setC({ ...champsVides, ...JSON.parse(brouillon), blessure: '' });
    } catch {
      /* brouillon illisible : on repart de zéro */
    }
  }, []);

  useEffect(() => {
    if (coach) return;
    try {
      // La réponse de santé reste hors du brouillon (audit du 27/09/2026, T4 ; décision
      // coach du 28/09/2026) : « elle reste sur ta page » devient vrai au pied de la
      // lettre, rien ne la garde sur l'ordinateur d'un athlète qui ne va pas au bout.
      // L'arrêt récent, donnée d'entraînement depuis le second audit (D16), y reste
      // comme la charge actuelle.
      localStorage.setItem(CLE_BROUILLON, JSON.stringify({ ...c, blessure: undefined }));
    } catch {
      /* stockage indisponible : sans conséquence */
    }
  }, [c]);

  // La case « rappel » : cochée avec une adresse valable, l'accord part (une seconde après la dernière frappe) ;
  // l'adresse corrigée remplace la précédente ; décochée, l'accord est retiré.
  useEffect(() => {
    if (coach) return;
    const email = c.email.trim().toLowerCase();
    const valable = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const minuteur = setTimeout(() => {
      const precedent = rappelEnregistre.current;
      const envoyer = (corps: object) =>
        fetch('/api/relance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) }).catch(() => {});
      if (rappel && valable && email !== precedent) {
        envoyer({ email, accord: true, precedent });
        rappelEnregistre.current = email;
      } else if (!rappel && precedent) {
        envoyer({ email: precedent, accord: false });
        rappelEnregistre.current = '';
      }
    }, 1000);
    return () => clearTimeout(minuteur);
  }, [rappel, c.email, coach]);

  // Le tunnel de vente (L4) : questionnaire commencé à la première réponse, récapitulatif atteint ; pas pour le coach.
  const maj = (champ: keyof Champs) => (v: string) => {
    if (!coach) compterEtape('questionnaire');
    setC((p) => ({ ...p, [champ]: v }));
  };
  useEffect(() => {
    if (!coach && etape === 'recap') compterEtape('recap');
  }, [etape, coach]);

  // Le format se déduit de la distance (F4) : un format que le niveau n'ouvre pas ne propose
  // aucune durée, et la note sous la distance dit pourquoi.
  // Seulement les durées que sa course admet, celle qui colle à sa date cochée d'office (décision coach du 20/10/2026).
  const durees = config && formatOuvert(c, config) ? dureesPossibles(c, config) : [];
  const conseillee = config ? dureeConseillee(c, config, durees) : null;
  const notePourFormat = config ? noteFormat(c, config, coach) : null;
  const blocDistance = (
    <div>
      <label className={labelCls} htmlFor="distance">Distance de ta course (km)</label>
      <input id="distance" type="number" step="0.1" min="0.1" inputMode="decimal" className={inputCls} required value={c.distance_km} onChange={(e) => maj('distance_km')(e.target.value)} />
      <p className="text-sm text-teal mt-2 leading-relaxed">{notePourFormat ?? 'Le format de ta course se déduit de sa distance.'}</p>
    </div>
  );
  const joursCoches = (config?.jours ?? []).filter((j) => c.jours_disponibles.includes(j));
  const plancher = config ? plancherSeances(c, config) : null;
  const freqMin = plancher?.min ?? 3;
  const freqMax = plancher?.max ?? 7;
  const reperes = config ? reperesChrono(c, config, coach) : null;
  const bande = config ? bandeTempsCible(c, config) : null;
  const alerteSl = config ? alerteSortieLongue(c, config) : null;
  const alertes = useMemo(() => (config ? avertissements(c, config) : []), [c, config]);

  // Cohérence des menus filtrés quand une réponse amont change.
  useEffect(() => {
    if (!config) return;
    setC((p) => {
      const n = { ...p };
      // Le format suit la distance (audit du questionnaire du 01/10/2026, F4).
      n.format = formatDepuisDistance(n.distance_km, config);
      // Une durée que la course n'admet plus laisse la place à celle qui colle à sa date ; sans choix, celle-ci d'office.
      if (!coach) {
        const possibles = formatOuvert(n, config) ? dureesPossibles(n, config) : [];
        if (!n.duree_mois || !possibles.map(String).includes(n.duree_mois)) {
          const d = dureeConseillee(n, config, possibles);
          n.duree_mois = d === null ? '' : String(d);
        }
      }
      if (n.jour_sl && !n.jours_disponibles.includes(n.jour_sl)) n.jour_sl = '';
      // Plafond du niveau (second audit, D4) : passer en débutant avec 5 séances ou plus
      // vide le champ, comme les autres réponses devenues invalides.
      if (n.freq_hebdo && Number(n.freq_hebdo) > (config.freq_max_par_niveau?.[n.niveau] ?? 7)) n.freq_hebdo = '';
      return JSON.stringify(n) === JSON.stringify(p) ? p : n;
    });
  }, [config, c.niveau, c.format, c.distance_km, c.jours_disponibles, c.jour_sl, c.duree_mois, c.temps_cible, c.date_course]);

  function basculerJour(j: string) {
    setC((p) => ({
      ...p,
      jours_disponibles: p.jours_disponibles.includes(j)
        ? p.jours_disponibles.filter((x) => x !== j)
        : [...p.jours_disponibles, j],
    }));
  }

  async function versRecap(e: React.FormEvent) {
    e.preventDefault();
    if (joursCoches.length === 0) return;
    setRefus('');
    setEnvoi(true);
    // Refus métier vérifiés par l'API avant le récapitulatif : l'athlète ne relit pas
    // ses réponses pour découvrir ensuite qu'elles ne permettent pas de plan.
    try {
      // Le questionnaire du coaching (?coach=1) : sa durée « auto » et ses refus sans renvoi au coaching (QD1, QD6).
      const r = await fetch(`${API_URL}/v1/verification${coach ? '?coach=1' : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(intakePourApi(c)),
      });
      if (!r.ok) {
        const corps = await r.json().catch(() => null);
        setRefus(corps?.message || 'Une erreur est survenue. Réessaie dans quelques minutes.');
        setEnvoi(false);
        return;
      }
    } catch {
      setRefus('Le service de génération ne répond pas. Vérifie ta connexion et réessaie.');
      setEnvoi(false);
      return;
    }
    setEnvoi(false);
    setConfirme(false);
    setEtape('recap');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function choisirTrace(fichier: File | null) {
    setGpx(fichier);
    setAvisTrace('');
    const demande = ++traceDemandee.current;
    if (!fichier) return;
    const donnees = new FormData();
    donnees.append('gpx', fichier);
    // En cas d'échec réseau, rien à dire : le paiement revérifie la trace, en filet.
    fetch(`${API_URL}/v1/trace`, { method: 'POST', body: donnees })
      .then((r) => r.json())
      .then((corps) => {
        if (demande === traceDemandee.current) setAvisTrace(corps?.message || '');
      })
      .catch(() => {});
  }

  async function generer() {
    setEnvoi(true);
    setRefus('');
    const donnees = new FormData();
    donnees.append('intake', JSON.stringify(intakePourApi(c)));
    if (gpx) donnees.append('gpx', gpx);
    if (coach && athleteId) donnees.append('athlete_id', athleteId);
    if (coach && demandeId) donnees.append('demande_id', demandeId);
    if (!coach && debutImmediat) donnees.append('execution_immediate', '1');
    // La case de l'avertissement accepte aussi les CGV : l'API en garde la date chez Stripe, avec le paiement (E4).
    if (!coach && confirme) donnees.append('cgv_acceptees', '1');
    if (!coach && autreNolio && nolioEmail.trim()) donnees.append('nolio_email', nolioEmail.trim());
    if (!coach && accordLecture) donnees.append('accord_lecture', '1');
    if (!coach) compterEtape('paiement');
    if (coach) {
      try {
        const r = await fetch(demande ? '/app/objectif/demande' : '/app/coach/athletes', { method: 'POST', body: donnees });
        const corps = await r.json().catch(() => null);
        if (r.ok && corps?.page) {
          window.location.href = corps.page;
          return;
        }
        setRefus(corps?.message || 'Une erreur est survenue. Réessaie dans quelques minutes.');
      } catch {
        setRefus('Le service de génération ne répond pas. Vérifie ta connexion et réessaie.');
      }
      setEnvoi(false);
      return;
    }
    try {
      const r = await fetch(`${API_URL}/v1/checkout`, { method: 'POST', body: donnees });
      const corps = await r.json().catch(() => null);
      if (r.ok && corps?.checkout_url) {
        window.location.href = corps.checkout_url;
        return;
      }
      setRefus(corps?.message || 'Une erreur est survenue. Réessaie dans quelques minutes.');
    } catch {
      setRefus('Le service de génération ne répond pas. Vérifie ta connexion et réessaie.');
    }
    setEnvoi(false);
  }

  if (erreurConfig) {
    return <p className="bg-white border-l-4 border-red-400 p-5 text-indigo">{erreurConfig}</p>;
  }
  if (!config) {
    return <p className="text-indigo/60 text-center py-16">Chargement du questionnaire…</p>;
  }

  const prix = c.duree_mois ? config.prix_eur_par_mois[c.duree_mois] : undefined;
  const nomFormat = config.formats.find((f) => f.code === c.format)?.nom ?? '';
  const nomNiveau = textes.niveau.options.find((o) => o.valeur === c.niveau)?.titre ?? '';
  const nomTerrain = textes.terrain.options.find((o) => o.valeur === c.terrain)?.titre ?? '';

  if (etape === 'recap') {
    const lignes: [string, string][] = [
      ['Nom', c.nom], ...(coach ? [] : [['E-mail', c.email] as [string, string]]), ['Niveau', nomNiveau],
      ['En ce moment', `${c.volume_hebdo_actuel} de course par semaine · plus longue sortie ${c.sortie_longue_actuelle}`],
      ['Formule', coach ? `${nomFormat} — jusqu’à la course` : `${nomFormat} — ${c.duree_mois} mois`],
      ['Course', `${c.course_nom}, le ${new Date(`${c.date_course}T00:00:00`).toLocaleDateString('fr-FR')}`],
      ['Parcours', `${nombreFr(c.distance_km)} km, ${nombreFr(c.dplus_m)} m D+${c.dmoins_m ? `, ${nombreFr(c.dmoins_m)} m D−` : ''}${gpx ? ` · trace ${gpx.name}` : ' · sans trace GPX'}`],
      ['Temps cible', c.temps_cible], ['Terrain', nomTerrain],
      ['Disponibilité', `${c.freq_hebdo} séances par semaine · ${joursCoches.map((j) => NOMS_JOURS[j]).join(', ')} · sortie longue le ${c.jour_sl}`],
    ];
    // L'avertissement santé se lit et se coche à chaque fois (décision coach du 07/10/2026), avec
    // les points propres à l'athlète au-dessus quand il y en a.
    // QD5 (décision coach du 19/10/2026) : le coach lance l'objectif sans avertissement à cocher ; le coaché qui envoie
    // sa demande coche un avertissement propre au coaching (BROUILLON) ; l'acheteur, celui du plan automatique.
    const sansAvertissement = coach && !demande;
    const bloque = (!sansAvertissement && !confirme) || (!coach && !debutImmediat);
    return (
      <div className="space-y-6">
        <section className="bg-white rounded-2xl border border-indigo/[0.08] p-5 sm:p-6">
          <h2 className="text-[1.25rem] font-extrabold text-indigo tracking-tight mb-4">Relis tes réponses</h2>
          <dl className="divide-y divide-indigo/10">
            {lignes.map(([k, v]) => (
              <div key={k} className="grid sm:grid-cols-[10rem,1fr] gap-1 sm:gap-4 py-3">
                <dt className="text-[0.6875rem] font-bold tracking-[0.1em] uppercase text-[#5E5C78]">{k}</dt>
                <dd className="text-indigo">{v}</dd>
              </div>
            ))}
          </dl>
          <button type="button" onClick={() => setEtape('formulaire')} className={`${boutonSecondaireCls} mt-5`}>
            ← Modifier mes réponses
          </button>
        </section>

        <section className="bg-white rounded-2xl border border-indigo/[0.08] p-5 sm:p-6">
          {alertes.length > 0 && (
            <>
              <h2 className="text-lg text-indigo mb-4">Avant de générer ton plan, lis ces points</h2>
              <ul className="space-y-3 text-indigo/80 leading-relaxed list-disc pl-5 mb-6">
                {alertes.map((a) => <li key={a}>{a}</li>)}
              </ul>
            </>
          )}
          {demande ? (
            <div className="space-y-3 text-indigo/80 leading-relaxed">
              <div className="eyebrow text-teal">À lire avant d’envoyer</div>
              <p>
                Ton coach relit tes réponses avant de lancer ta préparation. Si une douleur ou une blessure t’empêche de
                courir normalement, dis-le-lui : vous adapterez ensemble. Ce plan ne remplace pas un avis médical.
              </p>
            </div>
          ) : !coach && config.avertissement && (
            <div className="space-y-3 text-indigo/80 leading-relaxed">
              <div className="eyebrow text-teal">{config.avertissement.surtitre}</div>
              {config.avertissement.paragraphes.map((p) => <p key={p}>{p}</p>)}
            </div>
          )}
          {!sansAvertissement && <label className="flex gap-3 items-start mt-6 cursor-pointer">
            <input type="checkbox" checked={confirme} onChange={(e) => setConfirme(e.target.checked)} className="mt-1 accent-teal" />
            <span className="text-indigo font-semibold">
              {demande ? (
                'J’ai lu cet avertissement et je veux envoyer mon objectif à mon coach.'
              ) : coach ? (
                'J’ai lu cet avertissement et je veux générer mon plan.'
              ) : (
                <>
                  J’ai lu cet avertissement et les{' '}
                  <a href="/cgv" target="_blank" rel="noopener" className="underline underline-offset-2">conditions générales de vente</a>, et je veux générer mon plan.
                </>
              )}
            </span>
          </label>}
          {!coach && (
            <label className="flex gap-3 items-start mt-4 cursor-pointer">
              <input type="checkbox" checked={accordLecture} onChange={(e) => setAccordLecture(e.target.checked)} className="mt-1 accent-teal" />
              <span className="text-indigo">
                J’accepte que l’app lise dans Nolio mes séances faites, mon RPE, mon ressenti et mon Hooper, et la trace de
                mes séances test (distance, FC) pour en tirer mes repères (FC aux seuils, allures) et les garder, seulement
                pour ajuster mon plan et afficher mes graphiques. Je peux retirer cet accord à tout moment.{' '}
                <span className="text-indigo/70">Facultatif : sans lui, ton plan suit sa trame, sans ajustement à ta fatigue, et tu donnes toi-même tes repères dans l’app.</span>
              </span>
            </label>
          )}
          {!coach && (
            <label className="flex gap-3 items-start mt-4 cursor-pointer">
              <input type="checkbox" checked={debutImmediat} onChange={(e) => setDebutImmediat(e.target.checked)} className="mt-1 accent-teal" />
              <span className="text-indigo">
                <span className="font-semibold">Je demande que ma préparation commence dès mon paiement.</span>{' '}
                <span className="text-indigo/70">Tu gardes ton droit de rétractation de 14 jours : si tu l’exerces, tu es remboursé du prix, moins la part des jours de préparation déjà écoulés.</span>
              </span>
            </label>
          )}
        </section>

        {refus && (
          <p role="alert" className="bg-white rounded-r-xl border-l-4 border-red-400 p-4 text-[0.875rem] text-indigo leading-relaxed">{refus}</p>
        )}

        <section className="bg-indigo text-white rounded-[18px] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <div className="eyebrow text-teal-light mb-2">{demande ? 'Ton objectif · jusqu’à la course' : coach ? `Plan de ${c.nom} · jusqu’à la course` : `Ton plan · ${c.duree_mois} mois`}</div>
            {!coach && <div className="text-4xl font-black">{prix} €</div>}
          </div>
          <button type="button" onClick={generer} disabled={bloque || envoi} className={boutonCls}>
            {envoi
              ? (demande ? 'Envoi…' : coach ? 'Génération…' : 'Vérification…')
              : demande
                ? 'Envoyer à mon coach →'
                : coach
                ? 'Générer le plan de l’athlète →'
                : config.mode_paiement === 'test'
                  ? 'Générer mon plan (test, sans paiement) →'
                  : `Payer ${prix} € →`}
          </button>
        </section>
      </div>
    );
  }

  return (
    <form onSubmit={versRecap} className="space-y-6">
      {!court && <Section numero={1} titre="Toi">
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <label className={labelCls} htmlFor="nom">Nom / prénom</label>
            <input id="nom" className={inputCls} required value={c.nom} onChange={(e) => maj('nom')(e.target.value)} autoComplete="name" />
          </div>
          {!coach && (
            <div>
              <label className={labelCls} htmlFor="email">E-mail</label>
              <input id="email" type="email" className={inputCls} required value={c.email} onChange={(e) => maj('email')(e.target.value)} autoComplete="email" />
              <p className={aideCls}>
                C’est là que part ton plan, et c’est avec elle que tu rejoins Nolio, où arrivent tes séances. Ce que nous
                gardons :{' '}
                <a href="/confidentialite" target="_blank" rel="noopener" className="underline underline-offset-2">politique de confidentialité</a>.
              </p>
              <label className="flex gap-3 items-start mt-3 cursor-pointer">
                <input type="checkbox" checked={autreNolio} onChange={(e) => setAutreNolio(e.target.checked)} className="mt-1 accent-teal" />
                <span className="text-sm text-indigo/80">J’ai déjà un compte Nolio avec une autre adresse.</span>
              </label>
              {autreNolio && (
                <div className="mt-2">
                  <label className={labelCls} htmlFor="nolio_email">Adresse de ton compte Nolio</label>
                  <input id="nolio_email" type="email" className={inputCls} value={nolioEmail}
                    onChange={(e) => setNolioEmail(e.target.value)} autoComplete="off" />
                </div>
              )}
              <label className="flex gap-3 items-start mt-3 cursor-pointer">
                <input type="checkbox" checked={rappel} onChange={(e) => setRappel(e.target.checked)} className="mt-1 accent-teal" />
                <span className="text-sm text-indigo/80">
                  Envoie-moi un rappel si je ne termine pas mon questionnaire.{' '}
                  <span className="text-indigo/60">Un seul e-mail, le lendemain. Tes réponses restent sur ton appareil.</span>
                </span>
              </label>
            </div>
          )}
        </div>
      </Section>}

      <Section numero={court ? 1 : 2} titre={court ? (demande ? 'Ta charge du moment' : 'Sa charge du moment') : 'Ton niveau'}>
        {!court && (
          <>
            <p className={aideCls}>{textes.niveau.aide}</p>
            <div className="space-y-3">
              {textes.niveau.options.map((o) => (
                <Choix key={o.valeur} nom="niveau" valeur={o.valeur} courant={c.niveau} onChange={maj('niveau')}
                  titre={o.titre} description={o.description} detail={o.formats} />
              ))}
            </div>
            <p className="text-sm text-indigo/60 italic">{textes.niveau.note}</p>
          </>
        )}
        <div>
          <p className="font-bold text-indigo mb-2">{textes.charge.titre}</p>
          <p className="text-sm text-indigo/60 leading-relaxed mb-4">{textes.charge.aide}</p>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className={labelCls} htmlFor="volume">{textes.charge.volume}</label>
              <input id="volume" className={inputCls} required placeholder="ex. 4h ou 4h30" value={c.volume_hebdo_actuel} onChange={(e) => maj('volume_hebdo_actuel')(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="sortie_longue">{textes.charge.sortieLongue}</label>
              <input id="sortie_longue" className={inputCls} required placeholder="ex. 1h30 ou 90min" value={c.sortie_longue_actuelle} onChange={(e) => maj('sortie_longue_actuelle')(e.target.value)} />
            </div>
          </div>
          <p className={aideCls}>{textes.charge.note}</p>
          {alerteSl && (
            <p role="status" className="bg-sand rounded-r-xl border-l-4 border-teal px-4 py-3 mt-2 text-[0.8125rem] text-indigo leading-relaxed">{alerteSl}</p>
          )}
        </div>
        <div>
          <p className="font-bold text-indigo mb-3">{textes.charge.coupure}</p>
          <div className="flex gap-3">
            {['non', 'oui'].map((v) => (
              <label key={v} className={clsx('flex items-center gap-2 px-5 py-2.5 rounded-xl border cursor-pointer',
                c.coupure === v ? 'border-teal bg-teal/5' : 'border-indigo/15')}>
                <input type="radio" name="coupure" value={v} checked={c.coupure === v} required onChange={() => maj('coupure')(v)} className="accent-teal" />
                <span className="text-indigo capitalize">{v}</span>
              </label>
            ))}
          </div>
        </div>
      </Section>

      {/* La course d'abord, sa distance comprise (décision coach du 20/10/2026), puis la formule, qui n'offre que les
          durées que cette course admet. Le coaching individualisé n'a pas de formule à choisir (19/10/2026). */}
      <Section numero={court ? 2 : 3} titre={court && !demande ? 'Sa course' : 'Ta course'}>
        {blocDistance}
        {coach && (
          <p className="text-sm text-indigo/75 leading-relaxed">
            La préparation part du lundi qui vient et va jusqu’à la course : 24 semaines au plus (16 pour un trail court),
            prise en route si la course est plus proche.
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <label className={labelCls} htmlFor="course_nom">Nom de la course</label>
            <input id="course_nom" className={inputCls} required value={c.course_nom} onChange={(e) => maj('course_nom')(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="date_course">Date de la course</label>
            <input id="date_course" type="date" className={inputCls} required value={c.date_course} onChange={(e) => maj('date_course')(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 items-end">
          <div>
            <label className={labelCls} htmlFor="dplus">D+ (m)</label>
            <input id="dplus" type="number" step="1" min="0" inputMode="numeric" className={inputCls} required value={c.dplus_m} onChange={(e) => maj('dplus_m')(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="dmoins">D− (m)</label>
            <input id="dmoins" type="number" step="1" min="0" inputMode="numeric" className={inputCls} value={c.dmoins_m} onChange={(e) => maj('dmoins_m')(e.target.value)} />
          </div>
        </div>
        <p className="text-sm text-indigo/60 -mt-3">D− facultatif : laissé vide, on suppose D− = D+.</p>
        <div>
          <label className={labelCls} htmlFor="gpx">Trace GPX de la course — facultatif</label>
          <input id="gpx" type="file" accept=".gpx" className="block text-sm text-indigo" onChange={(e) => choisirTrace(e.target.files?.[0] ?? null)} />
          {avisTrace && (
            <p role="status" className="bg-sand rounded-r-xl border-l-4 border-teal px-4 py-3 mt-2 text-[0.8125rem] text-indigo leading-relaxed">{avisTrace}</p>
          )}
          <p className={aideCls}>{textes.gpx}</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="temps">Temps cible</label>
          <input id="temps" className={inputCls} required placeholder="ex. 5h30" value={c.temps_cible} onChange={(e) => maj('temps_cible')(e.target.value)} />
          {reperes && <p className="text-sm text-teal mt-2 leading-relaxed">{reperes}</p>}
          {bande?.alerte && (
            <p role="status" className="bg-sand rounded-r-xl border-l-4 border-teal px-4 py-3 mt-2 text-[0.8125rem] text-indigo leading-relaxed">{bande.alerte}</p>
          )}
          <p className={aideCls}>
            {textes.tempsCible}
            {c.format && ` Sur ce format, le temps cible ne peut pas dépasser ${config.temps_max_par_format[c.format]}h.`}
          </p>
        </div>
      </Section>

      {!coach && <Section numero={4} titre="Ta formule">
        <fieldset>
          <legend className={labelCls}>Durée du plan</legend>
          {durees.length ? (
            <div className="space-y-2.5">
              {durees.map((d) => (
                <label key={d} className={clsx('flex items-center justify-between gap-3 px-4 py-3 rounded-xl border cursor-pointer',
                  c.duree_mois === String(d) ? 'border-teal bg-teal/5' : 'border-indigo/15')}>
                  <span className="flex items-center gap-3">
                    <input type="radio" name="duree_mois" value={String(d)} checked={c.duree_mois === String(d)} required
                      onChange={() => maj('duree_mois')(String(d))} className="accent-teal" />
                    <span className="text-indigo font-semibold">{d} mois — {config.prix_eur_par_mois[String(d)]} €</span>
                  </span>
                  {d === conseillee && <span className="text-xs font-semibold text-teal">colle à la date de ta course</span>}
                </label>
              ))}
              <p className={aideCls}>Seules les durées qui conviennent à ta course sont proposées.</p>
            </div>
          ) : (
            <p className="text-sm text-indigo/70 leading-relaxed">
              {!c.format ? 'Indique d’abord la distance de ta course, plus haut.'
                : !formatOuvert(c, config) ? 'Aucune durée : ce format n’est pas ouvert à ton niveau.'
                  : 'Aucune durée ne prépare une course visée en ce temps : vérifie ton temps visé.'}
            </p>
          )}
        </fieldset>
      </Section>}

      {!court && <Section numero={coach ? 4 : 5} titre="Ton terrain d’entraînement">
        <div className="grid sm:grid-cols-2 gap-3">
          {textes.terrain.options.map((o) => (
            <Choix key={o.valeur} nom="terrain" valeur={o.valeur} courant={c.terrain} onChange={maj('terrain')}
              titre={o.titre} description={o.description} />
          ))}
        </div>
      </Section>}

      {!court && <Section numero={coach ? 5 : 6} titre="Ta disponibilité">
        <p className={aideCls}>{textes.disponibilite.aide}</p>
        <div>
          <span className={labelCls}>Jours disponibles pour t’entraîner</span>
          <div className="flex flex-wrap gap-2">
            {config.jours.map((j) => (
              <button type="button" key={j} onClick={() => basculerJour(j)} aria-pressed={c.jours_disponibles.includes(j)}
                className={clsx('px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors',
                  c.jours_disponibles.includes(j) ? 'bg-teal border-teal text-white' : 'bg-white border-indigo/20 text-indigo hover:border-indigo/50')}>
                {NOMS_JOURS[j]}
              </button>
            ))}
          </div>
          {joursCoches.length === 0 && <p className="text-sm text-indigo/60 mt-2">Coche au moins un jour.</p>}
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <label className={labelCls} htmlFor="jour_sl">Jour de la sortie longue</label>
            <select id="jour_sl" className={inputCls} required value={c.jour_sl} onChange={(e) => maj('jour_sl')(e.target.value)} disabled={joursCoches.length === 0}>
              <option value="">— choisir —</option>
              {joursCoches.map((j) => <option key={j} value={j}>{NOMS_JOURS[j]}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="freq">Séances par semaine</label>
            <input id="freq" type="number" min={freqMin} max={Math.max(freqMin, Math.min(7, joursCoches.length, freqMax))} className={inputCls} required
              value={c.freq_hebdo} onChange={(e) => maj('freq_hebdo')(e.target.value)} />
            {plancher?.note && <p className={aideCls}>{plancher.note}</p>}
          </div>
        </div>
      </Section>}

      {/* La blessure en cours (décision coach du 19/10/2026) : gardée pour les plans achetés (le garde-fou d'O1 et des
          CGV), retirée du coaching individualisé, où le coach connaît son athlète et où rien n'était transmis. */}
      {!coach && <Section numero={7} titre="Avant de commencer">
        {(['blessure'] as const).map((q) => (
          <div key={q}>
            <p className="font-bold text-indigo mb-3">{textes.sante[q]}</p>
            <div className="flex gap-3">
              {['non', 'oui'].map((v) => (
                <label key={v} className={clsx('flex items-center gap-2 px-5 py-2.5 rounded-xl border cursor-pointer',
                  c[q] === v ? 'border-teal bg-teal/5' : 'border-indigo/15')}>
                  <input type="radio" name={q} value={v} checked={c[q] === v} required onChange={() => maj(q)(v)} className="accent-teal" />
                  <span className="text-indigo capitalize">{v}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        {/* « Oui » arrête l'achat (décision coach du 20/10/2026) : une préparation automatique ne convient pas à une blessure
            en cours (O1, CGV) ; l'athlète est orienté vers un professionnel de santé, et vers le coaching des kinés du sport. La
            réponse ne quitte toujours pas la page. */}
        {c.blessure === 'oui' && (
          <div role="alert" className="rounded-r-xl border-l-4 border-teal bg-sand p-4 space-y-3 text-[0.875rem] text-indigo leading-relaxed">
            <p>
              Avec une douleur ou une blessure en cours, une préparation automatique n’est pas adaptée. Fais d’abord le point
              avec un professionnel de santé (médecin, kinésithérapeute).
            </p>
            <p>Si tu veux être accompagné pour reprendre, nos coachs sont kinés du sport :</p>
            <a href="/#contact" className="inline-flex items-center min-h-11 font-bold text-teal">Parle-nous de ton projet ›</a>
          </div>
        )}
      </Section>}

      {refus && (
        <p role="alert" className="bg-white rounded-r-xl border-l-4 border-red-400 p-4 text-[0.875rem] text-indigo leading-relaxed">{refus}</p>
      )}
      <div className="flex justify-end">
        <button type="submit" className={boutonCls} disabled={joursCoches.length === 0 || envoi || (!coach && c.blessure === 'oui')}>
          {envoi ? 'Vérification…' : 'Vérifier mes réponses →'}
        </button>
      </div>
    </form>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  API_URL, alerteSortieLongue, ambitionsOuvertes, avertissements, bandeTempsCible, champsVides, formatDepuisDistance, formatOuvert,
  intakePourApi, noteFormat, plancherSeances, reperesChrono, textes,
  type Champs, type ConfigPlan,
} from '@/lib/plan';

const NOMS_JOURS: Record<string, string> = {
  lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi', jeudi: 'Jeudi',
  vendredi: 'Vendredi', samedi: 'Samedi', dimanche: 'Dimanche',
};
const CLE_BROUILLON = 'cts-plan-brouillon';

const inputCls =
  'w-full bg-white border border-indigo/20 focus:border-teal px-4 py-3 text-indigo outline-none transition-colors';
const labelCls = 'block text-xs font-semibold tracking-cts uppercase text-indigo/70 mb-2';
const aideCls = 'text-sm text-indigo/60 leading-relaxed mt-2';
// Nombres à la française dans le récapitulatif : « 13,3 km », « 2 706 m », pas la saisie
// brute « 13.3 » (audit du 27/09/2026, K1).
const nombreFr = (v: string) => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : v;
};

function Section({ numero, titre, children }: { numero: number; titre: string; children: React.ReactNode }) {
  return (
    <section id={`section-${numero}`} className="bg-white border border-indigo/10 p-6 sm:p-8 scroll-mt-6">
      <div className="flex items-baseline gap-3 mb-6">
        <span className="text-teal font-extrabold text-sm">{String(numero).padStart(2, '0')}</span>
        <h2 className="text-xl sm:text-2xl text-indigo">{titre}</h2>
      </div>
      <div className="space-y-6">{children}</div>
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
        'flex gap-4 p-4 border cursor-pointer transition-colors',
        actif ? 'border-teal bg-teal/5' : 'border-indigo/15 hover:border-indigo/40'
      )}
    >
      <input
        type="radio" name={nom} value={valeur} checked={actif} required
        onChange={() => onChange(valeur)} className="mt-1 accent-teal"
      />
      <span>
        <span className="block font-bold text-indigo">{titre}</span>
        {description && <span className="block text-sm text-indigo/70 leading-relaxed mt-1">{description}</span>}
        {detail && <span className="block text-xs text-teal font-semibold mt-2">{detail}</span>}
      </span>
    </label>
  );
}

export default function Questionnaire() {
  const [config, setConfig] = useState<ConfigPlan | null>(null);
  const [erreurConfig, setErreurConfig] = useState('');
  const [c, setC] = useState<Champs>(champsVides);
  const [gpx, setGpx] = useState<File | null>(null);
  // Trace vérifiée dès son choix, sans rien bloquer (audit du 27/09/2026, T3 ; décision coach
  // du 28/09/2026) : l'athlète apprenait après avoir payé qu'elle était illisible.
  const [avisTrace, setAvisTrace] = useState('');
  const traceDemandee = useRef(0);
  const [etape, setEtape] = useState<'formulaire' | 'recap'>('formulaire');
  const [confirme, setConfirme] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/v1/config`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setConfig)
      .catch(() => setErreurConfig('Le service de génération ne répond pas. Réessaie dans quelques minutes.'));
    try {
      const brouillon = localStorage.getItem(CLE_BROUILLON);
      // La réponse de santé n'est jamais reprise d'un brouillon, même ancien.
      if (brouillon) setC({ ...champsVides, ...JSON.parse(brouillon), blessure: '' });
    } catch {
      /* brouillon illisible : on repart de zéro */
    }
  }, []);

  useEffect(() => {
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

  const maj = (champ: keyof Champs) => (v: string) => setC((p) => ({ ...p, [champ]: v }));

  // Le format se déduit de la distance (F4) : un format que le niveau n'ouvre pas ne propose
  // aucune durée, et la note sous la distance dit pourquoi.
  const durees = config && formatOuvert(c, config) ? config.durees_par_format[c.format] ?? [] : [];
  const notePourFormat = config ? noteFormat(c, config) : null;
  const joursCoches = (config?.jours ?? []).filter((j) => c.jours_disponibles.includes(j));
  const plancher = config ? plancherSeances(c, config) : null;
  const freqMin = plancher?.min ?? 3;
  const freqMax = plancher?.max ?? 7;
  const reperes = config ? reperesChrono(c, config) : null;
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
      // Passer en débutant efface « Performer », qu'il ne propose pas (F3, 01/10/2026). Une seule
      // ambition ouverte (le débutant depuis le 06/10/2026) : elle est retenue d'office.
      const ambitions = ambitionsOuvertes(n, config);
      if (ambitions.length === 1) n.ambition = ambitions[0].valeur;
      else if (n.ambition && !ambitions.some((o) => o.valeur === n.ambition)) n.ambition = '';
      if (n.duree_mois && !(formatOuvert(n, config) ? config.durees_par_format[n.format] ?? [] : []).map(String).includes(n.duree_mois)) n.duree_mois = '';
      if (n.jour_sl && !n.jours_disponibles.includes(n.jour_sl)) n.jour_sl = '';
      // Plafond du niveau (second audit, D4) : passer en débutant avec 5 séances ou plus
      // vide le champ, comme les autres réponses devenues invalides.
      if (n.freq_hebdo && Number(n.freq_hebdo) > (config.freq_max_par_niveau?.[n.niveau] ?? 7)) n.freq_hebdo = '';
      return JSON.stringify(n) === JSON.stringify(p) ? p : n;
    });
  }, [config, c.niveau, c.format, c.distance_km, c.jours_disponibles, c.jour_sl, c.duree_mois]);

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
      const r = await fetch(`${API_URL}/v1/verification`, {
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
  const nomAmbition = textes.ambition.options.find((o) => o.valeur === c.ambition)?.titre ?? '';
  const nomTerrain = textes.terrain.options.find((o) => o.valeur === c.terrain)?.titre ?? '';

  if (etape === 'recap') {
    const lignes: [string, string][] = [
      ['Nom', c.nom], ['E-mail', c.email], ['Niveau', nomNiveau],
      ['En ce moment', `${c.volume_hebdo_actuel} de course par semaine · plus longue sortie ${c.sortie_longue_actuelle}`],
      ['Formule', `${nomFormat} — ${c.duree_mois} mois`],
      ['Course', `${c.course_nom}, le ${new Date(`${c.date_course}T00:00:00`).toLocaleDateString('fr-FR')}`],
      ['Parcours', `${nombreFr(c.distance_km)} km, ${nombreFr(c.dplus_m)} m D+${c.dmoins_m ? `, ${nombreFr(c.dmoins_m)} m D−` : ''}${gpx ? ` · trace ${gpx.name}` : ' · sans trace GPX'}`],
      ['Temps cible', c.temps_cible], ['Ambition', nomAmbition], ['Terrain', nomTerrain],
      ['Disponibilité', `${c.freq_hebdo} séances par semaine · ${joursCoches.map((j) => NOMS_JOURS[j]).join(', ')} · sortie longue le ${c.jour_sl}`],
    ];
    const bloque = alertes.length > 0 && !confirme;
    return (
      <div className="space-y-6">
        <section className="bg-white border border-indigo/10 p-6 sm:p-8">
          <h2 className="text-xl sm:text-2xl text-indigo mb-6">Relis tes réponses</h2>
          <dl className="divide-y divide-indigo/10">
            {lignes.map(([k, v]) => (
              <div key={k} className="grid sm:grid-cols-[10rem,1fr] gap-1 sm:gap-4 py-3">
                <dt className="text-xs font-semibold tracking-cts uppercase text-indigo/60">{k}</dt>
                <dd className="text-indigo">{v}</dd>
              </div>
            ))}
          </dl>
          <button type="button" onClick={() => setEtape('formulaire')} className="btn btn-outline-dark mt-6 !py-3 text-xs">
            ← Modifier mes réponses
          </button>
        </section>

        {alertes.length > 0 && (
          <section className="bg-white border-l-4 border-teal p-6 sm:p-8">
            <h2 className="text-lg text-indigo mb-4">Avant de générer ton plan, lis ces points</h2>
            <ul className="space-y-3 text-indigo/80 leading-relaxed list-disc pl-5">
              {alertes.map((a) => <li key={a}>{a}</li>)}
            </ul>
            <label className="flex gap-3 items-start mt-6 cursor-pointer">
              <input type="checkbox" checked={confirme} onChange={(e) => setConfirme(e.target.checked)} className="mt-1 accent-teal" />
              <span className="text-indigo font-semibold">J’ai lu ces points et je veux générer mon plan.</span>
            </label>
          </section>
        )}

        {refus && (
          <p role="alert" className="bg-white border-l-4 border-red-400 p-5 text-indigo leading-relaxed">{refus}</p>
        )}

        <section className="bg-indigo text-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="eyebrow text-teal-light mb-2">Ton plan · {c.duree_mois} mois</div>
            <div className="text-4xl font-black">{prix} €</div>
          </div>
          <button type="button" onClick={generer} disabled={bloque || envoi} className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            {envoi
              ? 'Vérification…'
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
      <Section numero={1} titre="Toi">
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <label className={labelCls} htmlFor="nom">Nom / prénom</label>
            <input id="nom" className={inputCls} required value={c.nom} onChange={(e) => maj('nom')(e.target.value)} autoComplete="name" />
          </div>
          <div>
            <label className={labelCls} htmlFor="email">E-mail</label>
            <input id="email" type="email" className={inputCls} required value={c.email} onChange={(e) => maj('email')(e.target.value)} autoComplete="email" />
            <p className={aideCls}>C’est là que part ton plan.</p>
          </div>
        </div>
      </Section>

      <Section numero={2} titre="Ton niveau">
        <p className={aideCls}>{textes.niveau.aide}</p>
        <div className="space-y-3">
          {textes.niveau.options.map((o) => (
            <Choix key={o.valeur} nom="niveau" valeur={o.valeur} courant={c.niveau} onChange={maj('niveau')}
              titre={o.titre} description={o.description} detail={o.formats} />
          ))}
        </div>
        <p className="text-sm text-indigo/60 italic">{textes.niveau.note}</p>
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
            <p role="status" className="bg-white border-l-4 border-teal px-4 py-3 mt-2 text-sm text-indigo leading-relaxed">{alerteSl}</p>
          )}
        </div>
        <div>
          <p className="font-bold text-indigo mb-3">{textes.charge.coupure}</p>
          <div className="flex gap-3">
            {['non', 'oui'].map((v) => (
              <label key={v} className={clsx('flex items-center gap-2 px-5 py-2 border cursor-pointer',
                c.coupure === v ? 'border-teal bg-teal/5' : 'border-indigo/15')}>
                <input type="radio" name="coupure" value={v} checked={c.coupure === v} required onChange={() => maj('coupure')(v)} className="accent-teal" />
                <span className="text-indigo capitalize">{v}</span>
              </label>
            ))}
          </div>
        </div>
      </Section>

      <Section numero={3} titre="Ta formule">
        <div>
          <label className={labelCls} htmlFor="distance">Distance de ta course (km)</label>
          <input id="distance" type="number" step="0.1" min="0.1" inputMode="decimal" className={inputCls} required value={c.distance_km} onChange={(e) => maj('distance_km')(e.target.value)} />
          <p className="text-sm text-teal mt-2 leading-relaxed">{notePourFormat ?? 'Le format de ta course se déduit de sa distance.'}</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="duree">Durée du plan</label>
          <select id="duree" className={inputCls} required value={c.duree_mois} onChange={(e) => maj('duree_mois')(e.target.value)} disabled={!durees.length}>
            <option value="">{durees.length ? '— choisir —' : c.format ? 'Aucune durée : ce format n’est pas ouvert à ton niveau' : 'Indique d’abord la distance de ta course'}</option>
            {durees.map((d) => <option key={d} value={String(d)}>{d} mois — {config.prix_eur_par_mois[String(d)]} €</option>)}
          </select>
        </div>
      </Section>

      <Section numero={4} titre="Ta course">
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
        <p className="text-sm text-indigo/60 -mt-3">D− facultatif : laissé vide, on suppose D− = D+ et le PDF le signale.</p>
        <div>
          <label className={labelCls} htmlFor="gpx">Trace GPX de la course — facultatif</label>
          <input id="gpx" type="file" accept=".gpx" className="block text-sm text-indigo" onChange={(e) => choisirTrace(e.target.files?.[0] ?? null)} />
          {avisTrace && (
            <p role="status" className="bg-white border-l-4 border-teal px-4 py-3 mt-2 text-sm text-indigo leading-relaxed">{avisTrace}</p>
          )}
          <p className={aideCls}>{textes.gpx}</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="temps">Temps cible</label>
          <input id="temps" className={inputCls} required placeholder="ex. 5h30" value={c.temps_cible} onChange={(e) => maj('temps_cible')(e.target.value)} />
          {reperes && <p className="text-sm text-teal mt-2 leading-relaxed">{reperes}</p>}
          {bande && <p className="text-sm text-teal mt-2 leading-relaxed">{bande.annonce}</p>}
          {bande?.alerte && (
            <p role="status" className="bg-white border-l-4 border-teal px-4 py-3 mt-2 text-sm text-indigo leading-relaxed">{bande.alerte}</p>
          )}
          <p className={aideCls}>
            {textes.tempsCible}
            {c.format && ` Sur ce format, le temps cible ne peut pas dépasser ${config.temps_max_par_format[c.format]}h.`}
          </p>
        </div>
        {ambitionsOuvertes(c, config).length > 1 && (
        <div>
          <p className="font-bold text-indigo mb-2">Qu’est-ce que tu vises sur cette course ?</p>
          <p className="text-sm text-indigo/60 leading-relaxed mb-4">{textes.ambition.intro}</p>
          <div className="space-y-3">
            {ambitionsOuvertes(c, config).map((o) => (
              <Choix key={o.valeur} nom="ambition" valeur={o.valeur} courant={c.ambition} onChange={maj('ambition')}
                titre={o.titre} description={o.description} />
            ))}
          </div>
        </div>
        )}
      </Section>

      <Section numero={5} titre="Ton terrain d’entraînement">
        <p className={aideCls}>{textes.terrain.aide}</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {textes.terrain.options.map((o) => (
            <Choix key={o.valeur} nom="terrain" valeur={o.valeur} courant={c.terrain} onChange={maj('terrain')}
              titre={o.titre} description={o.description} />
          ))}
        </div>
      </Section>

      <Section numero={6} titre="Ta disponibilité">
        <p className={aideCls}>{textes.disponibilite.aide}</p>
        <div>
          <span className={labelCls}>Jours disponibles pour t’entraîner</span>
          <div className="flex flex-wrap gap-2">
            {config.jours.map((j) => (
              <button type="button" key={j} onClick={() => basculerJour(j)} aria-pressed={c.jours_disponibles.includes(j)}
                className={clsx('px-4 py-2 border text-sm font-semibold transition-colors',
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
            <p className={aideCls}>{plancher?.note}</p>
          </div>
        </div>
      </Section>

      <Section numero={7} titre="Avant de commencer">
        {(['blessure'] as const).map((q) => (
          <div key={q}>
            <p className="font-bold text-indigo mb-3">{textes.sante[q]}</p>
            <div className="flex gap-3">
              {['non', 'oui'].map((v) => (
                <label key={v} className={clsx('flex items-center gap-2 px-5 py-2 border cursor-pointer',
                  c[q] === v ? 'border-teal bg-teal/5' : 'border-indigo/15')}>
                  <input type="radio" name={q} value={v} checked={c[q] === v} required onChange={() => maj(q)(v)} className="accent-teal" />
                  <span className="text-indigo capitalize">{v}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        <p className="text-sm text-indigo/60">Cette réponse reste sur ta page : elle sert seulement à t’afficher un conseil avant de générer ton plan.</p>
      </Section>

      {refus && (
        <p role="alert" className="bg-white border-l-4 border-red-400 p-5 text-indigo leading-relaxed">{refus}</p>
      )}
      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary disabled:opacity-50" disabled={joursCoches.length === 0 || envoi}>
          {envoi ? 'Vérification…' : 'Vérifier mes réponses →'}
        </button>
      </div>
    </form>
  );
}

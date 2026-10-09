/**
 * S'adapter aux retours (cadrage de l'app §7.2, étape 3, décisions coach A1 à A7 du 08/10/2026 ;
 * CTS_ADAPTATION_REFLEXION.md dans le dépôt du moteur). Aucune règle nouvelle : chaque règle est une
 * phrase du mode d'emploi, que le journal déclenche et que l'app propose ; l'athlète accepte ou non.
 * - Règle 1 : une EF ou une mécanique pas faite ne se rattrape pas (un texte).
 * - Règle 2 : une marche pas faite, raccourcie, ressentie trop dure ou allégée par la règle 3 (A8) est
 *   reprise par la séance suivante de sa progression (la suite, dite par le moteur).
 * - Règle 3 : deux signaux de fatigue en sept jours, et la prochaine séance de qualité devient une EF de
 *   même durée (préparée par le moteur).
 * Le moteur dit les suites, les versions EF, les seuils et les textes ; l'app ne fait que compter les
 * retours et remplacer un contenu par un autre. Une proposition à la fois, la fatigue d'abord ; elle
 * expire quand la séance visée est passée. Le plan vendu ne change pas (5.5).
 */
import { ajouterJours, dateLongue, tousLesJours, type Jour, type JourDuPlan, type Plan } from './plan';
import { rpePrevu, type Retour, type Retours } from './journal';

export type Regle = 'marche' | 'fatigue';
export type Ajustement = { regle: Regle; cible: string; source: string | null; statut: 'applique' | 'refuse'; decide_le: string };

// Textes de l'app validés par le coach le 08/10/2026 (A7) ; les textes des règles viennent du moteur.
export const BOUTONS = { appliquer: 'Appliquer', refuser: 'Non merci', annuler: 'Annuler l’ajustement' } as const;
// A9 (décision coach du 09/10/2026) : la marche reprise fait reculer d'un cran toute la suite de sa
// progression, pour qu'aucune séance ne saute deux marches ensuite. Textes validés avec la décision.
const RECUL = "Les séances suivantes de cette progression reculent aussi d'une marche.";
const MENTION_RECUL = 'Ajustée · une marche plus bas que prévu';
// Un plan d'avant le moteur 8.314 n'a que la règle 1 : la phrase de son mode d'emploi.
const RATTRAPE_SANS_MOTEUR = 'Ne la rattrape pas : reprends le plan là où il en est.';

export const texteRattrape = (plan: Plan) => plan.adaptation?.textes.rattrape ?? RATTRAPE_SANS_MOTEUR;

// Le plan ajusté : chaque ajustement appliqué remplace des contenus, chaque séance gardant sa place et sa
// suite. Une marche reprise : la séance visée prend le contenu de sa source, et toute la suite de sa
// progression recule d'un cran, chacune prenant le contenu de la précédente jusqu'au bout de la chaîne
// (A9) ; rien n'est jamais plus dur que prévu, et le plan finit une marche plus bas. Une séance allégée
// prend sa version EF et garde sa marche d'avant (A8). Les ajustements se résolvent dans l'ordre des dates.
export function ajuster(plan: Plan, ajustements: Ajustement[]): Plan {
  const appliques = ajustements.filter((a) => a.statut === 'applique');
  if (!appliques.length) return plan;
  const semaines = plan.semaines.map((s) => ({ ...s, jours: [...s.jours] }));
  const place = new Map<string, [number, number]>();
  semaines.forEach((s, i) => s.jours.forEach((j, k) => place.set(j.id, [i, k])));
  const lire = (id: string) => {
    const p = place.get(id);
    return p ? semaines[p[0]].jours[p[1]] : undefined;
  };
  const ordre = (a: Ajustement) => [lire(a.cible)?.date_iso ?? '', a.regle === 'marche' ? 0 : 1] as const;
  const tries = [...appliques].sort((a, b) => {
    const [da, ra] = ordre(a);
    const [db, rb] = ordre(b);
    return da < db ? -1 : da > db ? 1 : ra - rb;
  });
  for (const a of tries) {
    const cible = lire(a.cible);
    const p = place.get(a.cible);
    if (!cible || !p) continue;
    const prevu = cible.ajuste?.prevu ?? cible.seance;
    const placeDe = { id: cible.id, jour: cible.jour, date: cible.date, date_iso: cible.date_iso };
    let contenu: Jour | null = null;
    if (a.regle === 'marche' && a.source) {
      // Une source allégée (A8) : sa suite reprend la marche d'avant l'allègement, pas l'EF.
      const lue = lire(a.source);
      const source = lue?.ajuste?.regle === 'fatigue' && lue.ajuste.avant ? { ...lue.ajuste.avant, id: lue.id } : lue;
      if (!source) continue;
      const chaine: string[] = [];
      for (let id: string | null = a.cible; id && place.has(id) && !chaine.includes(id); id = lire(id)!.adaptation?.suite ?? null)
        chaine.push(id);
      let entrant: Jour = source;
      chaine.forEach((id, n) => {
        const actuel = lire(id)!;
        const [i, k] = place.get(id)!;
        const ici = {
          id: actuel.id, jour: actuel.jour, date: actuel.date, date_iso: actuel.date_iso,
          adaptation: { suite: actuel.adaptation?.suite ?? null, ef: entrant.adaptation?.ef ?? null },
        };
        const allegee = actuel.ajuste?.regle === 'fatigue' && actuel.ajuste.avant;
        const sortant = allegee ? actuel.ajuste!.avant! : actuel;
        if (allegee) {
          // Reste allégée ; sa marche d'avant devient celle qui lui arrive.
          semaines[i].jours[k] = { ...actuel, ajuste: { ...actuel.ajuste!, avant: { ...entrant, ...ici } } };
        } else {
          const prevuIci = actuel.ajuste?.prevu ?? actuel.seance;
          semaines[i].jours[k] = {
            ...entrant, ...ici,
            ajuste: n === 0 ? { regle: 'marche', source: source.id, prevu: prevuIci } : { regle: 'marche', source: null, prevu: prevuIci, recul: true },
          };
        }
        entrant = sortant;
      });
      continue;
    } else if (a.regle === 'fatigue' && cible.adaptation?.ef) {
      contenu = {
        ...cible.adaptation.ef, ...placeDe,
        adaptation: { suite: cible.adaptation.suite, ef: null },
        ajuste: { regle: 'fatigue', source: null, prevu, avant: cible },
      };
    }
    if (contenu) semaines[p[0]].jours[p[1]] = contenu;
  }
  return { ...plan, semaines };
}

// ─── Les propositions ─────────────────────────────────────────────────────

type Signal = { jour: JourDuPlan; type: 'sensations' | 'raccourcie' | 'rpe'; retour: Retour };
export type Proposition =
  | {
      regle: 'marche'; source: JourDuPlan; cible: JourDuPlan; raison: 'pas_faite' | 'raccourcie' | 'trop_dure' | 'allegee';
      retour: Retour | null; modele: Jour;
    }
  | { regle: 'fatigue'; cible: JourDuPlan; signaux: Signal[] };

const tropDure = (j: Jour, r: Retour, ecart: number) =>
  r.statut !== 'pas_faite' && r.rpe !== null && r.rpe >= rpePrevu(j) + ecart;

// La proposition du moment, ou null. plan : ajusté et rangé (celui du contexte).
export function proposition(plan: Plan, retours: Retours, ajustements: Ajustement[], aujourdhui: string): Proposition | null {
  const regles = plan.adaptation;
  if (!regles) return null;
  const { seuils } = regles;
  const jours = tousLesJours(plan).filter((j) => j.date_iso);
  const parId = new Map(jours.map((j) => [j.id, j]));
  const decide = (regle: Regle, cible: string) => ajustements.some((a) => a.regle === regle && a.cible === cible);
  const allegee = (cible: string) => ajustements.some((a) => a.regle === 'fatigue' && a.cible === cible && a.statut === 'applique');
  const ouverte = (j: JourDuPlan) => j.date_iso! >= aujourdhui && !retours[j.id] && !j.placement?.fixe;

  // Règle 3 — la fatigue d'abord : deux signaux en sept jours, sur des retours d'après la dernière décision.
  const depuis = ajustements.filter((a) => a.regle === 'fatigue').map((a) => a.decide_le).sort().slice(-1)[0] ?? '';
  const debut = ajouterJours(aujourdhui, 1 - seuils.fenetre_jours);
  const signaux: Signal[] = [];
  for (const j of jours) {
    const r = retours[j.id];
    if (!r || j.date_iso! < debut || j.date_iso! > aujourdhui || j.date_iso! <= depuis) continue;
    const type = r.sensations !== null && r.sensations <= seuils.sensations_max ? 'sensations'
      : r.statut === 'raccourcie' ? 'raccourcie'
      : tropDure(j, r, seuils.rpe_ecart) ? 'rpe' : null;
    if (type) signaux.push({ jour: j, type, retour: r });
  }
  if (signaux.length >= seuils.signaux) {
    const cible = jours.find((j) => j.adaptation?.ef && ouverte(j) && !decide('fatigue', j.id));
    if (cible) return { regle: 'fatigue', cible, signaux: signaux.slice(-seuils.signaux) };
  }

  // Règle 2 — une marche non tenue : la séance suivante de sa progression la reprend. Une marche allégée
  // (A8) n'a pas été tenue non plus, dès son jour passé : sa suite reprend la marche d'avant l'allègement.
  const candidats: Proposition[] = [];
  for (const source of jours) {
    const r = retours[source.id] ?? null;
    const suite = source.adaptation?.suite;
    const avant = source.ajuste?.regle === 'fatigue' ? source.ajuste.avant : undefined;
    if (!suite || (!r && !(avant && source.date_iso! <= aujourdhui))) continue;
    const raison = avant ? 'allegee' : !r ? null : r.statut === 'pas_faite' ? 'pas_faite'
      : r.statut === 'raccourcie' ? 'raccourcie' : tropDure(source, r, seuils.rpe_ecart) ? 'trop_dure' : null;
    const cible = parId.get(suite);
    if (!raison || !cible || !ouverte(cible) || decide('marche', cible.id) || allegee(cible.id)) continue;
    candidats.push({ regle: 'marche', source, cible, raison, retour: r, modele: avant ?? source });
  }
  candidats.sort((a, b) => (a.cible.date_iso! < b.cible.date_iso! ? -1 : 1));
  return candidats[0] ?? null;
}

// ─── Les textes d'une proposition ─────────────────────────────────────────

const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const jourDeLaSemaine = (iso: string) => dateLongue(iso).split(' ')[0];

// Le corps d'une séance en quelques mots : « 5 × 3′ » d'une ligne, sinon la cible (« 10′ à RPE 8 »),
// sans coupure de ligne autour du « × ».
function resume(j: Jour) {
  const corps = j.carte?.parties.find(([libelle]) => libelle === 'Corps')?.[1];
  const texte = corps && !corps.includes('\n') ? corps.split(' RPE')[0].trim() : (j.carte?.entete.Cible ?? j.duree);
  return texte.replace(/ × /g, '\u00a0×\u00a0');
}

export type TextesProposition = { titre: string; raison: string; suite: string; concret: string; renvoi: string | null };

export function textes(plan: Plan, p: Proposition): TextesProposition | null {
  const t = plan.adaptation?.textes;
  if (!t) return null;
  const date = majuscule(dateLongue(p.cible.date_iso!));
  if (p.regle === 'marche') {
    const m = p.modele;
    const sl = m.famille === 'sl';
    const raison = (t.marche.raisons[p.raison] ?? '')
      .replace('{ressenti}', String(p.retour?.rpe ?? ''))
      .replace('{prevu}', String(rpePrevu(m)));
    const [nouveau, prevu] = sl ? [m.duree, p.cible.duree] : [resume(m), resume(p.cible)];
    const concret = m.seance === p.cible.seance
      ? `${date}, ${p.cible.seance} : ${nouveau} au lieu de ${prevu}.`
      : `${date} : ${m.seance}, ${nouveau} au lieu de ${p.cible.seance}, ${prevu}.`;
    const suite = (sl ? t.marche.suite_sl : t.marche.suite) + (p.cible.adaptation?.suite ? ` ${RECUL}` : '');
    return { titre: t.marche.titre, raison: `${raison}.`, suite, concret, renvoi: null };
  }
  const liste = p.signaux.map((s) => {
    const jour = jourDeLaSemaine(s.jour.date_iso!);
    return t.fatigue.signaux[s.type]
      .replace('{sensations}', String(s.retour.sensations ?? ''))
      .replace('{ressenti}', String(s.retour.rpe ?? ''))
      .replace('{prevu}', String(rpePrevu(s.jour)))
      .replace('{jour}', jour);
  });
  const ef = p.cible.adaptation!.ef!;
  return {
    titre: t.fatigue.titre,
    raison: t.fatigue.raison.replace('{signaux}', liste.join(', ')),
    suite: t.fatigue.proposition,
    concret: `${date} : ${p.cible.seance} devient ${ef.seance}, ${ef.duree}.`,
    renvoi: t.fatigue.renvoi,
  };
}

// « Ajustée · même marche que le mardi 10 novembre » ; « Ajustée · une marche plus bas que prévu » ;
// « Allégée · prévue Seuil 2 — Fractions ».
export function mentionAjustee(plan: Plan, j: Jour) {
  if (!j.ajuste) return null;
  if (j.ajuste.regle === 'fatigue') return `Allégée · prévue ${j.ajuste.prevu}`;
  if (j.ajuste.recul) return MENTION_RECUL;
  const source = j.ajuste.source ? tousLesJours(plan).find((x) => x.id === j.ajuste!.source) : undefined;
  return source?.date_iso ? `Ajustée · même marche que le ${dateLongue(source.date_iso)}` : 'Ajustée';
}

// « Annuler l'ajustement » : tant que la séance est à venir et sans retour. Une séance qui a seulement
// reculé d'une marche s'annule avec la séance qui a repris la marche, d'où vient le recul.
export const peutAnnuler = (j: Jour, retours: Retours, aujourdhui: string) =>
  !!j.ajuste && !j.ajuste.recul && !!j.date_iso && j.date_iso >= aujourdhui && !retours[j.id];

/**
 * Les chiffres du coaching individualisé (onglet « Coaching individualisé » de « Chiffres » ; décisions coach du
 * 04/11/2026, relecture écran par écran) : en tête, un seul chiffre, la part des semaines envoyées que le coach n'a pas
 * retouchées dans Nolio sur les 4 dernières semaines, et sa tendance (elle doit monter au fil des dimanches) ; puis ses
 * retouches dans Nolio (décision coach du 26/10/2026), par semaine et par famille, comptées la nuit
 * (lib/app/retouches.ts). Tout vient de la base, rien n'est lu dans Nolio. Côté serveur seulement.
 *
 * UNE SEMAINE NON RETOUCHÉE : une semaine écrite par le moteur et envoyée (une ligne de la table retouches, par objectif
 * et par semaine, avec au moins une séance envoyée) dont aucune séance n'a été modifiée ni supprimée dans Nolio, et où le
 * coach n'a ajouté aucune séance de course. Comptée sur les 4 dernières semaines finies (la semaine en cours peut encore
 * se retoucher), comparée aux 4 d'avant.
 */
import { ajouterJours } from './plan';
import { FAMILLES_RETOUCHE, retouchesDuCoach, type FamilleRetouche, type Familles, type RetouchesSemaine } from './retouches';

// Par famille, sur les 4 dernières semaines : ecart, l'écart de durée des séances modifiées (−0,15 : 15 % plus courtes),
// null sans durée lue.
export type RetouchesFamille = { famille: FamilleRetouche; envoyees: number; modifiees: number; supprimees: number; ecart: number | null };
// Par semaine : les séances (envoyées, modifiées, supprimées, ajoutées), et les semaines envoyées et celles restées intactes.
export type SemaineRetouches = RetouchesSemaine & { semaines: number; intactes: number };
export type PartSansRetouche = { intactes: number; semaines: number; part: number | null };
export type ChiffresCoaching = {
  lundi: string;
  sansRetouche: { dernieres: PartSansRetouche; avant: PartSansRetouche } | null;
  retouches: { semaines: SemaineRetouches[]; familles: RetouchesFamille[] } | null;
};

const SEMAINES = 8;
// Les 4 dernières semaines finies, et les 4 d'avant : 9 lundis avec celui de la semaine en cours.
const FENETRE = 4;

const total = (f: Familles, k: 'envoyees' | 'modifiees' | 'supprimees') => Object.values(f).reduce((t, x) => t + (x?.[k] ?? 0), 0);
// Une semaine envoyée (au moins une séance comptée), et intacte : rien de modifié, supprimé ni ajouté.
const envoyee = (x: { familles: Familles }) => total(x.familles, 'envoyees') > 0;
const intacte = (x: { familles: Familles; ajoutees: number }) => total(x.familles, 'modifiees') + total(x.familles, 'supprimees') + x.ajoutees === 0;
const partDe = (lignes: { familles: Familles; ajoutees: number }[]): PartSansRetouche => {
  const envoyees = lignes.filter(envoyee);
  const intactes = envoyees.filter(intacte).length;
  return { intactes, semaines: envoyees.length, part: envoyees.length ? intactes / envoyees.length : null };
};

export async function chiffresDuCoaching(coachId: string): Promise<ChiffresCoaching> {
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const lundi = ajouterJours(jour, -((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7));
  const lundis = Array.from({ length: 2 * FENETRE + 1 }, (_, i) => ajouterJours(lundi, -7 * i));
  // Les retouches : rien tant qu'aucune semaine n'a été comptée.
  const comptees = await retouchesDuCoach(coachId, lundis[lundis.length - 1]);
  if (!comptees.length) return { lundi, sansRetouche: null, retouches: null };
  const dans = (ls: string[]) => comptees.filter((x) => ls.includes(x.lundi));
  const affichees = lundis.slice(0, SEMAINES);
  return {
    lundi,
    sansRetouche: { dernieres: partDe(dans(lundis.slice(1, 1 + FENETRE))), avant: partDe(dans(lundis.slice(1 + FENETRE))) },
    retouches: {
      semaines: affichees.map((l): SemaineRetouches => {
        const duLundi = dans([l]);
        const somme = (k: 'envoyees' | 'modifiees' | 'supprimees') => duLundi.reduce((t, x) => t + total(x.familles, k), 0);
        const p = partDe(duLundi);
        return { lundi: l, envoyees: somme('envoyees'), modifiees: somme('modifiees'), supprimees: somme('supprimees'),
          ajoutees: duLundi.reduce((t, x) => t + x.ajoutees, 0), semaines: p.semaines, intactes: p.intactes };
      }),
      familles: FAMILLES_RETOUCHE.map((famille): RetouchesFamille => {
        const f = dans(affichees.slice(0, FENETRE)).map((x) => x.familles[famille]).filter((x) => x !== undefined);
        const somme = (k: 'envoyees' | 'modifiees' | 'supprimees' | 'min_avant' | 'min_apres') => f.reduce((t, x) => t + x[k], 0);
        const avant = somme('min_avant');
        return { famille, envoyees: somme('envoyees'), modifiees: somme('modifiees'), supprimees: somme('supprimees'),
          ecart: avant ? somme('min_apres') / avant - 1 : null };
      }).filter((f) => f.envoyees > 0),
    },
  };
}

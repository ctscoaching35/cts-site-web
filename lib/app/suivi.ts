/**
 * Le suivi des athlètes coachés, côté serveur (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, T1 à T4, décisions coach
 * du 13/10/2026) : les séances prévues et réalisées et l'indice Hooper des seuls athlètes qui ont donné leur accord (T3),
 * lus dans Nolio chaque soir (ou par « Relire maintenant »), dont seuls les signaux sont gardés (EC2,
 * signauxGardes.ts) ; le détail reste dans Nolio. Les seuils viennent du moteur (cts_suivi, /v1/config) : l'app ne fait
 * que comparer (D3). L'écran « Suivi des 7 jours », qui les lisait à son ouverture, est supprimé (décision coach du
 * 04/11/2026).
 */
import { API_URL } from '@/lib/plan';
import { demonstrationCoachOuverte, seuilsDemonstration } from './demonstrationCoach';
import { ajouterJours } from './plan';
import { listeNolio } from './nolio';
import { aujourdhuiParis, signaux, type Prevue, type Realisee, type Seuils, type Suivi, type ValeurHooper } from './signauxSuivi';
import { derniereActivite, garderLesSignaux } from './signauxGardes';

export { aujourdhuiParis, type GenreSignal, type Seuils, type Signal, type Suivi } from './signauxSuivi';

export async function seuilsSuivi(): Promise<Seuils> {
  // En démonstration : les seuils du moteur, gardés avec ses données (cts_suivi.SEUILS_SUIVI).
  if (demonstrationCoachOuverte()) return seuilsDemonstration();
  const r = await fetch(`${API_URL}/v1/config`, { next: { revalidate: 3600 } });
  if (!r.ok) throw new Error(`Moteur /v1/config : ${r.status}`);
  const s = (await r.json()).suivi as Seuils | undefined;
  if (!s) throw new Error('Moteur /v1/config : les seuils du suivi manquent (moteur 8.322 attendu).');
  return s;
}

// L'indice Hooper dans le catalogue des métriques de Nolio (clé INDICEHOOPER), cherché une fois par instance.
let hooperId: Promise<string | null> | null = null;
function indiceHooper(): Promise<string | null> {
  hooperId ??= listeNolio<{ id: string; key?: string }>('metrics/items/')
    .then((items) => items.find((i) => i.key === 'INDICEHOOPER')?.id ?? null)
    .catch(() => {
      hooperId = null;
      return null;
    });
  return hooperId;
}

// « Relire maintenant » (EC2, décision coach du 04/11/2026) : ses signaux lus dans Nolio à la demande, puis gardés comme
// ceux du soir (lib/app/signauxGardes.ts) ; pour un athlète sans objectif en route, que le passage du soir ne lit pas.
export async function relireEtGarder(coachId: string, usr: string, moi: boolean, s: Seuils, aujourdhui: string): Promise<Suivi> {
  const { suivi, realisees } = await lire(usr, moi, s, aujourdhui);
  await garderLesSignaux(coachId, usr, suivi, derniereActivite(realisees));
  return suivi;
}

async function lire(usr: string, moi: boolean, s: Seuils, aujourdhui: string): Promise<{ suivi: Suivi; realisees: Realisee[] }> {
  const qui = moi ? '' : `&athlete=${usr}`;
  const debut = ajouterJours(aujourdhui, -(s.jours - 1));
  const hooper = await indiceHooper();
  const [prevues, realisees, valeurs] = await Promise.all([
    // Les prévues d'une semaine de plus : le RPE prévu d'une séance faite un autre jour que prévu.
    listeNolio<Prevue>(`planned/trainings/?date_from=${ajouterJours(debut, -7)}&date_to=${aujourdhui}&fields=id,name,date_start,rpe,sport${qui}`),
    listeNolio<Realisee>(`real/trainings/?date_from=${debut}&date_to=${aujourdhui}&fields=id,name,date_start,planned,debrief${qui}`),
    hooper
      ? listeNolio<ValeurHooper>(`metrics/values/?item=${hooper}&date_from=${ajouterJours(debut, -(7 * s.hooper_semaines + 3))}&date_to=${aujourdhui}${qui}`)
      : Promise.resolve([] as ValeurHooper[]),
  ]);
  return { suivi: signaux(prevues, realisees, valeurs, s, aujourdhui), realisees };
}

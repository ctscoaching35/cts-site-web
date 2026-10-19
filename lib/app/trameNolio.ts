import type { Genre, SeanceEnvoyee } from './coaching';

// L'empreinte d'une note ou d'un bandeau dans Nolio (l'API ne leur donne pas de révision) : ce que l'app y pose.
export const empreinte = (n: Record<string, unknown>) =>
  JSON.stringify([n.name ?? '', n.date_start ?? '', n.date_end ?? null, n.note_type ?? null, String(n.color ?? '').toLowerCase()]);

// La date d'un élément posé : le début gardé dans son empreinte ; vide si elle est illisible.
export function dateDe(x: SeanceEnvoyee) {
  try {
    return String((JSON.parse(x.revision ?? '') as unknown[])[1] ?? '');
  } catch {
    return '';
  }
}

export type Voulu = { genre: Genre; corps: Record<string, unknown> };

// Inchangé : même nom, même début. L'empreinte gardée vient de la réponse de Nolio, qui peut écrire autrement le type
// d'une note ou sa couleur : comparer le reste réécrirait pour rien un bandeau identique.
function inchange(x: SeanceEnvoyee, voulu: Voulu) {
  try {
    const [nom, debut] = JSON.parse(x.revision ?? '') as unknown[];
    return nom === (voulu.corps.name ?? '') && debut === (voulu.corps.date_start ?? '');
  } catch {
    return false;
  }
}
export type ActionTrame =
  | { quoi: 'garder'; x: SeanceEnvoyee; touche: boolean }
  | { quoi: 'reecrire'; x: SeanceEnvoyee; voulu: Voulu }
  | { quoi: 'retirer'; x: SeanceEnvoyee }
  | { quoi: 'poser'; jourId: string; voulu: Voulu };

// Ce que le réalignement de la trame fait de chaque élément (coaching.realignerTrame), sans rien écrire : passé, en
// cours, sans date lisible ou inchangé (même nom, même début), il est gardé ; supprimé ou retouché par le coach dans Nolio (sa version n'est
// plus celle de l'envoi), gardé aussi (touche) ; sinon réécrit s'il a changé, retiré si le plan ne l'a plus ; ce que
// le plan a de nouveau est posé. dansNolio : { identifiant : version } de ce qui est dans Nolio.
export function actionsTrame(posees: SeanceEnvoyee[], voulus: Map<string, Voulu>, dansNolio: Map<string, string>,
  aujourdhui: string): ActionTrame[] {
  const restant = new Map(voulus);
  const actions: ActionTrame[] = posees.map((x) => {
    const voulu = restant.get(x.jour_id);
    restant.delete(x.jour_id);
    const id = x.nolio_id ? String(x.nolio_id) : null;
    const version = id ? dansNolio.get(id) : undefined;
    if (dateDe(x) <= aujourdhui || (voulu && inchange(x, voulu))) return { quoi: 'garder', x, touche: false };
    if (!id || x.supprimee || version === undefined || version !== x.revision) {
      return { quoi: 'garder', x: id && version === undefined ? { ...x, supprimee: true } : x, touche: true };
    }
    return voulu ? { quoi: 'reecrire', x, voulu } : { quoi: 'retirer', x };
  });
  for (const [jourId, voulu] of restant) actions.push({ quoi: 'poser', jourId, voulu });
  return actions;
}

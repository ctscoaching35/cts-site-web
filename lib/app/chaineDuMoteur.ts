/**
 * L'AIGUILLAGE SELON LE MOTEUR : une tâche planifiée (app/api/ecriture/*, app/api/relance/envoyer) fait ce qu'elle faisait avant tant que le moteur en ligne
 * est une 8.x, et ce que prévoit le moteur v1 (lib/app/passagesV9.ts) dès qu'il est une 9.x. Le moteur se lit sur GET /v1/config (lib/app/moteurEnLigne.ts,
 * retenu 5 minutes) ; sans réponse lisible, c'est « avant ». Un seul aiguillage, pour que chaque route le dise de la même façon et qu'un essai prouve que
 * sous une 8.x la chaîne du moteur v1 n'est jamais appelée.
 */
import { moteurEstV9 } from './moteurEnLigne';

export async function selonLeMoteur<T>(chaines: { avant: () => Promise<T>; v1: () => Promise<T> }, estV9: () => Promise<boolean> = moteurEstV9): Promise<T> {
  return (await estV9()) ? chaines.v1() : chaines.avant();
}

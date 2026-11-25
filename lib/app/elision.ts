// « d’Antoine », « de Marie », « de Yann », « d’Yves » : « de » devant un prénom, élidé devant une voyelle ou un h (scripts/test-relecture-app-coach.mjs).
// Aucun réseau ni base : lu dans le navigateur comme sur le serveur.
const ELISION = /^(?:[aàâäeéèêëiîïoôöuûühæœ]|y(?![aàâeéèêiîoôu]))/i;

export const deQui = (nom: string): string => (ELISION.test(nom) ? `d’${nom}` : `de ${nom}`);

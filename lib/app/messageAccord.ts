// Aucun réseau ni base : le message d'accord qu'un coaché reçoit dans Nolio, et le nouveau coaché tel que le formulaire le donne (scripts/test-parcours-moment1.mjs).
/**
 * LE MESSAGE D'ACCORD DES COACHÉS, MOT POUR MOT CELUI QUE LE COACH A VALIDÉ le 19/10/2026 (CTS_NOLIO_CADRAGE.md, « Le message d'accord des coachés, COMPLÉTÉ », option 1) : à copier et envoyer à chacun dans la messagerie
 * Nolio ; sa réponse fait preuve, puis « Accord reçu ». Seule la signature suit le coach connecté (le texte validé est signé « Romain »). Le texte n'est écrit qu'ici.
 */
export const MESSAGE_ACCORD = 'Salut, Je mets en place un tableau de bord dans l’app CTS pour suivre plus finement chacun de mes athlètes. Pour ça, l’app a besoin de lire dans Nolio tes séances prévues et réalisées, '
  + 'avec ce que tu y notes : RPE, sensations, commentaires, et ton questionnaire Hooper. Ces données servent à ton suivi : repérer plus vite une séance manquée, un effort plus dur que prévu ou une fatigue qui monte. '
  + 'Elles servent aussi à ajuster automatiquement tes séances chaque dimanche et à afficher tes graphiques dans ton espace CTS : l’app en garde un résumé par semaine (charge, Hooper), effacé si tu retires ton accord. '
  + 'Personne d’autre que toi et moi ne les voit. L’app garde aussi tes repères d’entraînement (FC aux seuils, allures) pour écrire tes séances ; je les efface si tu me le demandes. Rien de tout cela n’est partagé, '
  + 'ni analysé par une intelligence artificielle. Est-ce que tu es d’accord ? Réponds simplement oui ou non. Tu peux changer d’avis à tout moment : dis-le-moi, et l’app ne lira plus tes données et effacera tes repères et ces résumés.';

export const messageDAccord = (signature: string | null | undefined): string => `${MESSAGE_ACCORD} ${String(signature ?? '').trim() || 'Romain'}`;

export type NouveauCoache = { prenom: string; nom: string; email: string; nolioId: string };
// Les champs du formulaire « Nouveau coaché » : le prénom et le nom obligatoires, l'e-mail et le compte Nolio facultatifs ; une phrase de ce qui manque sinon.
export function lireNouveauCoache(form: FormData): { coache: NouveauCoache } | { erreur: string } {
  const texte = (cle: string) => String(form.get(cle) ?? '').replace(/\s+/g, ' ').trim();
  const prenom = texte('prenom').slice(0, 40);
  const nom = texte('nom').slice(0, 60);
  const email = texte('email').toLowerCase().slice(0, 200);
  const nolioId = texte('nolio_id');
  if (!prenom || !nom) return { erreur: 'Écris son prénom et son nom.' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erreur: 'Écris son adresse e-mail en entier, par exemple prenom.nom@exemple.fr.' };
  if (nolioId && !/^usr_[A-Za-z0-9]+$/.test(nolioId)) return { erreur: 'Choisis son nom dans la liste Nolio.' };
  return { coache: { prenom, nom, email, nolioId } };
}

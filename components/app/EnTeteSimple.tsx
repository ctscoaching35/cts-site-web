import EnTeteMarque from './EnTeteMarque';

// L'en-tête de l'app sans contexte (la page « Ta séance d'origine », les pages d'erreur et introuvable) : l'en-tête unique, le
// logo et la marque, qui ramènent à l'accueil. Avant, « Ta séance d'origine » portait l'en-tête « Espace coach » (B-AT-56).
export default function EnTeteSimple() {
  return <EnTeteMarque />;
}

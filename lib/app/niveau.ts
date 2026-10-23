/**
 * Le niveau d'un coaché tiré de deux faits (décision coach du 23/10/2026, « des faits, ton jugement ») : depuis combien
 * de temps il court régulièrement, et son entraînement. L'app propose le niveau, le coach le valide ou le change sur sa
 * fiche ; le niveau choisi par le coach l'emporte sur les faits. Prudente : débutant sous 2 ans ou à l'envie, confirmé
 * au-delà de 5 ans et structuré, intermédiaire sinon. Les acheteurs de plans gardent les trois descriptions
 * (lib/plan.ts, textes.niveau).
 */
export const ANCIENNETES = [
  { valeur: 'moins_2', titre: 'Moins de 2 ans', court: 'moins de 2 ans' },
  { valeur: '2_5', titre: '2 à 5 ans', court: '2 à 5 ans' },
  { valeur: 'plus_5', titre: 'Plus de 5 ans', court: 'plus de 5 ans' },
] as const;

export const ENTRAINEMENTS = [
  { valeur: 'envie', titre: 'Je cours à l’envie, sans fractionné', court: 'à l’envie' },
  { valeur: 'plan', titre: 'J’ai déjà suivi un plan et je fais du fractionné', court: 'plan et fractionné' },
  { valeur: 'structure', titre: 'Je m’entraîne avec un plan structuré depuis plusieurs saisons', court: 'structuré depuis plusieurs saisons' },
] as const;

export function niveauDesFaits(anciennete: unknown, entrainement: unknown): 'debutant' | 'intermediaire' | 'confirme' | null {
  if (!ANCIENNETES.some((a) => a.valeur === anciennete) || !ENTRAINEMENTS.some((e) => e.valeur === entrainement)) return null;
  if (anciennete === 'moins_2' || entrainement === 'envie') return 'debutant';
  if (anciennete === 'plus_5' && entrainement === 'structure') return 'confirme';
  return 'intermediaire';
}

// « 2 à 5 ans · plan et fractionné » ; null sans les deux faits.
export function texteDesFaits(anciennete: unknown, entrainement: unknown): string | null {
  const a = ANCIENNETES.find((x) => x.valeur === anciennete);
  const e = ENTRAINEMENTS.find((x) => x.valeur === entrainement);
  return a && e ? `${a.court} · ${e.court}` : null;
}

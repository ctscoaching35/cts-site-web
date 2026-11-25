// Fonction pure, sans réseau ni base (scripts/test-saison-de-fond-v9.mjs). Sous le moteur v1, une saison de fond est sans fin : elle ne s'écrit plus quand une saison plus récente du même coaché
// a commencé à la semaine `lundi`. `debut`, `autres` : des lundis de début (AAAA-MM-JJ).
export const remplaceeParLaSuivante = (debut: string, autres: string[], lundi: string): boolean => {
  const dimanche = new Date(Date.parse(`${lundi}T12:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10);
  return autres.some((d) => d > debut && d <= dimanche);
};

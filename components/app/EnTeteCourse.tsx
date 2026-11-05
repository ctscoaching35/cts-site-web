// L'en-tête d'une fiche de course (retour du coach du 20/10/2026 : « plus professionnel, accordé au reste de l'app ») :
// son surtitre, le nom de la course, sa date et son format, puis ses chiffres en pavés (distance, dénivelés, densité,
// temps visé, début de la préparation…), tels que le moteur les donne (ta_course.lignes).
// C30 et C29 (audits du 05/11/2026) : un seul pavé de durée, « Temps visé » (la durée d'effort de « Ton jour J » n'est plus
// redite) ; plus de « Début de la préparation », qui n'a rien à faire sur une fiche de course ; plus de D- tant qu'il n'est
// qu'une hypothèse (« égal au D+, à confirmer »).
const RENOMMES: Record<string, string> = { 'Temps cible': 'Temps visé' };
export default function EnTeteCourse({ surtitre, nom, lignes }: { surtitre: string; nom: string; lignes: [string, string][] }) {
  const valeur = (cle: string) => lignes.find(([c]) => c === cle)?.[1];
  const sousTitre = [valeur('Date'), valeur('Format')].filter(Boolean).join(' · ');
  const paves = lignes.filter(([c, v]) => !['Course', 'Date', 'Format', 'Début de la préparation'].includes(c) && !(c === 'D-' && /hypoth/i.test(v)))
    .map(([c, v]) => [RENOMMES[c] ?? c, v] as [string, string]);
  return (
    <div className="space-y-3.5">
      <div>
        <div className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-teal">{surtitre}</div>
        <h1 className="mt-1.5 text-[1.75rem] font-extrabold text-indigo tracking-tight leading-tight">{nom}</h1>
        {sousTitre && <p className="mt-1.5 text-[0.8125rem] text-[#5E5C78]">{sousTitre}</p>}
      </div>
      {paves.length > 0 && (
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {paves.map(([cle, v]) => (
            <div key={cle} className="bg-white rounded-2xl border border-indigo/[0.08] px-3.5 py-3">
              <dt className="text-[0.625rem] font-bold tracking-[0.1em] uppercase text-[#5E5C78]">{cle}</dt>
              <dd className="mt-1 text-[1rem] font-extrabold text-indigo leading-snug">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

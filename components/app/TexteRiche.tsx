// Le texte riche du plan : <b>…</b> seulement (cts_contenu, dépôt du moteur). Rendu en
// éléments React, jamais en HTML injecté.
export default function TexteRiche({ texte }: { texte: string }) {
  return (
    <>
      {texte.split(/(<b>.*?<\/b>)/g).map((morceau, i) =>
        morceau.startsWith('<b>') ? (
          <strong key={i} className="font-bold">
            {morceau.slice(3, -4)}
          </strong>
        ) : (
          morceau
        )
      )}
    </>
  );
}

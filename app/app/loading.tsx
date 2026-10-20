// L'attente entre deux pages de l'app (retour du coach du 20/10/2026 : « des lenteurs quand on clique ») : dès le clic, la
// page suivante montre sa forme, les onglets restent en place ; son contenu arrive dès qu'il est prêt.
export default function Chargement() {
  return (
    <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4" aria-busy="true" aria-label="Chargement">
      <div className="space-y-2">
        <div className="h-3 w-28 rounded bg-indigo/[0.08] animate-pulse" />
        <div className="h-7 w-48 rounded bg-indigo/[0.1] animate-pulse" />
      </div>
      <div className="h-56 rounded-[18px] bg-indigo/[0.12] animate-pulse" />
      <div className="h-28 rounded-2xl bg-white border border-indigo/[0.06] animate-pulse" />
      <div className="h-28 rounded-2xl bg-white border border-indigo/[0.06] animate-pulse" />
    </main>
  );
}

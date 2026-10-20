// L'attente entre deux pages de l'espace coach (retour du coach du 20/10/2026) : la forme de la page dès le clic.
export default function ChargementCoach() {
  return (
    <div className="min-h-screen flex flex-wrap bg-sand" aria-busy="true" aria-label="Chargement">
      <div className="flex-[1_1_220px] lg:max-w-[260px] bg-indigo min-h-24" />
      <div className="flex-[999_1_560px] min-w-0 px-4 py-5 sm:px-8 sm:py-8 space-y-6">
        <div className="h-8 w-56 rounded bg-indigo/[0.1] animate-pulse" />
        <div className="h-40 rounded-2xl bg-white border border-indigo/[0.06] animate-pulse" />
        <div className="h-64 rounded-2xl bg-white border border-indigo/[0.06] animate-pulse" />
      </div>
    </div>
  );
}

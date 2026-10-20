import Image from 'next/image';

export default function EnTetePlan() {
  return (
    // L'en-tête de l'app (décision coach du 20/10/2026 : le parcours d'achat en prend la forme).
    <header className="bg-white border-b border-indigo/[0.08]">
      <div className="mx-auto max-w-2xl px-4 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5" aria-label="CTS Coaching — accueil">
          <Image src="/logo/cts-logo-rond-navy.png" alt="CTS Coaching" width={36} height={36} className="w-9 h-9 object-contain" />
          <span className="font-extrabold tracking-cts text-[0.8125rem] text-indigo">CTS COACHING</span>
        </a>
        <a href="/" className="text-[#5E5C78] hover:text-indigo text-xs font-semibold">
          Retour au site
        </a>
      </div>
    </header>
  );
}

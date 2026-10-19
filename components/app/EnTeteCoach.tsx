import Image from 'next/image';

// L'en-tête de l'espace coach : le même que l'app, sans plan à afficher (le coach peut n'en avoir aucun à lui).
export default function EnTeteCoach() {
  return (
    <header className="bg-white border-b border-indigo/[0.08]">
      <div className="mx-auto max-w-2xl h-16 px-4 flex items-center gap-2.5">
        <Image src="/logo/cts-logo-white.png" alt="CTS Coaching" width={36} height={36} className="w-9 h-9 object-contain" />
        <div className="min-w-0">
          <div className="text-[0.8125rem] font-bold tracking-[0.12em] text-indigo">CTS COACHING</div>
          <div className="text-[0.6875rem] text-[#5E5C78]">Espace coach</div>
        </div>
      </div>
    </header>
  );
}

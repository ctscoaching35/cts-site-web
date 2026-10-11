import Image from 'next/image';

// L'en-tête de l'espace coach : le même que l'app, sans plan à afficher (le coach peut n'en avoir aucun à lui).
export default function EnTeteCoach() {
  return (
    <header className="bg-indigo text-white">
      <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
        <Image src="/logo/cts-logo-rond-navy.png" alt="CTS Coaching" width={36} height={36} className="w-9 h-9" />
        <div className="min-w-0">
          <div className="text-[0.62rem] font-bold tracking-cts uppercase text-white/55">CTS Coaching</div>
          <div className="text-sm font-bold truncate">Espace coach</div>
        </div>
      </div>
    </header>
  );
}

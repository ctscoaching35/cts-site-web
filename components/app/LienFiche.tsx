import Link from 'next/link';

// Le lien vers une fiche de la bibliothèque, là où le PDF met un QR code.
export default function LienFiche({ href, libelle }: { href: string | null; libelle: string }) {
  if (!href) return null;
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-teal font-semibold text-sm">
      {libelle} ›
    </Link>
  );
}

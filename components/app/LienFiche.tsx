import Link from 'next/link';
import { lien, type Contexte } from '@/lib/app/demonstration';

// Le lien vers une fiche de la bibliothèque, là où le PDF met un QR code : elle s'ouvre dans l'app.
export default function LienFiche({ href, libelle, ctx }: { href: string | null; libelle: string; ctx: Contexte }) {
  if (!href) return null;
  return (
    <Link href={lien(href, ctx)} className="inline-flex items-center gap-1 text-teal font-semibold text-sm">
      {libelle} ›
    </Link>
  );
}

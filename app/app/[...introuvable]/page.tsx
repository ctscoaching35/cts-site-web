import { notFound } from 'next/navigation';

// Une adresse de l'app qui n'existe pas : la page introuvable de l'app (app/app/not-found.tsx), en français, pas celle
// du site.
export default function AdresseInconnue() {
  notFound();
}

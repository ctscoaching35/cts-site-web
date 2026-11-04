import { redirect } from 'next/navigation';

// « À regarder » est l'accueil « Cette semaine » depuis la refonte par exception (EC1, décision coach du 04/11/2026).
export default function ARegarderPage() {
  redirect('/app/coach');
}

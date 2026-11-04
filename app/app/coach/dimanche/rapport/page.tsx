import { redirect } from 'next/navigation';

// Le rapport du dimanche (31/10/2026) est fondu dans « Dimanche », une seule vue (EC4, décision coach du 04/11/2026) :
// chaque ligne ouvre l'aperçu complet de sa semaine, son pourquoi compris.
export default function RapportDuDimanche() {
  redirect('/app/coach/dimanche');
}

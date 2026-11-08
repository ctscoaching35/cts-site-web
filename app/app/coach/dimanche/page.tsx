import { redirect } from 'next/navigation';

// « Dimanche » (EC4, 04/11/2026) est fondu dans l'espace par athlète (maquette validée par le coach le 08/11/2026, Q1) :
// la couleur et « Partie / Pas partie » dans « Mes athlètes », l'aperçu sur la page de chaque athlète (« Sa semaine qui
// arrive »). L'aperçu complet garde son adresse, /app/coach/plan/[id]/apercu.
export default function Dimanche() {
  redirect('/app/coach');
}

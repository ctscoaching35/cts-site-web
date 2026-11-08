import { redirect } from 'next/navigation';

// « À regarder », devenu « Cette semaine » (EC1, 04/11/2026), puis « Urgent » (l'espace par athlète, maquette validée par
// le coach le 08/11/2026).
export default function ARegarderPage() {
  redirect('/app/coach/urgent');
}

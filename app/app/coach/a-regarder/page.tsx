import { redirect } from 'next/navigation';
import { moteurEstV9 } from '@/lib/app/moteurEnLigne';

// « À regarder », devenu « Cette semaine » (EC1, 04/11/2026), puis « Urgent » (l'espace par athlète, maquette validée par
// le coach le 08/11/2026). Sous la 9.x, « Urgent » est fondu dans « Mes athlètes » (décision 220 du coach, 24/11/2026) : l'adresse y va directement.
export default async function ARegarderPage() {
  redirect((await moteurEstV9().catch(() => false)) ? '/app/coach' : '/app/coach/urgent');
}

import { redirect } from 'next/navigation';

// Le rapport du dimanche (31/10/2026), fondu dans « Dimanche » (EC4, 04/11/2026), puis dans « Mes athlètes » et la page de
// chaque athlète (l'espace par athlète, maquette validée par le coach le 08/11/2026).
export default function RapportDuDimanche() {
  redirect('/app/coach');
}

import { notFound } from 'next/navigation';
import CadreSite from '@/components/app/CadreSite';
import { plansVisibles } from '@/lib/legal';

// Un document du site (CGV, confidentialité, mentions légales) ouvert dans l'app, depuis le Compte (décision coach du
// 19/10/2026 : « tout reste dans l'app »). Les CGV seulement quand les plans sont en vente, comme sur le site.
const DOCUMENTS: Record<string, string> = {
  cgv: 'Conditions générales', confidentialite: 'Confidentialité', 'mentions-legales': 'Mentions légales',
};

export default async function Document({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const titre = DOCUMENTS[slug];
  if (!titre || (slug === 'cgv' && !(await plansVisibles()))) notFound();
  return <CadreSite src={`/${slug}`} titre={titre} retour={{ href: '/app/compte', libelle: 'Retour' }} />;
}

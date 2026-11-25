'use client';

import { useEffect } from 'react';

// EN DÉMONSTRATION SEULEMENT (développement ; posé par le cadre de l'espace coach, avec le bandeau) : les liens qui sortent vers les vrais sites (Nolio, la fiche de course en ligne…) sont fermés et le disent.
// Dans l'espace coach, un lien du site lui-même est relatif ; un lien en « http » sort. La règle de style les marque, le gestionnaire les retient au clic comme au clavier.
const SORTANT = 'a[href^="http"]';

export default function LiensFermesEnDemonstration() {
  useEffect(() => {
    const retenir = (e: Event) => {
      if (!(e.target as Element | null)?.closest?.(SORTANT)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener('click', retenir, true);
    document.addEventListener('auxclick', retenir, true);
    return () => {
      document.removeEventListener('click', retenir, true);
      document.removeEventListener('auxclick', retenir, true);
    };
  }, []);
  return <style>{`${SORTANT} { cursor: not-allowed; opacity: .55; } ${SORTANT}::after { content: 'en démonstration'; margin-left: .5rem; font-size: .7rem; font-weight: 600; white-space: nowrap; }`}</style>;
}

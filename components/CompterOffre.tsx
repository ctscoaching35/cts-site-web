'use client';

import { useEffect } from 'react';
import { compterEtape } from '@/lib/mesure';

// La page des plans vue (L4) : un « +1 » anonyme, une fois par onglet.
export default function CompterOffre() {
  useEffect(() => compterEtape('offre'), []);
  return null;
}

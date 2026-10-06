'use client';
/**
 * Supabase dans le navigateur : la connexion par code (D6). Les clés publiques seules.
 */
import { createBrowserClient } from '@supabase/ssr';

export const clientNavigateur = () =>
  createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '');

import type { CSSProperties } from 'react';

/** The ledger colors, shared by every page. Fixed so dark mode doesn't change them. */
export const theme = {
  '--paper': '#F1F5EF',
  '--sheet': '#FFFFFF',
  '--ink': '#14231B',
  '--muted': '#55665C',
  '--rule': '#D3DDD4',
  '--accent': '#1E5E45',
  '--warn': '#A8530A',
  colorScheme: 'light',
} as CSSProperties;

import type { LocalProduct } from '../../shared/types/local-flow';
import { CURSOR_STATES } from '../../shared/constants/cursor-states';
// Local concepts only: no pack files, installation, purchasing or downloads implied.
export const MOCK_PRODUCTS: LocalProduct[] = [
  { id: 'concept-sakura', characterId: null, name: 'Sakura Companion', description: 'A soft pink companion concept. Artwork and purchases are coming later.', preview: null, price: 4.99, currency: 'USD', isFree: false, featured: true, platforms: ['windows', 'macos'], version: '1.0.0', stateCount: CURSOR_STATES.length, installed: false, concept: true },
  { id: 'concept-midnight', characterId: null, name: 'Midnight Idol', description: 'A night-themed idol concept for a future character pack.', preview: null, price: 6.99, currency: 'USD', isFree: false, featured: false, platforms: ['windows', 'macos'], version: '1.0.0', stateCount: CURSOR_STATES.length, installed: false, concept: true },
  ...['Neko', 'Yuki'].map(name => ({ id: 'concept-' + name.toLowerCase(), characterId: null, name, description: name + ' premium concept. Artwork and purchases are coming later.', preview: null, price: 4.99, currency: 'USD' as const, isFree: false, featured: false, platforms: ['windows', 'macos'] as Array<'windows' | 'macos'>, version: '1.0.0', stateCount: CURSOR_STATES.length, installed: false, concept: true })),
];

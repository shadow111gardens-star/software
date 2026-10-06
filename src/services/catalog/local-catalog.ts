import type { CharacterManager } from '../characters/character-manager';
import type { LocalProduct, CatalogFilter } from '../../shared/types/local-flow';
import { CURSOR_STATES } from '../../shared/constants/cursor-states';
import { MOCK_PRODUCTS } from './mock-products';
export function validProduct(value: unknown): value is LocalProduct {
  if (!value || typeof value !== 'object') return false; const product = value as Partial<LocalProduct>;
  const id = (value: unknown) => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
  return id(product.id) && (product.characterId === null || id(product.characterId)) && typeof product.name === 'string' && !!product.name.trim() && typeof product.description === 'string' && typeof product.price === 'number' && Number.isFinite(product.price) && product.price >= 0 && product.currency === 'USD' && typeof product.isFree === 'boolean' && (!product.isFree || product.price === 0) && typeof product.featured === 'boolean' && typeof product.installed === 'boolean' && typeof product.concept === 'boolean' && (!product.installed || product.characterId !== null) && product.stateCount === CURSOR_STATES.length && Array.isArray(product.platforms) && product.platforms.length > 0 && product.platforms.every(platform => ['windows', 'macos'].includes(platform)) && typeof product.version === 'string' && (product.preview === null || (typeof product.preview === 'string' && /^data:image\/(png|jpeg);base64,/.test(product.preview)));
}
export function filterProducts(products: LocalProduct[], filter: CatalogFilter, search = ''): LocalProduct[] {
  const query = search.trim().toLocaleLowerCase();
  return products.filter(product => (filter === 'all' || (filter === 'installed' && product.installed) || (filter === 'featured' && product.featured) || (filter === 'free' && product.isFree) || (filter === 'premium' && !product.isFree)) && `${product.name} ${product.description}`.toLocaleLowerCase().includes(query));
}
export class LocalCatalogService {
  private products: LocalProduct[] = [];
  constructor(private readonly characters: Pick<CharacterManager, 'getCharacters' | 'getStateAsset'>, private readonly log = console.error) {}
  async initialize(): Promise<void> {
    const installed = await Promise.all(this.characters.getCharacters().map(async pack => {
      let preview: string | null = null;
      try { preview = (await this.characters.getStateAsset(pack.id, 'normal'))?.dataUrl ?? null; } catch (error) { this.log(`[catalog] ${pack.id}: ${String(error)}`); }
      const premium = pack.metadata.isPremium === true;
      return { id: pack.id, characterId: pack.id, name: pack.name, description: pack.description ?? 'An installed local character pack.', preview, price: premium && typeof pack.metadata.price === 'number' ? pack.metadata.price : 0, currency: 'USD' as const, isFree: !premium, featured: true, platforms: pack.platforms, version: pack.version, stateCount: CURSOR_STATES.length, installed: true, concept: false };
    }));
    const seen = new Set<string>();
    this.products = [...installed, ...MOCK_PRODUCTS].filter(product => {
      if (!validProduct(product) || seen.has(product.id)) { this.log(`[catalog] Invalid/duplicate local product: ${product.id}`); return false; }
      seen.add(product.id); return true;
    });
  }
  getProducts(): LocalProduct[] { return structuredClone(this.products); }
  buy(id: string): string {
    const product = this.products.find(product => product.id === id);
    if (!product || product.isFree || product.installed) throw new Error('This local product has no mock purchase action.');
    return 'Purchases will be available soon. No payment was made.';
  }
}

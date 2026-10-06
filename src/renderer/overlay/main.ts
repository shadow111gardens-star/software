import type { OverlayContent, OverlayRendererAPI } from '../../shared/types/overlay';
declare global { interface Window { animeOverlay: OverlayRendererAPI } }
let latest = 0;
async function render(content: OverlayContent, revision: number): Promise<void> {
  latest = Math.max(latest, revision);
  const image = new Image(); image.id = 'companion'; image.alt = ''; image.draggable = false;
  image.style.opacity = String(content.opacity); image.src = content.dataUrl;
  await image.decode();
  if (revision === latest) {
    document.getElementById('companion')!.replaceWith(image);
    document.body.dataset.characterId = content.characterId;
    document.body.dataset.state = content.state; document.body.dataset.ready = 'true';
  }
}
const failed = (error: unknown) => { void window.animeOverlay.failed(String(error)).catch(() => undefined); };
const unsubscribe = window.animeOverlay.onContent((content, revision) => {
  void render(content, revision).then(() => window.animeOverlay.applied(revision)).catch(failed);
});
window.addEventListener('pagehide', unsubscribe, { once: true });
void window.animeOverlay.getContent().then(content => render(content, 0)).then(() => window.animeOverlay.ready()).catch(failed);

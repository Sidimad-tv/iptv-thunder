// UTILS - Visibility utilities

export function isVisible(el: HTMLElement): boolean {
  const style = globalThis.getComputedStyle(el);

  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    Number(style.opacity) < 0.1
  ) return false;

  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function filterVisibleElements(elements: HTMLElement[]): HTMLElement[] {
  return elements.filter(isVisible);
}


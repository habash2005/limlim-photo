// Packs an ordered list of image records into album pages.
// - Two consecutive landscape photos go on one page, stacked top/bottom.
// - Everything else (portrait, square, single landscape, mixed neighbors) is one per page.
//
// Page shape: { items: ImageRecord[], layout: 'single' | 'stacked' }

const LANDSCAPE_RATIO = 1.15;

function isLandscape(item) {
  if (!item || !item.width || !item.height) return false;
  return item.width / item.height >= LANDSCAPE_RATIO;
}

export function buildAlbumPages(items) {
  const pages = [];
  let i = 0;
  while (i < items.length) {
    const a = items[i];
    const b = items[i + 1];
    if (isLandscape(a) && b && isLandscape(b)) {
      pages.push({ items: [a, b], layout: "stacked" });
      i += 2;
    } else {
      pages.push({ items: [a], layout: "single" });
      i += 1;
    }
  }
  return pages;
}

export function pageKey(page, index) {
  return page.items.map((it) => it.public_id || "").join("|") || `p-${index}`;
}

export function pageContainsAllSelected(page, selected) {
  return page.items.every((it) => !!selected[it.public_id]);
}

export function pageContainsAnySelected(page, selected) {
  return page.items.some((it) => !!selected[it.public_id]);
}

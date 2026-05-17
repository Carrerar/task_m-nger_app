export function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function normalizeCategory(value) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeCategories(categories) {
  return [...new Set(categories.map((category) => normalizeCategory(String(category))).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "vi"));
}

const STORAGE_KEY_WEIGHT = 'fatigueplanner_weight';
const STORAGE_KEY_ROUTES = 'fatigueplanner_routes';

export function loadWeight() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_WEIGHT);
    return saved ? parseFloat(saved) : null;
  } catch {
    return null;
  }
}

export function saveWeight(weight) {
  try {
    localStorage.setItem(STORAGE_KEY_WEIGHT, String(weight));
  } catch {
    /* localStorageが使えない環境では無視 */
  }
}

export function loadRoutes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ROUTES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRoutes(routes) {
  try {
    localStorage.setItem(STORAGE_KEY_ROUTES, JSON.stringify(routes));
  } catch {
    /* localStorageが使えない環境では無視 */
  }
}

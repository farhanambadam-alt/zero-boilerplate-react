/**
 * Mappls (MapmyIndia) configuration.
 * REST/Map SDK key is public (used to load the map JS SDK).
 */
export const MAPPLS_MAP_SDK_KEY = '15c99b6a36d11fb540fe10b566df48c0';

let loadPromise: Promise<void> | null = null;

/**
 * Wait for the `mappls` global to appear, polling every 200ms.
 * In Flutter WebView the script onload can fire before the SDK
 * has fully initialised its global, so polling is more robust.
 */
function waitForMappls(timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if ((window as any).mappls) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('Mappls SDK timed out'));
      setTimeout(check, 200);
    };
    check();
  });
}

export function loadMapplsScript(): Promise<void> {
  if ((window as any).mappls) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://apis.mappls.com/advancedmaps/api/${MAPPLS_MAP_SDK_KEY}/map_sdk?layer=vector&v=3.0`;
    script.async = true;
    script.defer = true;
    script.onload = () => waitForMappls().then(resolve).catch(reject);
    script.onerror = () => reject(new Error('Failed to load Mappls Map SDK'));
    document.head.appendChild(script);
  }).catch((err) => {
    // Allow retry on next call
    loadPromise = null;
    throw err;
  });

  return loadPromise;
}

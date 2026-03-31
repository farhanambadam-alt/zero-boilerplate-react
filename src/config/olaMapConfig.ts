/**
 * Ola Maps configuration.
 * Uses MapLibre GL JS with Ola's vector tile server.
 * Authentication is via OAuth tokens obtained from the edge function proxy.
 */

export const OLA_STYLE_URL = 'https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json';

/**
 * Fetches an OAuth access token from the ola-maps-proxy edge function.
 * The token is used for both API calls and map tile authentication.
 */
let tokenCache: { token: string; fetchedAt: number } | null = null;

export async function getOlaMapToken(): Promise<string> {
  // Cache token for 50 minutes (tokens typically last 1 hour)
  if (tokenCache && Date.now() - tokenCache.fetchedAt < 50 * 60 * 1000) {
    return tokenCache.token;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const res = await fetch(`${supabaseUrl}/functions/v1/ola-maps-proxy?action=get-token`, {
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to get Ola Maps token: ${res.status}`);
  }

  const data = await res.json();
  tokenCache = { token: data.access_token, fetchedAt: Date.now() };
  return data.access_token;
}

/**
 * MapLibre transformRequest function that adds OAuth bearer token
 * to all requests going to api.olamaps.io
 */
export function createOlaTransformRequest(token: string) {
  return (url: string, resourceType?: string) => {
    if (url.startsWith('https://api.olamaps.io')) {
      return {
        url,
        headers: { Authorization: `Bearer ${token}` },
      };
    }
    return { url };
  };
}

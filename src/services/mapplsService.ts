const FUNCTION_NAME = 'mappls-proxy';

function getSupabaseConfig() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return { supabaseUrl, anonKey };
}

async function callProxy(params: Record<string, string>) {
  const { supabaseUrl, anonKey } = getSupabaseConfig();
  const queryString = new URLSearchParams(params).toString();

  const res = await fetch(`${supabaseUrl}/functions/v1/${FUNCTION_NAME}?${queryString}`, {
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mappls proxy error [${res.status}]: ${text}`);
  }

  return res.json();
}

export interface MapplsSuggestion {
  eLoc: string;
  placeName: string;
  placeAddress: string;
  type: string;
  latitude?: number;
  longitude?: number;
  cityName?: string;
  areaName?: string;
}

export interface MapplsReverseGeocodeResult {
  formatted_address: string;
  city: string;
  area: string;
  locality: string;
  district: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
}

export async function mapplsAutosuggest(
  query: string,
  location?: { lat: number; lng: number }
): Promise<MapplsSuggestion[]> {
  const params: Record<string, string> = { action: 'autosuggest', query };
  if (location) {
    params.location = `${location.lat},${location.lng}`;
  }

  const json = await callProxy(params);
  const suggestions = json.suggestedLocations || [];

  return suggestions.map((s: any) => ({
    eLoc: s.eLoc || '',
    placeName: s.placeName || '',
    placeAddress: s.placeAddress || '',
    type: s.type || 'UNKNOWN',
    latitude: s.latitude ? Number(s.latitude) : undefined,
    longitude: s.longitude ? Number(s.longitude) : undefined,
    cityName: s.addressTokens?.city || '',
    areaName: s.addressTokens?.subLocality || s.addressTokens?.locality || '',
  }));
}

export async function mapplsPlaceDetail(
  eLoc: string,
  address?: string
): Promise<{ lat: number; lng: number; address: string; city: string; area: string } | null> {
  try {
    const params: Record<string, string> = { action: 'place-detail' };
    if (address) params.address = address;
    if (eLoc) params.eLoc = eLoc;

    const json = await callProxy(params);

    if (json.latitude && json.longitude) {
      return {
        lat: Number(json.latitude),
        lng: Number(json.longitude),
        address: json.address || address || '',
        city: json.city || '',
        area: json.area || '',
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function mapplsReverseGeocode(
  lat: number,
  lng: number
): Promise<MapplsReverseGeocodeResult> {
  const json = await callProxy({
    action: 'reverse-geocode',
    lat: lat.toString(),
    lng: lng.toString(),
  });

  const result = json.results?.[0] || {};

  return {
    formatted_address: result.formatted_address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    city: result.city || result.district || result.state || 'Unknown',
    area: result.locality || result.subLocality || result.subDistrict || '',
    locality: result.locality || '',
    district: result.district || '',
    state: result.state || '',
    pincode: result.pincode || '',
    lat,
    lng,
  };
}

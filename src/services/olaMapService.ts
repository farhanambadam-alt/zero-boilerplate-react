const FUNCTION_NAME = 'ola-maps-proxy';

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
    throw new Error(`Ola Maps proxy error [${res.status}]: ${text}`);
  }

  return res.json();
}

export interface OlaSuggestion {
  place_id: string;
  placeName: string;
  placeAddress: string;
  type: string;
  latitude?: number;
  longitude?: number;
  cityName?: string;
  areaName?: string;
}

export interface OlaReverseGeocodeResult {
  formatted_address: string;
  city: string;
  area: string;
  locality: string;
  subLocality: string;
  street: string;
  premise: string;
  district: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
}

export async function olaAutosuggest(
  query: string,
  location?: { lat: number; lng: number }
): Promise<OlaSuggestion[]> {
  const params: Record<string, string> = { action: 'autocomplete', query };
  if (location) {
    params.location = `${location.lat},${location.lng}`;
  }

  const json = await callProxy(params);
  const predictions = json.predictions || [];

  return predictions.map((p: any) => {
    const loc = p.geometry?.location;
    // Extract city and area from address components
    const components = p.structured_formatting || {};
    
    return {
      place_id: p.place_id || '',
      placeName: p.structured_formatting?.main_text || p.description?.split(',')[0] || '',
      placeAddress: p.description || '',
      type: p.types?.[0] || 'UNKNOWN',
      latitude: loc?.lat ? Number(loc.lat) : undefined,
      longitude: loc?.lng ? Number(loc.lng) : undefined,
      cityName: '',
      areaName: components.secondary_text || '',
    };
  });
}

export async function olaPlaceDetail(
  placeId: string
): Promise<{ lat: number; lng: number; address: string; city: string; area: string } | null> {
  try {
    const json = await callProxy({ action: 'place-detail', place_id: placeId });

    const result = json.result;
    if (!result) return null;

    const loc = result.geometry?.location;
    if (!loc?.lat || !loc?.lng) return null;

    // Extract city and area from address_components
    let city = '';
    let area = '';
    const components: any[] = result.address_components || [];
    for (const comp of components) {
      const types: string[] = comp.types || [];
      if (types.includes('locality')) city = comp.long_name || '';
      if (types.includes('sublocality') || types.includes('sublocality_level_1')) area = comp.long_name || '';
    }

    return {
      lat: Number(loc.lat),
      lng: Number(loc.lng),
      address: result.formatted_address || '',
      city,
      area,
    };
  } catch {
    return null;
  }
}

export async function olaReverseGeocode(
  lat: number,
  lng: number
): Promise<OlaReverseGeocodeResult> {
  const json = await callProxy({
    action: 'reverse-geocode',
    lat: lat.toString(),
    lng: lng.toString(),
  });

  const results = json.results || [];
  const result = results[0] || {};
  const components: any[] = result.address_components || [];

  let city = '';
  let area = '';
  let locality = '';
  let subLocality = '';
  let street = '';
  let premise = '';
  let district = '';
  let state = '';
  let pincode = '';

  for (const comp of components) {
    const types: string[] = comp.types || [];
    if (types.includes('locality')) city = comp.long_name || '';
    if (types.includes('sublocality_level_1') || types.includes('sublocality')) {
      area = comp.long_name || '';
    }
    if (types.includes('sublocality_level_2') || types.includes('neighborhood')) {
      subLocality = comp.long_name || '';
      if (!area) area = comp.long_name || '';
      locality = comp.long_name || '';
    }
    if (types.includes('sublocality_level_3')) {
      if (!subLocality) subLocality = comp.long_name || '';
    }
    if (types.includes('route') || types.includes('street_address')) {
      street = comp.long_name || '';
    }
    if (types.includes('premise') || types.includes('street_number')) {
      premise = comp.long_name || '';
    }
    if (types.includes('administrative_area_level_2')) district = comp.long_name || '';
    if (types.includes('administrative_area_level_1')) state = comp.long_name || '';
    if (types.includes('postal_code')) pincode = comp.long_name || '';
  }

  return {
    formatted_address: result.formatted_address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    city: city || district || state || 'Unknown',
    area,
    locality,
    subLocality,
    street,
    premise,
    district,
    state,
    pincode,
    lat,
    lng,
  };
}

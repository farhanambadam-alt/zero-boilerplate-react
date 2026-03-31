import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory token cache
let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expires_at - 60_000) {
    return cachedToken.access_token;
  }

  const clientId = Deno.env.get("MAPPLS_CLIENT_ID");
  const clientSecret = Deno.env.get("MAPPLS_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("MAPPLS_CLIENT_ID or MAPPLS_CLIENT_SECRET not configured");
  }

  const res = await fetch("https://outpost.mappls.com/api/security/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token generation failed [${res.status}]: ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 86400) * 1000,
  };

  return cachedToken.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Missing 'action' parameter. Use 'autosuggest' or 'reverse-geocode'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = await getAccessToken();

    if (action === "autosuggest") {
      const query = url.searchParams.get("query");
      if (!query) {
        return new Response(
          JSON.stringify({ error: "Missing 'query' parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const params = new URLSearchParams({
        query,
        access_token: token,
        tokenizeAddress: "true",
      });

      // Optional location biasing
      const location = url.searchParams.get("location");
      if (location) params.set("location", location);

      const pod = url.searchParams.get("pod");
      if (pod) params.set("pod", pod);

      const res = await fetch(
        `https://atlas.mappls.com/api/places/search/json?${params.toString()}`,
        {
          headers: {
            Authorization: `bearer ${token}`,
          },
        }
      );
      const data = await res.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "place-detail") {
      const eLoc = url.searchParams.get("eLoc");
      const address = url.searchParams.get("address");

      if (!eLoc && !address) {
        return new Response(
          JSON.stringify({ error: "Missing 'eLoc' or 'address' parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Use Geocoding API to get coordinates from address
      const geocodeQuery = address || eLoc!;
      
      // Try Nominatim for reliable lat/lng
      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(geocodeQuery)}`,
        { headers: { "Accept-Language": "en", "User-Agent": "ChicSalon/1.0" } }
      );
      const nomData = await nomRes.json();
      
      if (Array.isArray(nomData) && nomData.length > 0) {
        const result = nomData[0];
        return new Response(JSON.stringify({
          latitude: Number(result.lat),
          longitude: Number(result.lon),
          address: result.display_name,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Could not resolve coordinates" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    }

    if (action === "reverse-geocode") {
      const lat = url.searchParams.get("lat");
      const lng = url.searchParams.get("lng");

      if (!lat || !lng) {
        return new Response(
          JSON.stringify({ error: "Missing 'lat' or 'lng' parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await fetch(
        `https://apis.mappls.com/advancedmaps/v1/${token}/rev_geocode?lat=${lat}&lng=${lng}`
      );
      const data = await res.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: `Unknown action '${action}'. Use 'autosuggest' or 'reverse-geocode'.` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("mappls-proxy error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

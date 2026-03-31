import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getOAuthToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const clientId = Deno.env.get("OLA_CLIENT_ID") || Deno.env.get("MAPPLS_CLIENT_ID");
  const clientSecret = Deno.env.get("OLA_CLIENT_SECRET") || Deno.env.get("MAPPLS_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("OAuth credentials not configured");
  }

  console.log("Requesting OAuth token with client_id:", clientId?.substring(0, 8) + "...");

  const res = await fetch("https://account.olamaps.io/realms/olamaps/protocol/openid-connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "openid",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const text = await res.text();
  console.log("OAuth response status:", res.status);

  if (!res.ok) {
    throw new Error(`OAuth token request failed [${res.status}]: ${text}`);
  }

  const data = JSON.parse(text);
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return cachedToken.token;
}

async function olaFetch(url: string): Promise<any> {
  const token = await getOAuthToken();

  console.log("Fetching Ola API:", url.substring(0, 80) + "...");
  
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const text = await res.text();
  console.log("Ola API response status:", res.status, "body length:", text.length);

  if (!res.ok) {
    // If token expired, clear cache and retry once
    if (res.status === 401) {
      cachedToken = null;
      const newToken = await getOAuthToken();
      const retryRes = await fetch(url, {
        headers: { Authorization: `Bearer ${newToken}` },
      });
      const retryText = await retryRes.text();
      if (!retryRes.ok) {
        throw new Error(`Ola API error [${retryRes.status}]: ${retryText.substring(0, 300)}`);
      }
      try { return JSON.parse(retryText); } catch { throw new Error(`Non-JSON: ${retryText.substring(0, 200)}`); }
    }
    throw new Error(`Ola API error [${res.status}]: ${text.substring(0, 300)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Ola API returned non-JSON: ${text.substring(0, 200)}`);
  }
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
        JSON.stringify({ error: "Missing 'action' parameter." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get-token") {
      const token = await getOAuthToken();
      return new Response(
        JSON.stringify({ access_token: token }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "autocomplete") {
      const query = url.searchParams.get("query");
      if (!query) {
        return new Response(
          JSON.stringify({ error: "Missing 'query' parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const params = new URLSearchParams({ input: query });
      const location = url.searchParams.get("location");
      if (location) params.set("location", location);

      const data = await olaFetch(
        `https://api.olamaps.io/places/v1/autocomplete?${params.toString()}`
      );

      return new Response(JSON.stringify(data), {
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

      const data = await olaFetch(
        `https://api.olamaps.io/places/v1/reverse-geocode?latlng=${lat},${lng}`
      );

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "place-detail") {
      const placeId = url.searchParams.get("place_id");

      if (!placeId) {
        return new Response(
          JSON.stringify({ error: "Missing 'place_id' parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await olaFetch(
        `https://api.olamaps.io/places/v1/details?place_id=${encodeURIComponent(placeId)}`
      );

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: `Unknown action '${action}'.` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("ola-maps-proxy error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

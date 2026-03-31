import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { olaReverseGeocode } from '@/services/olaMapService';
export interface LocationData {
  cityName: string;
  areaName?: string;
  lat?: number;
  lng?: number;
  source: 'manual' | 'gps' | 'flutter';
  fullAddress?: string;
}

export type LocationStatus = 'checking' | 'blocked' | 'ready';

interface LocationContextType {
  location: LocationData;
  locationStatus: LocationStatus;
  setLocation: (loc: LocationData) => void;
  requestGPSLocation: () => void;
  requestEnableLocationServices: () => void;
  isLocating: boolean;
  locationError: string | null;
}

const DEFAULT_LOCATION: LocationData = {
  cityName: 'Bangalore',
  areaName: undefined,
  lat: undefined,
  lng: undefined,
  source: 'manual',
};

const STARTUP_GEOLOCATION_TIMEOUT_MS = 6000;
const STARTUP_GEOLOCATION_RETRY_COUNT = 1; // 1 retry => 2 total attempts

const LocationContext = createContext<LocationContextType>({
  location: DEFAULT_LOCATION,
  locationStatus: 'checking',
  setLocation: () => {},
  requestGPSLocation: () => {},
  requestEnableLocationServices: () => {},
  isLocating: false,
  locationError: null,
});

export const useLocation_ = () => useContext(LocationContext);

async function reverseGeocode(lat: number, lng: number): Promise<{ city: string; area?: string; fullAddress?: string }> {
  try {
    const result = await olaReverseGeocode(lat, lng);
    return {
      city: result.city,
      area: result.area || result.subLocality || result.locality || undefined,
      fullAddress: result.formatted_address || undefined,
    };
  } catch {
    // Fallback to Nominatim if Ola fails
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.state_district || addr.state || 'Unknown';
      const area = addr.suburb || addr.neighbourhood || addr.city_district || undefined;
      return { city, area, fullAddress: data.display_name || undefined };
    } catch {
      return { city: 'Unknown' };
    }
  }
}

export const LocationProvider = ({ children }: { children: ReactNode }) => {
  const [location, setLocationState] = useState<LocationData>(() => {
    try {
      const stored = localStorage.getItem('user_location');
      if (stored) return JSON.parse(stored);
    } catch {
      /* ignore */
    }
    return DEFAULT_LOCATION;
  });
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Always start as 'checking' — validate real device state before rendering
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('checking');
  const startupValidationIdRef = useRef(0);

  useEffect(() => {
    localStorage.setItem('user_location', JSON.stringify(location));
  }, [location]);

  // Startup validation: silently verify real device location state.
  useEffect(() => {
    let isActive = true;
    const validationId = ++startupValidationIdRef.current;

    const isStaleValidation = () => !isActive || startupValidationIdRef.current !== validationId;

    const markReady = (coords: GeolocationCoordinates) => {
      if (isStaleValidation()) return;

      // Single source of truth: runtime geolocation result
      setLocationState((prev) => ({
        ...prev,
        lat: coords.latitude,
        lng: coords.longitude,
        source: prev.source === 'flutter' ? 'flutter' : 'gps',
      }));
      setLocationStatus('ready');
    };

    const markBlocked = () => {
      if (isStaleValidation()) return;

      // Hard reset only after all startup attempts fail
      localStorage.removeItem('user_location');
      setLocationState(DEFAULT_LOCATION);
      setLocationStatus('blocked');
    };

    const geolocate =
      () =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: STARTUP_GEOLOCATION_TIMEOUT_MS,
          maximumAge: 0,
        });
      });

    const runStartupValidation = async () => {
      if (!navigator.geolocation) {
        markBlocked();
        return;
      }

      for (let attempt = 0; attempt <= STARTUP_GEOLOCATION_RETRY_COUNT; attempt += 1) {
        try {
          const position = await geolocate();
          markReady(position.coords);
          return;
        } catch {
          if (attempt === STARTUP_GEOLOCATION_RETRY_COUNT) {
            markBlocked();
          }
        }
      }
    };

    void runStartupValidation();

    return () => {
      isActive = false;
    };
  }, []); // Run once on mount only

  const setLocation = useCallback((loc: LocationData) => {
    setLocationState(loc);
    setLocationError(null);
    if (loc.lat && loc.lng) {
      setLocationStatus('ready');
    }
  }, []);

  /**
   * Ask Flutter to open the native "Enable Location Services" system dialog.
   * Only called when we detect GPS is OFF — never on app load.
   */
  const requestEnableLocationServices = useCallback(() => {
    if (window.flutter_inappwebview) {
      try {
        window.flutter_inappwebview.callHandler('enableLocationServices');
      } catch {
        /* bridge not ready */
      }
    }
  }, []);

  /**
   * User-driven GPS request. Flow:
   * 1. If in Flutter WebView → ask Flutter for native location (permission + GPS)
   * 2. Else use browser geolocation API
   * 3. On failure:
   *    - GPS OFF → call Flutter to open system location settings
   *    - Permission denied → show error message
   */
  const requestGPSLocation = useCallback(() => {
    setIsLocating(true);
    setLocationError(null);

    // Flutter path: delegate entirely to native
    if (window.flutter_inappwebview) {
      try {
        window.flutter_inappwebview.callHandler('requestLocation');
        // Timeout safety — if Flutter doesn't respond in 15s, stop spinner
        const timeout = setTimeout(() => setIsLocating(false), 15000);
        // Store timeout so native callback can clear it
        (window as any).__locationTimeout = timeout;
        return;
      } catch {
        /* fall through to browser API */
      }
    }

    // Browser path
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const geo = await reverseGeocode(latitude, longitude);
        setLocation({
          cityName: geo.city,
          areaName: geo.area,
          lat: latitude,
          lng: longitude,
          source: 'gps',
          fullAddress: geo.fullAddress,
        });
        setIsLocating(false);
      },
      (err) => {
        // err.code 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE (GPS off), 3 = TIMEOUT
        if (err.code === 2 && window.flutter_inappwebview) {
          // GPS is off — ask Flutter to open system settings
          requestEnableLocationServices();
          setLocationError('GPS is turned off. Opening settings...');
        } else {
          const messages: Record<number, string> = {
            1: 'Location permission denied. Please enable it in your settings.',
            2: 'GPS is turned off. Please enable location services.',
            3: 'Location request timed out. Please try again.',
          };
          setLocationError(messages[err.code] || 'Failed to get location');
        }
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [setLocation, requestEnableLocationServices]);

  useEffect(() => {
    (window as any).setLocationFromNative = (data: {
      lat: number;
      lng: number;
      city?: string;
      area?: string;
      fullAddress?: string;
    }) => {
      // Clear the safety timeout
      if ((window as any).__locationTimeout) {
        clearTimeout((window as any).__locationTimeout);
        delete (window as any).__locationTimeout;
      }

      if (data.city) {
        setLocation({
          cityName: data.city,
          areaName: data.area,
          lat: data.lat,
          lng: data.lng,
          source: 'flutter',
          fullAddress: data.fullAddress,
        });
        setIsLocating(false);
      } else {
        reverseGeocode(data.lat, data.lng).then((geo) => {
          setLocation({
            cityName: geo.city,
            areaName: geo.area,
            lat: data.lat,
            lng: data.lng,
            source: 'flutter',
            fullAddress: geo.fullAddress,
          });
          setIsLocating(false);
        });
      }
    };

    (window as any).setLocationError = (msg: string) => {
      if ((window as any).__locationTimeout) {
        clearTimeout((window as any).__locationTimeout);
        delete (window as any).__locationTimeout;
      }
      setLocationError(msg);
      setIsLocating(false);
    };

    /**
     * Called by Flutter after user enables GPS from system settings.
     * React should retry location fetch automatically.
     */
    (window as any).onLocationServicesEnabled = () => {
      requestGPSLocation();
    };

    return () => {
      delete (window as any).setLocationFromNative;
      delete (window as any).setLocationError;
      delete (window as any).onLocationServicesEnabled;
    };
  }, [setLocation, requestGPSLocation]);

  return (
    <LocationContext.Provider
      value={{ location, locationStatus, setLocation, requestGPSLocation, requestEnableLocationServices, isLocating, locationError }}
    >
      {children}
    </LocationContext.Provider>
  );
};

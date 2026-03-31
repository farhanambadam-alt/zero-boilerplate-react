import { MapPin, Search, Loader2, Navigation, X, Check, ArrowLeft, Clock, Bookmark, Trash2 } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { useLocation_ } from '@/contexts/LocationContext';
import { olaAutosuggest, olaReverseGeocode, olaPlaceDetail, type OlaSuggestion } from '@/services/olaMapService';
import { pushOverlay, removeOverlay } from '@/hooks/useFlutterBridge';
import { OLA_STYLE_URL, getOlaMapToken, createOlaTransformRequest } from '@/config/olaMapConfig';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface LocationPickerDrawerProps {
  open: boolean;
  onClose: () => void;
}

type Step = 'search' | 'map';

type LocationMeta = {
  cityName: string;
  areaName?: string;
  fullAddress: string;
};

interface SavedLocation {
  cityName: string;
  areaName?: string;
  lat: number;
  lng: number;
  fullAddress: string;
  savedAt: number;
  label?: string;
}

const SAVED_LOCATIONS_KEY = 'saved_locations';
const RECENT_LOCATIONS_KEY = 'recent_locations';
const MAX_RECENT = 5;
const MAX_SAVED = 10;

function getSavedLocations(): SavedLocation[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_LOCATIONS_KEY) || '[]');
  } catch { return []; }
}

function getRecentLocations(): SavedLocation[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_LOCATIONS_KEY) || '[]');
  } catch { return []; }
}

function addRecentLocation(loc: SavedLocation) {
  const recents = getRecentLocations().filter(
    (r) => !(Math.abs(r.lat - loc.lat) < 0.0005 && Math.abs(r.lng - loc.lng) < 0.0005)
  );
  recents.unshift(loc);
  localStorage.setItem(RECENT_LOCATIONS_KEY, JSON.stringify(recents.slice(0, MAX_RECENT)));
}

function saveLocation(loc: SavedLocation) {
  const saved = getSavedLocations().filter(
    (r) => !(Math.abs(r.lat - loc.lat) < 0.0005 && Math.abs(r.lng - loc.lng) < 0.0005)
  );
  saved.unshift(loc);
  localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(saved.slice(0, MAX_SAVED)));
}

function removeSavedLocation(idx: number) {
  const saved = getSavedLocations();
  saved.splice(idx, 1);
  localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(saved));
}

function removeRecentLocation(idx: number) {
  const recents = getRecentLocations();
  recents.splice(idx, 1);
  localStorage.setItem(RECENT_LOCATIONS_KEY, JSON.stringify(recents));
}

const LocationPickerDrawer = ({ open, onClose }: LocationPickerDrawerProps) => {
  const { location, setLocation, requestGPSLocation, isLocating, locationError } = useLocation_();

  const [step, setStep] = useState<Step>('search');
  const [search, setSearch] = useState('');
  const [predictions, setPredictions] = useState<OlaSuggestion[]>([]);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedLocationMeta, setSelectedLocationMeta] = useState<Pick<LocationMeta, 'cityName' | 'areaName'> | null>(null);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [recentLocations, setRecentLocations] = useState<SavedLocation[]>([]);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const markerInstance = useRef<maplibregl.Marker | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const refreshLists = useCallback(() => {
    setRecentLocations(getRecentLocations());
    setSavedLocations(getSavedLocations());
  }, []);

  const reverseGeocodeCoords = useCallback(async (lat: number, lng: number) => {
    try {
      const result = await olaReverseGeocode(lat, lng);
      setSelectedAddress(result.formatted_address);
      setSelectedLocationMeta({
        cityName: result.city,
        areaName: result.area || result.locality || undefined,
      });
      return result;
    } catch (err) {
      console.error('Reverse geocode error:', err);
      setSelectedAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      setSelectedLocationMeta({ cityName: 'Unknown' });
      return null;
    }
  }, []);

  const setResolvedSelection = useCallback((coords: { lat: number; lng: number }, meta: LocationMeta) => {
    setSelectedCoords(coords);
    setSelectedAddress(meta.fullAddress);
    setSelectedLocationMeta({ cityName: meta.cityName, areaName: meta.areaName });
    setStep('map');
  }, []);

  // Register/unregister as overlay for back button handling
  useEffect(() => {
    if (!open) return;
    const closeFn = () => onClose();
    pushOverlay(closeFn);
    return () => removeOverlay(closeFn);
  }, [open, onClose]);

  // Notify Flutter when map drawer opens/closes
  const notifyFlutterMapState = useCallback((active: boolean) => {
    try {
      window.flutter_inappwebview?.callHandler('mapActive', active);
    } catch { /* bridge not ready */ }
  }, []);

  useEffect(() => {
    if (open) {
      notifyFlutterMapState(true);
      refreshLists();
    }
    return () => notifyFlutterMapState(false);
  }, [open, notifyFlutterMapState, refreshLists]);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setStep('search');
      setSearch('');
      setPredictions([]);
      setSelectedAddress('');
      setSelectedCoords(null);
      setSelectedLocationMeta(null);
      setMapsError(null);
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
      markerInstance.current = null;
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // When GPS location is set from context
  useEffect(() => {
    if (!open || !location.lat || !location.lng) return;
    if (location.source !== 'gps' && location.source !== 'flutter') return;

    setSelectedCoords({ lat: location.lat, lng: location.lng });
    setSelectedAddress(location.fullAddress || [location.areaName, location.cityName].filter(Boolean).join(', '));
    setSelectedLocationMeta({ cityName: location.cityName, areaName: location.areaName });
    setStep('map');
  }, [location, open]);

  // Init MapLibre map when switching to map step
  useEffect(() => {
    if (step !== 'map' || !selectedCoords) return;

    if (mapInstance.current) {
      try {
        mapInstance.current.flyTo({ center: [selectedCoords.lng, selectedCoords.lat], zoom: 16 });
        if (markerInstance.current) {
          markerInstance.current.setLngLat([selectedCoords.lng, selectedCoords.lat]);
        }
      } catch { /* stale */ }
      return;
    }

    const initMap = async () => {
      const container = mapContainerRef.current;
      if (!container) return;

      try {
        const token = await getOlaMapToken();
        const transformRequest = createOlaTransformRequest(token);

        const map = new maplibregl.Map({
          container,
          style: OLA_STYLE_URL,
          center: [selectedCoords.lng, selectedCoords.lat],
          zoom: 16,
          attributionControl: false,
          transformRequest,
        });

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

        const marker = new maplibregl.Marker({ draggable: true, color: 'hsl(var(--primary))' })
          .setLngLat([selectedCoords.lng, selectedCoords.lat])
          .addTo(map);

        marker.on('dragend', () => {
          const lngLat = marker.getLngLat();
          setSelectedCoords({ lat: lngLat.lat, lng: lngLat.lng });
          void reverseGeocodeCoords(lngLat.lat, lngLat.lng);
        });

        map.on('click', (e) => {
          const { lat, lng } = e.lngLat;
          marker.setLngLat([lng, lat]);
          setSelectedCoords({ lat, lng });
          void reverseGeocodeCoords(lat, lng);
        });

        mapInstance.current = map;
        markerInstance.current = marker;
      } catch (err) {
        console.error('Map init error:', err);
        setMapsError('Failed to initialize map.');
      }
    };

    const timer = setTimeout(initMap, 100);
    return () => clearTimeout(timer);
  }, [step, selectedCoords?.lat, selectedCoords?.lng, reverseGeocodeCoords]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setPredictions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const trimmed = value.trim();
      setIsSearching(true);

      try {
        const biasLocation = location.lat && location.lng
          ? { lat: location.lat, lng: location.lng }
          : undefined;

        const results = await olaAutosuggest(trimmed, biasLocation);
        setPredictions(results);
      } catch (err) {
        console.error('Autosuggest error:', err);
        setPredictions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSelectPrediction = async (prediction: OlaSuggestion) => {
    if (prediction.latitude != null && prediction.longitude != null) {
      setResolvedSelection(
        { lat: prediction.latitude, lng: prediction.longitude },
        {
          cityName: prediction.cityName || 'Unknown',
          areaName: prediction.areaName || undefined,
          fullAddress: prediction.placeAddress || prediction.placeName,
        }
      );
      return;
    }

    if (prediction.place_id) {
      const detail = await olaPlaceDetail(prediction.place_id);
      if (detail) {
        setResolvedSelection(
          { lat: detail.lat, lng: detail.lng },
          {
            cityName: detail.city || prediction.cityName || 'Unknown',
            areaName: detail.area || prediction.areaName || undefined,
            fullAddress: prediction.placeAddress || detail.address || prediction.placeName,
          }
        );
        return;
      }
    }

    setSelectedAddress(prediction.placeAddress || prediction.placeName);
    setSelectedLocationMeta({ cityName: prediction.cityName || 'Unknown', areaName: prediction.areaName });
  };

  const handleSelectSaved = (loc: SavedLocation) => {
    setResolvedSelection(
      { lat: loc.lat, lng: loc.lng },
      { cityName: loc.cityName, areaName: loc.areaName, fullAddress: loc.fullAddress }
    );
  };

  const handleUseCurrentLocation = () => {
    // Single entry point — LocationContext handles Flutter vs browser logic
    requestGPSLocation();
  };

  const handleConfirm = () => {
    if (!selectedCoords) return;

    const locationData = {
      cityName: selectedLocationMeta?.cityName || 'Unknown',
      areaName: selectedLocationMeta?.areaName,
      lat: selectedCoords.lat,
      lng: selectedCoords.lng,
      source: 'manual' as const,
      fullAddress: selectedAddress,
    };

    setLocation(locationData);

    // Add to recent locations
    addRecentLocation({
      cityName: locationData.cityName,
      areaName: locationData.areaName,
      lat: selectedCoords.lat,
      lng: selectedCoords.lng,
      fullAddress: selectedAddress,
      savedAt: Date.now(),
    });

    onClose();
  };

  const handleSaveLocation = () => {
    if (!selectedCoords) return;
    saveLocation({
      cityName: selectedLocationMeta?.cityName || 'Unknown',
      areaName: selectedLocationMeta?.areaName,
      lat: selectedCoords.lat,
      lng: selectedCoords.lng,
      fullAddress: selectedAddress,
      savedAt: Date.now(),
    });
    refreshLists();
  };

  const isSaved = selectedCoords
    ? savedLocations.some(
        (s) => Math.abs(s.lat - selectedCoords.lat) < 0.0005 && Math.abs(s.lng - selectedCoords.lng) < 0.0005
      )
    : false;

  const showHistory = !search && predictions.length === 0;

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} dismissible={false}>
      <DrawerContent
        className="max-h-[92vh] min-h-[60vh] flex flex-col rounded-t-3xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DrawerTitle className="sr-only">Location picker</DrawerTitle>
        <DrawerDescription className="sr-only">
          Search for an address, landmark, or establishment, then confirm the exact pin on the map.
        </DrawerDescription>

        {/* Header */}
        <div className="relative flex items-center justify-center px-5 pt-1 pb-2">
          {/* Back button (map step only) — left aligned */}
          {step === 'map' && (
            <button
              onClick={() => {
                setStep('search');
                if (mapInstance.current) {
                  mapInstance.current.remove();
                  mapInstance.current = null;
                }
                markerInstance.current = null;
              }}
              className="absolute left-4 w-9 h-9 rounded-full flex items-center justify-center bg-secondary active:scale-95 transition-transform"
              aria-label="Back to search"
            >
              <ArrowLeft size={18} className="text-foreground" />
            </button>
          )}

          {/* Title — centered */}
          <h2 className="font-heading font-bold text-lg text-foreground">
            {step === 'search' ? 'Select Location' : 'Confirm Location'}
          </h2>

          {/* Close button — right aligned, high contrast */}
          <button
            onClick={onClose}
            className="absolute right-4 w-9 h-9 rounded-full flex items-center justify-center bg-foreground/10 border border-border active:scale-95 transition-transform"
            aria-label="Close"
          >
            <X size={18} className="text-foreground" />
          </button>
        </div>

        {mapsError && (
          <div className="mx-5 mb-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <p className="text-[13px] font-body text-destructive">{mapsError}</p>
          </div>
        )}

        {/* === SEARCH STEP === */}
        {step === 'search' && (
          <div className="flex-1 overflow-y-auto px-5 pb-6">
            {/* Search input */}
            <div className="flex items-center gap-2.5 bg-secondary border border-border rounded-2xl px-4 py-3 mb-4">
              <Search size={16} className="text-muted-foreground flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search for area, landmark, shop, street..."
                className="flex-1 bg-transparent text-[14px] font-body text-foreground placeholder:text-muted-foreground outline-none"
                autoFocus
              />
              {isSearching && <Loader2 size={14} className="text-muted-foreground animate-spin" />}
              {search && !isSearching && (
                <button onClick={() => { setSearch(''); setPredictions([]); }}>
                  <X size={14} className="text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Use current location */}
            <button
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              className="w-full flex items-center gap-3 p-3.5 mb-4 rounded-2xl bg-primary/5 border border-primary/15 active:scale-[0.98] transition-transform min-h-[52px] disabled:opacity-60"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                {isLocating ? (
                  <Loader2 size={18} className="text-primary animate-spin" />
                ) : (
                  <Navigation size={18} className="text-primary" />
                )}
              </div>
              <div className="text-left">
                <span className="font-heading font-semibold text-[14px] text-primary block">
                  {isLocating ? 'Detecting location...' : 'Use Current Location'}
                </span>
                <span className="text-[11px] font-body text-muted-foreground">Using GPS</span>
              </div>
            </button>

            {locationError && (
              <p className="text-[12px] font-body text-destructive mb-3 px-1">{locationError}</p>
            )}

            {/* Search predictions */}
            {predictions.length > 0 && (
              <div className="space-y-1">
                {predictions.map((pred, idx) => (
                  <button
                    key={pred.place_id || idx}
                    onClick={() => handleSelectPrediction(pred)}
                    className="w-full flex items-start gap-3 p-3.5 rounded-2xl bg-card border border-border active:scale-[0.98] transition-transform text-left"
                  >
                    <MapPin size={16} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-medium text-[14px] text-foreground truncate">
                        {pred.placeName || pred.placeAddress}
                      </p>
                      <p className="text-[11px] font-body text-muted-foreground mt-0.5 truncate">
                        {pred.placeAddress}
                      </p>
                      {pred.type && (
                        <span className="inline-block mt-1 text-[10px] font-body text-muted-foreground/70 bg-secondary px-2 py-0.5 rounded-full">
                          {pred.type}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Saved locations */}
            {showHistory && savedLocations.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Bookmark size={13} className="text-primary" />
                  <span className="text-[12px] font-heading font-semibold text-muted-foreground uppercase tracking-wider">
                    Saved
                  </span>
                </div>
                <div className="space-y-1">
                  {savedLocations.map((loc, idx) => (
                    <div key={`saved-${idx}`} className="flex items-center gap-1">
                      <button
                        onClick={() => handleSelectSaved(loc)}
                        className="flex-1 flex items-start gap-3 p-3 rounded-2xl bg-card border border-border active:scale-[0.98] transition-transform text-left"
                      >
                        <Bookmark size={14} className="text-primary flex-shrink-0 mt-0.5" />
                     <div className="flex-1 min-w-0 overflow-hidden">
                          <p className="font-heading font-medium text-[13px] text-foreground truncate">
                            {loc.areaName || loc.cityName}
                          </p>
                          <p className="text-[11px] font-body text-muted-foreground mt-0.5 line-clamp-2 break-words">
                            {loc.fullAddress}
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          removeSavedLocation(idx);
                          refreshLists();
                        }}
                        className="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-destructive active:scale-90 transition-all"
                        aria-label="Remove saved location"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent locations */}
            {showHistory && recentLocations.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Clock size={13} className="text-muted-foreground" />
                  <span className="text-[12px] font-heading font-semibold text-muted-foreground uppercase tracking-wider">
                    Recent
                  </span>
                </div>
                <div className="space-y-1">
                  {recentLocations.map((loc, idx) => (
                    <div key={`recent-${idx}`} className="flex items-center gap-1">
                      <button
                        onClick={() => handleSelectSaved(loc)}
                        className="flex-1 flex items-start gap-3 p-3 rounded-2xl bg-card border border-border active:scale-[0.98] transition-transform text-left"
                      >
                        <Clock size={14} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                       <div className="flex-1 min-w-0 overflow-hidden">
                          <p className="font-heading font-medium text-[13px] text-foreground truncate">
                            {loc.areaName || loc.cityName}
                          </p>
                          <p className="text-[11px] font-body text-muted-foreground mt-0.5 line-clamp-2 break-words">
                            {loc.fullAddress}
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          removeRecentLocation(idx);
                          refreshLists();
                        }}
                        className="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-destructive active:scale-90 transition-all"
                        aria-label="Remove recent location"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {search && predictions.length === 0 && !isSearching && (
              <div className="text-center py-8">
                <MapPin size={32} className="text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-[13px] font-body text-muted-foreground">No results found</p>
              </div>
            )}

            {showHistory && savedLocations.length === 0 && recentLocations.length === 0 && (
              <div className="text-center py-8">
                <Search size={32} className="text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-[13px] font-body text-muted-foreground">
                  Search for your location or use GPS
                </p>
              </div>
            )}
          </div>
        )}

        {/* === MAP STEP === */}
        {step === 'map' && (
          <div className="flex-1 flex flex-col px-5 pb-5">
            <div className="relative flex-1 min-h-[250px] rounded-2xl overflow-hidden border border-border mb-3">
              <div
                ref={mapContainerRef}
                className="w-full h-full min-h-[250px]"
                data-vaul-no-drag
                style={{ touchAction: 'none', WebkitOverflowScrolling: 'touch' }}
              />
              <div className="absolute top-3 left-3 right-3 z-10">
                <div className="bg-background/90 backdrop-blur-sm rounded-xl px-3 py-2 border border-border shadow-sm">
                  <p className="text-[11px] font-body text-muted-foreground text-center">
                    Drag the pin or tap to adjust location
                  </p>
                </div>
              </div>
            </div>

            {/* Address card */}
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-secondary border border-border mb-3">
              <MapPin size={18} className="text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-heading font-medium text-[14px] text-foreground">
                  Selected Location
                </p>
                <p className="text-[12px] font-body text-muted-foreground mt-0.5 leading-relaxed line-clamp-3 break-words">
                  {selectedAddress || 'Loading address...'}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleSaveLocation}
                disabled={!selectedCoords || isSaved}
                className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-2xl border border-border bg-card text-foreground font-heading font-medium text-[13px] active:scale-[0.98] transition-transform disabled:opacity-40 min-h-[48px]"
              >
                <Bookmark size={15} className={isSaved ? 'text-primary fill-primary' : ''} />
                {isSaved ? 'Saved' : 'Save'}
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selectedCoords}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-primary-foreground font-heading font-semibold text-[15px] active:scale-[0.98] transition-transform disabled:opacity-50 min-h-[48px] shadow-md"
              >
                <Check size={18} />
                Confirm Location
              </button>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
};

export default LocationPickerDrawer;

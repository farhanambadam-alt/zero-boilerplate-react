import { useLocation_ } from '@/contexts/LocationContext';
import { MapPin, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LocationGate = ({ children }: { children: React.ReactNode }) => {
  const { location, requestGPSLocation, isLocating, locationError } = useLocation_();

  const hasLocation = !!(location.lat && location.lng);

  if (hasLocation) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background px-6 text-center">
      {/* Animated pin icon */}
      <div className="relative mb-8">
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
          <MapPin className="h-12 w-12 text-primary" />
        </div>
      </div>

      <h1 className="mb-3 text-xl font-bold text-foreground">
        Location Required
      </h1>
      <p className="mb-8 max-w-xs text-sm text-muted-foreground leading-relaxed">
        We need your location to show nearby salons and services available in your area.
      </p>

      <Button
        size="lg"
        className="gap-2 rounded-full px-8"
        onClick={requestGPSLocation}
        disabled={isLocating}
      >
        {isLocating ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            Detecting Location…
          </>
        ) : (
          <>
            <Navigation className="h-4 w-4" />
            Turn On Location
          </>
        )}
      </Button>

      {locationError && (
        <p className="mt-4 max-w-xs text-xs text-destructive">{locationError}</p>
      )}
    </div>
  );
};

export default LocationGate;

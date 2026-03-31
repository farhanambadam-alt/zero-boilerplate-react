import { useLocation_ } from '@/contexts/LocationContext';
import { MapPin, Navigation } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

/**
 * Full-screen gate that blocks content until a valid location is available.
 * Shows a styled dialog prompting the user to turn on location services.
 */
const LocationGate = () => {
  const { location, requestGPSLocation, isLocating, locationError } = useLocation_();

  // Location is considered "resolved" if we have lat/lng OR the user manually picked a city
  const hasLocation = !!(location.lat && location.lng) || location.source === 'manual';

  if (hasLocation) return null;

  return (
    <Dialog open={!hasLocation}>
      <DialogContent
        className="max-w-[340px] rounded-3xl border-border/50 bg-card p-8 text-center shadow-2xl [&>button.absolute]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="items-center gap-4">
          {/* Icon */}
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <MapPin size={36} className="text-primary" />
          </div>

          <DialogTitle className="font-heading text-xl text-foreground">
            Enable Location
          </DialogTitle>

          <DialogDescription className="font-body text-sm text-muted-foreground leading-relaxed">
            We need your location to show nearby salons, offers, and services personalised for your area.
          </DialogDescription>
        </DialogHeader>

        {/* Error message */}
        {locationError && (
          <p className="text-xs text-destructive font-body mt-1">{locationError}</p>
        )}

        {/* Turn On button */}
        <button
          onClick={requestGPSLocation}
          disabled={isLocating}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-heading font-semibold text-sm text-primary-foreground shadow-md active:scale-[0.97] transition-transform disabled:opacity-60"
        >
          {isLocating ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Detecting…
            </>
          ) : (
            <>
              <Navigation size={16} />
              Turn On Location
            </>
          )}
        </button>

        <p className="text-[11px] text-muted-foreground/70 font-body mt-2">
          Your location is only used to find salons near you.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default LocationGate;

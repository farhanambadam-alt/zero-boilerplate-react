# Cursor AI Prompt — Native Location for ChicSalon Flutter WebView

> **Copy-paste this entire prompt into Cursor AI to add native location to the Flutter project.**

---

## OVERVIEW

Add native GPS location support to the existing ChicSalon Flutter WebView shell.
The React web app is the **sole decision-maker** for when location is needed.
Flutter only executes native capabilities when React explicitly requests them via the JavaScript bridge.

**CRITICAL**: Flutter must NEVER trigger location prompts, permission dialogs, or GPS checks automatically (e.g., on WebView load, on app start, or in `initState`). Everything is user-driven from React.

---

## ARCHITECTURE

```
React (UI + Logic)                    Flutter (Native Capabilities)
─────────────────                     ─────────────────────────────
User taps "Use Current Location"
  → requestGPSLocation()
    → callHandler('requestLocation')  ──►  Receives handler call
                                           → Check permission
                                           → If denied → request permission
                                           → If GPS OFF → call enableLocationServices
                                           → Get position (HIGH_ACCURACY)
                                           → Reverse geocode (optional)
    window.setLocationFromNative()    ◄──  Send result back via JS
    OR
    window.setLocationError()         ◄──  Send error back via JS

GPS is OFF scenario:
  → callHandler('enableLocationServices') ─► Opens Android system location dialog
                                              User enables GPS
    window.onLocationServicesEnabled() ◄──  Notify React to retry
```

---

## DEPENDENCIES TO ADD (pubspec.yaml)

```yaml
dependencies:
  geolocator: ^13.0.2
  geocoding: ^3.0.0
```

---

## PLATFORM CONFIGURATION

### Android

**android/app/src/main/AndroidManifest.xml** — Add these permissions BEFORE the `<application>` tag:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

**android/app/build.gradle** — Ensure `compileSdkVersion` is at least 34.

### iOS

**ios/Runner/Info.plist** — Add these keys inside `<dict>`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>ChicSalon needs your location to find nearby salons</string>
<key>NSLocationAlwaysUsageDescription</key>
<string>ChicSalon needs your location to find nearby salons</string>
```

---

## IMPLEMENTATION

### 1. Register JavaScript Handlers

In `main.dart`, inside `onWebViewCreated`, add these handlers alongside the existing `routeChanged` handler:

```dart
onWebViewCreated: (controller) {
  _controller = controller;

  // Existing route handler
  controller.addJavaScriptHandler(
    handlerName: 'routeChanged',
    callback: (args) {
      final String path = args.isNotEmpty ? args[0].toString() : '/';
      debugPrint('Web route changed: $path');
    },
  );

  // Location request — called when user taps "Use Current Location"
  controller.addJavaScriptHandler(
    handlerName: 'requestLocation',
    callback: (args) {
      _handleLocationRequest();
      return null;
    },
  );

  // Enable location services — called when GPS is detected as OFF
  controller.addJavaScriptHandler(
    handlerName: 'enableLocationServices',
    callback: (args) {
      _handleEnableLocationServices();
      return null;
    },
  );
},
```

### 2. Location Request Handler

Add this method to `_WebViewScreenState`:

```dart
Future<void> _handleLocationRequest() async {
  try {
    // 1. Check if location services are enabled
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      // GPS is OFF — open system settings and notify React
      await _handleEnableLocationServices();
      return;
    }

    // 2. Check & request permission
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        _sendLocationError('Location permission denied.');
        return;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      _sendLocationError(
        'Location permission permanently denied. Please enable it in Settings.',
      );
      return;
    }

    // 3. Get current position with HIGH ACCURACY
    Position position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 15),
      ),
    );

    // 4. Reverse geocode (optional — React will also reverse geocode)
    String? cityName;
    String? areaName;
    try {
      List<Placemark> placemarks = await placemarkFromCoordinates(
        position.latitude,
        position.longitude,
      );
      if (placemarks.isNotEmpty) {
        final place = placemarks.first;
        cityName = place.locality ??
            place.subAdministrativeArea ??
            place.administrativeArea;
        areaName = place.subLocality ?? place.thoroughfare;
      }
    } catch (e) {
      debugPrint('Geocoding failed: $e — React will handle it');
    }

    // 5. Send result to React
    final js = '''
      if (window.setLocationFromNative) {
        window.setLocationFromNative({
          lat: ${position.latitude},
          lng: ${position.longitude},
          city: ${cityName != null ? '"$cityName"' : 'null'},
          area: ${areaName != null ? '"$areaName"' : 'null'}
        });
      }
    ''';
    await _controller?.evaluateJavascript(source: js);

  } catch (e) {
    debugPrint('Location error: $e');
    _sendLocationError('Failed to get location. Please try again.');
  }
}
```

### 3. Enable Location Services Handler

```dart
Future<void> _handleEnableLocationServices() async {
  try {
    // Opens the Android system location settings dialog
    bool opened = await Geolocator.openLocationSettings();

    if (opened) {
      // Poll for location services to become enabled (max 30 seconds)
      for (int i = 0; i < 15; i++) {
        await Future.delayed(const Duration(seconds: 2));
        if (await Geolocator.isLocationServiceEnabled()) {
          // GPS is now ON — notify React to retry
          await _controller?.evaluateJavascript(
            source: '''
              if (window.onLocationServicesEnabled) {
                window.onLocationServicesEnabled();
              }
            ''',
          );
          return;
        }
      }
      // Timed out waiting
      _sendLocationError('GPS was not enabled. Please try again.');
    } else {
      _sendLocationError('Could not open location settings.');
    }
  } catch (e) {
    debugPrint('Enable location error: $e');
    _sendLocationError('Could not open location settings.');
  }
}
```

### 4. Error Helper

```dart
void _sendLocationError(String message) {
  final js = '''
    if (window.setLocationError) {
      window.setLocationError("$message");
    }
  ''';
  _controller?.evaluateJavascript(source: js);
}
```

### 5. Required Imports

At the top of `main.dart`:

```dart
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
```

---

## BRIDGE CONTRACT

| Handler Name | Direction | Trigger | Purpose |
|---|---|---|---|
| `requestLocation` | React → Flutter | User taps "Use Current Location" | Get GPS coords + optional city name |
| `enableLocationServices` | React → Flutter | Browser detects GPS is OFF | Open Android system location dialog |
| `setLocationFromNative` | Flutter → React | After successful GPS fix | Send lat/lng/city/area to React |
| `setLocationError` | Flutter → React | On any failure | Send error message to React |
| `onLocationServicesEnabled` | Flutter → React | After user enables GPS in settings | Tell React to retry location |

---

## CRITICAL RULES

1. **DO NOT** request location on app startup or in `initState`
2. **DO NOT** request `ACCESS_BACKGROUND_LOCATION` — only foreground access
3. **DO NOT** add any Flutter UI for location — all UI is in the React web app
4. **DO NOT** trigger any location logic automatically — ONLY when React calls the handler
5. Handlers must be registered in `onWebViewCreated`, NOT in `onLoadStop`
6. Always handle the case where geocoding fails — send coordinates without city name
7. Use `LocationAccuracy.high` (PRIORITY_HIGH_ACCURACY) for precise GPS
8. The `enableLocationServices` handler must poll for GPS enable state and notify React

---

## TESTING CHECKLIST

- [ ] NO location popup on app start
- [ ] "Use Current Location" triggers native GPS request
- [ ] Permission dialog appears only on first request
- [ ] When GPS is OFF → system "Enable Location" dialog appears
- [ ] After enabling GPS → location is fetched automatically (React retries)
- [ ] City name resolves correctly in the header
- [ ] Denied permission shows error in the drawer
- [ ] Location persists across app restarts (React stores in localStorage)
- [ ] In browser (not Flutter), browser geolocation API works as fallback
- [ ] Back button / navigation still works after location request

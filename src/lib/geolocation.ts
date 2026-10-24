export interface DeviceLocation { lat: number; lng: number; accuracy: number; }

export function getCurrentLocation(signal?: AbortSignal): Promise<DeviceLocation> {
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return Promise.reject(new Error("Phone location needs HTTPS. Open the secure website, or place your pin on the map. HTTP network links cannot use GPS."));
  }
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(new Error("Location is not supported in this browser. Open Chrome or Safari, or place your pin on the map."));
  }
  return new Promise((resolve, reject) => {
    let finished = false;
    let retried = false;
    const finish = (error?: Error, point?: DeviceLocation) => {
      if (finished) return;
      finished = true;
      signal?.removeEventListener("abort", abort);
      if (error) reject(error); else resolve(point!);
    };
    const abort = () => finish(new DOMException("Location request cancelled.", "AbortError"));
    const success = (position: GeolocationPosition) => {
      const { latitude: lat, longitude: lng, accuracy } = position.coords;
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        finish(new Error("Your phone returned an invalid location. Please place the pin on the map."));
        return;
      }
      finish(undefined, { lat, lng, accuracy });
    };
    const failure = (error: GeolocationPositionError) => {
      if (finished) return;
      if (error.code !== 1 && !retried) {
        retried = true;
        request(false);
        return;
      }
      finish(new Error(error.code === 1
        ? "Location permission is blocked. Allow Location for this site in your browser settings, then try again. You can also place your pin manually."
        : error.code === 3
          ? "Location timed out. Turn on your phone's Location/GPS, move near a window, then retry or place your pin manually."
          : "Your phone could not find its location. Turn on Location/GPS and retry, or place your pin on the map."));
    };
    const request = (highAccuracy: boolean) => {
      if (finished) return;
      try {
        navigator.geolocation.getCurrentPosition(success, failure, {
          enableHighAccuracy: highAccuracy,
          timeout: highAccuracy ? 20000 : 10000,
          maximumAge: 60000,
        });
      } catch {
        finish(new Error("Browser location is unavailable. Check site permissions or place your pin manually."));
      }
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort(); else request(true);
  });
}

import {useCallback, useEffect, useState} from 'react';

export interface UserCoordinates {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}

export type GeolocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

export const BENGALURU_DEFAULT_COORDS: UserCoordinates = {
  latitude: 12.9716,
  longitude: 77.5946,
};

export function useGeolocation() {
  const [coords, setCoords] = useState<UserCoordinates | null>(null);
  const [status, setStatus] = useState<GeolocationStatus>('idle');

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setStatus('unavailable');
      return;
    }

    setStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: Math.round(pos.coords.accuracy),
        });
        setStatus('granted');
      },
      () => {
        setStatus('denied');
      },
      {
        enableHighAccuracy: false,
        timeout: 7000,
        maximumAge: 180000,
      }
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  return {
    userCoords: coords,
    effectiveCenter: coords ?? BENGALURU_DEFAULT_COORDS,
    status,
    requestLocation,
  };
}

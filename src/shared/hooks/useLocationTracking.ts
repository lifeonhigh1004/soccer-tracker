import { useState, useRef, useEffect } from 'react';
import * as Location from 'expo-location';
import { LocationPoint } from '../../core/types/session';
import { haversineDistance } from '../utils/geoUtils';

export interface FinalTrackingData {
  startedAt: number;
  locationPoints: LocationPoint[];
  distanceMeters: number;
  maxSpeedKph: number;
  maxSpeedTimestamp: number | null;
  durationSeconds: number;
}

interface TrackingStats {
  hasPermission: boolean | null;
  gpsReady: boolean;
  distanceMeters: number;
  currentSpeedKph: number;
  maxSpeedKph: number;
  durationSeconds: number;
}

const INITIAL_STATS: TrackingStats = {
  hasPermission: null,
  gpsReady: false,
  distanceMeters: 0,
  currentSpeedKph: 0,
  maxSpeedKph: 0,
  durationSeconds: 0,
};

export function useLocationTracking() {
  const [stats, setStats] = useState<TrackingStats>(INITIAL_STATS);

  const pointsRef = useRef<LocationPoint[]>([]);
  const distanceRef = useRef(0);
  const maxSpeedRef = useRef(0);
  const maxSpeedTsRef = useRef<number | null>(null);
  const durationRef = useRef(0);
  const startedAtRef = useRef(0);
  const isActiveRef = useRef(false);

  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      setStats((prev) => ({ ...prev, hasPermission: status === 'granted' }));
    });
    return () => {
      subscriptionRef.current?.remove();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setStats((prev) => ({ ...prev, durationSeconds: durationRef.current }));
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function onLocationUpdate(location: Location.LocationObject) {
    const accuracy = location.coords.accuracy ?? 999;
    const rawSpeed = location.coords.speed;
    const speed = rawSpeed !== null && rawSpeed >= 0 ? rawSpeed : null;

    const isGoodFix = accuracy <= 30;
    setStats((prev) => ({ ...prev, gpsReady: isGoodFix }));
    if (!isGoodFix) return;

    const point: LocationPoint = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude,
      speed,
      accuracy,
      timestamp: location.timestamp,
    };

    const speedKph = speed !== null ? speed * 3.6 : 0;

    if (isActiveRef.current) {
      const last = pointsRef.current[pointsRef.current.length - 1];
      if (last) {
        const dist = haversineDistance(
          last.latitude, last.longitude,
          point.latitude, point.longitude,
        );
        // 순간이동(GPS 오류) 무시: 200m 이하만 카운트
        if (dist < 200 && (speed === null || speed >= 0.5)) {
          distanceRef.current += dist;
        }
      }
      pointsRef.current.push(point);

      if (speedKph > maxSpeedRef.current) {
        maxSpeedRef.current = speedKph;
        maxSpeedTsRef.current = point.timestamp;
      }

      setStats((prev) => ({
        ...prev,
        distanceMeters: distanceRef.current,
        currentSpeedKph: speedKph,
        maxSpeedKph: maxSpeedRef.current,
        gpsReady: true,
      }));
    }
  }

  async function startTracking(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === 'granted';
    setStats((prev) => ({ ...prev, hasPermission: granted }));
    if (!granted) return false;

    startedAtRef.current = Date.now();
    isActiveRef.current = true;

    subscriptionRef.current?.remove();
    subscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 3,
      },
      onLocationUpdate,
    );

    startTimer();
    return true;
  }

  function pauseTracking() {
    isActiveRef.current = false;
    stopTimer();
    setStats((prev) => ({ ...prev, currentSpeedKph: 0 }));
  }

  function resumeTracking() {
    isActiveRef.current = true;
    startTimer();
  }

  function stopTracking(): FinalTrackingData {
    isActiveRef.current = false;
    stopTimer();
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;

    return {
      startedAt: startedAtRef.current,
      locationPoints: pointsRef.current.slice(),
      distanceMeters: distanceRef.current,
      maxSpeedKph: maxSpeedRef.current,
      maxSpeedTimestamp: maxSpeedTsRef.current,
      durationSeconds: durationRef.current,
    };
  }

  function reset() {
    isActiveRef.current = false;
    stopTimer();
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;

    pointsRef.current = [];
    distanceRef.current = 0;
    maxSpeedRef.current = 0;
    maxSpeedTsRef.current = null;
    durationRef.current = 0;
    startedAtRef.current = 0;

    setStats((prev) => ({ ...INITIAL_STATS, hasPermission: prev.hasPermission }));
  }

  return {
    ...stats,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    reset,
  };
}

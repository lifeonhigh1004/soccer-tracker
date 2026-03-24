import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';

/**
 * 기기의 나침반 방향을 반환합니다.
 * - trueHeading(GPS 보정) 우선, 없으면 magHeading(자기) 사용
 * - enabled=false면 구독을 해제합니다.
 */
export function useCompass(enabled: boolean): number | null {
  const [heading, setHeading] = useState<number | null>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!enabled) {
      subRef.current?.remove();
      subRef.current = null;
      setHeading(null);
      return;
    }

    let cancelled = false;

    Location.watchHeadingAsync((data) => {
      if (cancelled) return;
      // trueHeading은 GPS 보정값(-1이면 미사용), magHeading은 자기 방위각
      const value = data.trueHeading >= 0 ? data.trueHeading : data.magHeading;
      setHeading(value);
    }).then((sub) => {
      if (cancelled) {
        sub.remove();
      } else {
        subRef.current = sub;
      }
    });

    return () => {
      cancelled = true;
      subRef.current?.remove();
      subRef.current = null;
    };
  }, [enabled]);

  return heading;
}

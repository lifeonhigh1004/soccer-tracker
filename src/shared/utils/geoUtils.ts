import { LocationPoint } from '../core/types/session';

/** Haversine 공식으로 두 좌표 간 거리 계산 (미터) */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // 지구 반지름 (미터)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** LocationPoint 배열로 총 거리 계산 (미터) */
export function calculateTotalDistance(points: LocationPoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(
      points[i - 1].latitude,
      points[i - 1].longitude,
      points[i].latitude,
      points[i].longitude
    );
  }
  return total;
}

/** GPS 노이즈 필터링 — 정확도 낮거나 속도 너무 낮은 포인트 제거 */
export function filterNoisePoints(points: LocationPoint[]): LocationPoint[] {
  return points.filter(
    (p) => p.accuracy <= 25 && (p.speed === null || p.speed >= 0.3)
  );
}

/** kph → min/km 페이스 */
export function kphToPace(kph: number): number | null {
  if (kph <= 0) return null;
  return 60 / kph;
}

/** LocationPoint[] → 경계 좌표 계산 */
export function calculateBounds(points: LocationPoint[]): {
  northEast: { lat: number; lng: number };
  southWest: { lat: number; lng: number };
} | null {
  if (points.length === 0) return null;
  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  let minLng = points[0].longitude;
  let maxLng = points[0].longitude;

  for (const p of points) {
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
    if (p.longitude < minLng) minLng = p.longitude;
    if (p.longitude > maxLng) maxLng = p.longitude;
  }

  return {
    northEast: { lat: maxLat, lng: maxLng },
    southWest: { lat: minLat, lng: minLng },
  };
}

/** 포인트 배열에서 최고 속도(kph) 찾기 */
export function getMaxSpeed(points: LocationPoint[]): {
  kph: number;
  timestamp: number | null;
} {
  let maxMs = 0;
  let maxTimestamp: number | null = null;
  for (const p of points) {
    if (p.speed !== null && p.speed > maxMs) {
      maxMs = p.speed;
      maxTimestamp = p.timestamp;
    }
  }
  return { kph: maxMs * 3.6, timestamp: maxTimestamp };
}

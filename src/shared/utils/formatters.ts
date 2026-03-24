/** 미터 → "1.23 km" 또는 "230 m" */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}

/** 미터 → "1.23" (km 단위 숫자만) */
export function formatDistanceKm(meters: number): string {
  return (meters / 1000).toFixed(2);
}

/** 초 → "1:23:45" 또는 "23:45" */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 초 → "23분 45초" */
export function formatDurationKo(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

/** m/s → kph */
export function msToKph(ms: number): number {
  return ms * 3.6;
}

/** kph → "12.3 km/h" */
export function formatSpeed(kph: number): string {
  return `${kph.toFixed(1)} km/h`;
}

/** min/km → "5'30\"" */
export function formatPace(minPerKm: number | null): string {
  if (!minPerKm || minPerKm <= 0) return '--';
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  return `${min}'${String(sec).padStart(2, '0')}"`;
}

/** 칼로리 추정 (MET 7.0 기준) */
export function estimateCalories(
  durationSeconds: number,
  weightKg: number | null
): number | null {
  if (!weightKg) return null;
  const hours = durationSeconds / 3600;
  return Math.round(7.0 * weightKg * hours);
}

/** timestamp → "오늘", "어제", "3일 전", "2026.03.24" */
export function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  const d = new Date(timestamp);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/** timestamp → "03월 24일 (월) 오전 10:30" */
export function formatFullDate(timestamp: number): string {
  const d = new Date(timestamp);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  const day = days[d.getDay()];
  const hour = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = hour < 12 ? '오전' : '오후';
  const h = hour % 12 || 12;
  return `${month}월 ${date}일 (${day}) ${ampm} ${h}:${min}`;
}

/** timestamp → "YYYY.MM" (월별 그룹 키) */
export function formatMonthKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** timestamp → "YYYY년 MM월" */
export function formatMonthLabel(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

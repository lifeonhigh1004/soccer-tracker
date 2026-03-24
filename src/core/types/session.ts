export enum Sport {
  Soccer = 'soccer',
  Futsal = 'futsal',
}

export enum SessionType {
  Match = 'match',
  Training = 'training',
}

export enum SessionStatus {
  Active = 'active',
  Paused = 'paused',
  Completed = 'completed',
  Discarded = 'discarded',
}

export type PitchType = 'grass' | 'turf' | 'indoor' | 'beach' | null;

export interface LocationPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null; // m/s
  accuracy: number;
  timestamp: number; // Unix ms
}

export interface SessionSplit {
  splitIndex: number;
  distanceMeters: number;
  durationSeconds: number;
  avgSpeedKph: number;
}

export interface Session {
  id: string;
  sport: Sport;
  type: SessionType;
  status: SessionStatus;
  startedAt: number;
  endedAt: number | null;
  pausedDurationSeconds: number;
  activeDurationSeconds: number;
  distanceMeters: number;
  avgSpeedKph: number;
  maxSpeedKph: number;
  topSpeedTimestamp: number | null;
  pace: number | null; // min/km
  calories: number | null;
  locationPoints: LocationPoint[];
  splits: SessionSplit[];
  notes: string;
  weatherCondition: string | null;
  pitchType: PitchType;
  useGps: boolean;
}

export type SessionSummary = Omit<Session, 'locationPoints' | 'splits'> & {
  routeBounds: {
    northEast: { lat: number; lng: number };
    southWest: { lat: number; lng: number };
  } | null;
};

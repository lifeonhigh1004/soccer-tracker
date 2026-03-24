import { Sport, SessionType } from '../../core/types';

export const SPORT_LABELS: Record<Sport, string> = {
  [Sport.Soccer]: '축구',
  [Sport.Futsal]: '풋살',
};

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  [SessionType.Match]: '경기',
  [SessionType.Training]: '훈련',
};

export const POSITION_LABELS = {
  goalkeeper: '골키퍼',
  defender: '수비수',
  midfielder: '미드필더',
  forward: '공격수',
};

export const PITCH_TYPE_LABELS = {
  grass: '천연잔디',
  turf: '인조잔디',
  indoor: '실내',
  beach: '모래사장',
};

export const DOMINANT_FOOT_LABELS = {
  left: '왼발',
  right: '오른발',
  both: '양발',
};

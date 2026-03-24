import { useRef, useEffect, useCallback } from 'react';
import { Accelerometer, Gyroscope } from 'expo-sensors';

// ── 상수 ──────────────────────────────────────────────────────────────────────
const ACCEL_UPDATE_MS = 100;          // 10Hz 샘플링
const GYRO_UPDATE_MS = 100;

// 정지 판단: 가속도 크기(중력 제거 후)가 이 값 미만이면 정지
const STILL_THRESHOLD = 0.12;         // m/s² 단위 (중력=9.8 기준 약 1.2% 변동)

// 스프린트 판단: 가속도 크기가 이 값 이상 + 유지 시간 초과
const SPRINT_ACCEL_THRESHOLD = 1.8;   // m/s²
const SPRINT_HOLD_MS = 600;           // 이 시간 이상 지속돼야 스프린트
const SPRINT_END_MS = 1200;           // 이 시간 이상 임계값 미달 시 스프린트 종료

// 이동 평균 윈도우 크기
const SMOOTH_WINDOW = 8;

export interface IMUState {
  isMoving: boolean;       // 실제로 몸이 움직이고 있는가
  isSprinting: boolean;    // 스프린트 중인가
  sprintCount: number;     // 누적 스프린트 횟수
  accelMagnitude: number;  // 현재 가속도 크기 (디버그용)
}

export interface IMURef {
  getState: () => IMUState;
}

const INITIAL_STATE: IMUState = {
  isMoving: false,
  isSprinting: false,
  sprintCount: 0,
  accelMagnitude: 0,
};

/**
 * IMU 훅 — 가속도계/자이로스코프로 실제 움직임·스프린트 감지
 *
 * state는 리렌더 없이 ref로 관리 (GPS 콜백에서 동기 참조용)
 * onSprintStart/onSprintEnd 콜백으로 외부에 이벤트 전달
 */
export function useIMU(options: {
  enabled: boolean;
  onSprintStart?: () => void;
  onSprintEnd?: () => void;
}) {
  const { enabled, onSprintStart, onSprintEnd } = options;

  // IMU 상태 — ref로 관리해서 리렌더 최소화
  const stateRef = useRef<IMUState>({ ...INITIAL_STATE });

  // 가속도 이동 평균 버퍼
  const accelBufRef = useRef<number[]>([]);

  // 스프린트 타이밍
  const sprintStartTsRef = useRef<number | null>(null);
  const sprintEndTsRef = useRef<number | null>(null);

  // 중력 벡터 추정 (저주파 필터, alpha=0.8)
  const gravityRef = useRef({ x: 0, y: 0, z: 9.8 });

  const handleAccel = useCallback(({ x, y, z }: { x: number; y: number; z: number }) => {
    // 저주파 필터로 중력 추정
    const alpha = 0.8;
    const g = gravityRef.current;
    g.x = alpha * g.x + (1 - alpha) * x;
    g.y = alpha * g.y + (1 - alpha) * y;
    g.z = alpha * g.z + (1 - alpha) * z;

    // 중력 제거 → 선형 가속도
    const lx = x - g.x;
    const ly = y - g.y;
    const lz = z - g.z;
    const magnitude = Math.sqrt(lx * lx + ly * ly + lz * lz);

    // 이동 평균
    const buf = accelBufRef.current;
    buf.push(magnitude);
    if (buf.length > SMOOTH_WINDOW) buf.shift();
    const smoothed = buf.reduce((a, b) => a + b, 0) / buf.length;

    const now = Date.now();
    const prev = stateRef.current;

    // ── 정지/이동 판단 ────────────────────────────────────────────────────
    const isMoving = smoothed >= STILL_THRESHOLD;

    // ── 스프린트 판단 ─────────────────────────────────────────────────────
    let isSprinting = prev.isSprinting;
    let sprintCount = prev.sprintCount;

    if (smoothed >= SPRINT_ACCEL_THRESHOLD) {
      // 임계값 초과 시작
      if (sprintStartTsRef.current === null) {
        sprintStartTsRef.current = now;
      }
      sprintEndTsRef.current = null;

      // 충분히 지속됐으면 스프린트 시작
      if (!isSprinting && now - sprintStartTsRef.current >= SPRINT_HOLD_MS) {
        isSprinting = true;
        sprintCount += 1;
        onSprintStart?.();
      }
    } else {
      sprintStartTsRef.current = null;

      if (isSprinting) {
        // 임계값 미달 시작
        if (sprintEndTsRef.current === null) {
          sprintEndTsRef.current = now;
        }
        // 충분히 지속됐으면 스프린트 종료
        if (now - sprintEndTsRef.current >= SPRINT_END_MS) {
          isSprinting = false;
          sprintEndTsRef.current = null;
          onSprintEnd?.();
        }
      } else {
        sprintEndTsRef.current = null;
      }
    }

    stateRef.current = { isMoving, isSprinting, sprintCount, accelMagnitude: smoothed };
  }, [onSprintStart, onSprintEnd]);

  useEffect(() => {
    if (!enabled) {
      stateRef.current = { ...INITIAL_STATE };
      return;
    }

    Accelerometer.setUpdateInterval(ACCEL_UPDATE_MS);
    Gyroscope.setUpdateInterval(GYRO_UPDATE_MS);

    const accelSub = Accelerometer.addListener(handleAccel);

    return () => {
      accelSub.remove();
      stateRef.current = { ...INITIAL_STATE };
      accelBufRef.current = [];
      gravityRef.current = { x: 0, y: 0, z: 9.8 };
      sprintStartTsRef.current = null;
      sprintEndTsRef.current = null;
    };
  }, [enabled, handleAccel]);

  /** GPS 콜백에서 동기적으로 IMU 상태를 읽기 위한 getter */
  const getIMUState = useCallback((): IMUState => stateRef.current, []);

  return { getIMUState };
}

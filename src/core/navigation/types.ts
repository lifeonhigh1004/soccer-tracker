import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SessionSummary } from '../../core/types/session';
import { Sport, SessionType } from '../../core/types/session';

// 루트 스택
export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
};

// 하단 탭
export type RootTabParamList = {
  Dashboard: undefined;
  Tracking: { sport?: Sport; type?: SessionType } | undefined;
  History: undefined;
  Profile: undefined;
};

// 각 탭 화면에서 사용할 navigation prop 타입
export type DashboardNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Dashboard'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type TrackingNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Tracking'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type HistoryNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'History'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type ProfileNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Profile'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// HistoryStack
export type HistoryStackParamList = {
  HistoryList: undefined;
  SessionDetail: { session: SessionSummary };
};

export type SessionDetailNavProp = NativeStackNavigationProp<HistoryStackParamList, 'SessionDetail'>;
export type HistoryListNavProp = NativeStackNavigationProp<HistoryStackParamList, 'HistoryList'>;

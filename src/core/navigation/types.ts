import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// 루트 스택 (온보딩 분기용 — 추후 확장)
export type RootStackParamList = {
  Main: undefined;
  // Onboarding: undefined;
};

// 하단 탭
export type RootTabParamList = {
  Dashboard: undefined;
  Tracking: undefined;
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

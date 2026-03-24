import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RootStackParamList } from './types';
import { TabNavigator } from './TabNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  // 추후 온보딩 완료 여부에 따라 초기 화면 분기
  // const isOnboarded = false;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* {!isOnboarded && (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      )} */}
      <Stack.Screen name="Main" component={TabNavigator} />
    </Stack.Navigator>
  );
}

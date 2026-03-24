import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RootStackParamList } from './types';
import { TabNavigator } from './TabNavigator';
import { OnboardingScreen } from '../../features/onboarding/screens/OnboardingScreen';
import { isOnboarded } from '../../shared/services/profileService';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const [checked, setChecked] = useState(false);
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    isOnboarded().then((result) => {
      setOnboarded(result);
      setChecked(true);
    });
  }, []);

  if (!checked) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {!onboarded ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : null}
      <Stack.Screen name="Main" component={TabNavigator} />
    </Stack.Navigator>
  );
}

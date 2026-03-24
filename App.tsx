import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { RootNavigator } from './src/core/navigation/RootNavigator';
import { Colors } from './src/core/theme/colors';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.background }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="light" backgroundColor={Colors.background} />
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

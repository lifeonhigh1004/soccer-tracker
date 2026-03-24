import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RootTabParamList } from './types';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

import { DashboardScreen } from '../../features/dashboard/screens/DashboardScreen';
import { TrackingScreen } from '../../features/tracking/screens/TrackingScreen';
import { HistoryNavigator } from './HistoryNavigator';
import { ProfileScreen } from '../../features/profile/screens/ProfileScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_CONFIG: Record<
  keyof RootTabParamList,
  { label: string; icon: IoniconsName; iconFocused: IoniconsName }
> = {
  Dashboard: {
    label: '홈',
    icon: 'home-outline',
    iconFocused: 'home',
  },
  Tracking: {
    label: '트래킹',
    icon: 'radio-button-off-outline',
    iconFocused: 'radio-button-on',
  },
  History: {
    label: '기록',
    icon: 'time-outline',
    iconFocused: 'time',
  },
  Profile: {
    label: '프로필',
    icon: 'person-outline',
    iconFocused: 'person',
  },
};

export function TabNavigator() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const config = TAB_CONFIG[route.name as keyof RootTabParamList];
        return {
          headerShown: false,
          tabBarStyle: [styles.tabBar, {
            height: 56 + bottomPadding,
            paddingBottom: bottomPadding,
          }],
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textSecondary,
          tabBarLabelStyle: styles.tabLabel,
          tabBarIcon: ({ focused, color, size }) => {
            const iconName = focused ? config.iconFocused : config.icon;
            return (
              <View style={focused ? styles.activeIconWrapper : undefined}>
                <Ionicons name={iconName} size={22} color={color} />
              </View>
            );
          },
          tabBarLabel: config.label,
        };
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Tracking" component={TrackingScreen} />
      <Tab.Screen name="History" component={HistoryNavigator} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  tabLabel: {
    ...Typography.caption,
    marginTop: 2,
  },
  activeIconWrapper: {
    backgroundColor: `${Colors.primary}18`,
    borderRadius: 12,
    padding: 4,
  },
});

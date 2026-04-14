import React from 'react';
import { StatusBar, Platform, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { StripeWrapper } from './src/lib/stripe';

// Suppress known web-only warnings
if (Platform.OS === 'web') {
  LogBox.ignoreLogs([
    '"shadow*" style props are deprecated',
    'Failed to execute \'removeChild\'',
    '[expo-notifications]',
    'NavigatorLockAcquireTimeoutError',
  ]);

  // Patch React DOM removeChild crash on web (React 19 + react-native-web known issue)
  const origRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      console.warn('removeChild: node is not a child, skipping');
      return child;
    }
    return origRemoveChild.call(this, child) as T;
  };
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StripeWrapper>
        <AuthProvider>
          <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />
          <AppNavigator />
        </AuthProvider>
      </StripeWrapper>
    </GestureHandlerRootView>
  );
}

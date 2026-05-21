import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as SplashScreen from 'expo-splash-screen'
import { bootstrapAuth } from '../auth/bootstrap'

SplashScreen.preventAutoHideAsync().catch(() => undefined)

export default function RootLayout() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    bootstrapAuth()
      .catch((err) => console.error('[bootstrap]', err))
      .finally(() => setReady(true))
  }, [])

  if (!ready) return null

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
      </Stack>
    </SafeAreaProvider>
  )
}

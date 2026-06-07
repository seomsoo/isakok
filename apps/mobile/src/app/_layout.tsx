import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as SplashScreen from 'expo-splash-screen'
import { bootstrapAuth } from '../auth/bootstrap'
import { ensureChannel } from '../push/channels'
import { attachResponseListener, handleColdStart } from '../push/notificationHandler'

SplashScreen.preventAutoHideAsync().catch(() => undefined)

export default function RootLayout() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    bootstrapAuth()
      .catch((err) => console.error('[bootstrap]', err))
      .finally(() => setReady(true))
  }, [])

  // 푸시 초기화 (12단계): Android 채널 보장 + 콜드스타트 라우트 적재 + 응답(탭) 리스너.
  // notificationHandler import 시 setNotificationHandler가 모듈 로드 시점에 설정된다.
  useEffect(() => {
    ensureChannel().catch((err) => console.error('[push:channel]', err))
    handleColdStart().catch((err) => console.error('[push:coldStart]', err))
    return attachResponseListener()
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

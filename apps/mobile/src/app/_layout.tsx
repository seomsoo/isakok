import { Slot } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { hideSplashOnce } from '../utils/splash'
import { SPLASH_TIMEOUT_MS } from '../constants/config'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  useEffect(() => {
    const timeout = setTimeout(() => {
      hideSplashOnce()
    }, SPLASH_TIMEOUT_MS)

    return () => clearTimeout(timeout)
  }, [])

  return (
    <>
      <StatusBar style="dark" />
      <Slot />
    </>
  )
}

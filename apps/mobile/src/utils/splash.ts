import * as SplashScreen from 'expo-splash-screen'

let splashHidden = false

export async function hideSplashOnce(): Promise<void> {
  if (splashHidden) return
  splashHidden = true

  try {
    await SplashScreen.hideAsync()
  } catch {
    // already hidden
  }
}

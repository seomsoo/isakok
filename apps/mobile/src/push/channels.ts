import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

/** Android 알림 채널 보장 (12단계 §5-2). iOS는 채널 개념이 없어 무시. */
export async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync('default', {
    name: '이사 알림',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  })
}

import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

/** Android 알림 채널 보장 (12단계 §5-2). iOS는 채널 개념이 없어 무시. */
export async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync('default', {
    name: '이사 알림',
    // 상단 heads-up 팝업(iOS 배너와 동일 체감) + 스크린리더 친화 description (native-a11y follow-up)
    description: '이사 준비 할 일과 D-day 리마인더',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  })
}

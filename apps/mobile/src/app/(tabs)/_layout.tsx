import { createContext, useState } from 'react'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import * as Haptics from 'expo-haptics'
import { COLORS } from '../../constants/config'

export const TabBarContext = createContext<{
  setIsTabBarHidden: (hidden: boolean) => void
}>({ setIsTabBarHidden: () => {} })

export default function TabLayout() {
  const [isTabBarHidden, setIsTabBarHidden] = useState(false)

  return (
    <TabBarContext.Provider value={{ setIsTabBarHidden }}>
      <NativeTabs
        hidden={isTabBarHidden}
        tintColor={COLORS.primary}
        screenListeners={{
          tabPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          },
        }}
      >
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
          <NativeTabs.Trigger.Label>홈</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="timeline">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'list.bullet', selected: 'list.bullet' }}
            md="list"
          />
          <NativeTabs.Trigger.Label>전체</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="photos">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'camera', selected: 'camera.fill' }}
            md="camera_alt"
          />
          <NativeTabs.Trigger.Label>집기록</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </TabBarContext.Provider>
  )
}

import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../constants/config'

export function OfflineFallback() {
  return (
    <View style={styles.container} accessibilityRole="alert" accessibilityLabel="인터넷 연결 끊김">
      <Ionicons name="cloud-offline-outline" size={48} color={COLORS.muted} />
      <Text style={styles.title}>인터넷 연결을 확인해주세요</Text>
      <Text style={styles.description}>연결되면 자동으로 새로고침돼요</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.neutral,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.secondary,
    marginTop: 8,
  },
  description: {
    fontSize: 14,
    color: COLORS.muted,
  },
})

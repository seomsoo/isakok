import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../constants/config'

interface ErrorFallbackProps {
  onRetry: () => void
}

export function ErrorFallback({ onRetry }: ErrorFallbackProps) {
  return (
    <View style={styles.container} accessibilityRole="alert" accessibilityLabel="페이지 로드 실패">
      <Ionicons name="warning-outline" size={48} color={COLORS.muted} />
      <Text style={styles.title}>페이지를 불러올 수 없어요</Text>
      <Pressable
        style={styles.button}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="다시 시도"
      >
        <Text style={styles.buttonText}>다시 시도</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.neutral,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  button: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.surface,
  },
})

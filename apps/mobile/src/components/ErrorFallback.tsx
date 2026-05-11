import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../constants/config'

interface ErrorFallbackProps {
  onRetry: () => void
}

export function ErrorFallback({ onRetry }: ErrorFallbackProps) {
  return (
    <View style={styles.container} accessibilityRole="alert" accessibilityLabel="페이지 로드 실패">
      <Ionicons
        name="warning-outline"
        size={48}
        color={COLORS.muted}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Text style={styles.title}>페이지를 불러올 수 없어요</Text>
      <Pressable
        style={styles.button}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="다시 시도"
        accessibilityHint="페이지를 다시 불러옵니다"
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
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.surface,
  },
})

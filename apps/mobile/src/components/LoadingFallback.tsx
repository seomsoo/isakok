import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { COLORS } from '../constants/config'

export function LoadingFallback() {
  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel="로딩 중">
      <Text style={styles.logo}>이사콕</Text>
      <ActivityIndicator
        size="large"
        color={COLORS.primary}
        style={styles.spinner}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.neutral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 24,
  },
  spinner: {
    marginTop: 8,
  },
})

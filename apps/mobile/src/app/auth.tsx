import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, Platform, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { AuthService } from '../auth/AuthService'
import type { AuthProviderName } from '../auth/providers/types'

const LABEL: Record<AuthProviderName, string> = {
  apple: 'Apple',
  google: 'Google',
  kakao: '카카오',
}

export default function AuthScreen() {
  const [available, setAvailable] = useState<AuthProviderName[]>([])
  const [loading, setLoading] = useState<AuthProviderName | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    AuthService.listAvailableProviders().then(setAvailable)
  }, [])

  const ordered = useMemo(() => {
    const arr = available.slice()
    arr.sort((a, b) => {
      if (Platform.OS === 'ios') {
        if (a === 'apple') return -1
        if (b === 'apple') return 1
      } else {
        if (a === 'kakao') return -1
        if (b === 'kakao') return 1
      }
      return 0
    })
    return arr
  }, [available])

  const onProvider = async (name: AuthProviderName) => {
    setError(null)
    setLoading(name)
    try {
      const result = await AuthService.signInWithProvider(name)

      if (result.mode === 'conflict-pending') {
        setLoading(null)
        Alert.alert(
          '이미 계정이 있어요',
          '로그인하면 비회원으로 작성한 내용은 삭제돼요.\n계속할까요?',
          [
            { text: '취소', style: 'cancel' },
            {
              text: '로그인',
              style: 'destructive',
              onPress: async () => {
                setLoading(result.providerName)
                try {
                  await result.confirm()
                  router.replace('/')
                } catch (err) {
                  setError(err instanceof Error ? err.message : '로그인에 실패했어요')
                } finally {
                  setLoading(null)
                }
              },
            },
          ],
        )
        return
      }

      router.replace('/')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '로그인에 실패했어요'
      if (message === 'USER_CANCELLED') return
      setError(message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        이사 기록을 안전하게
      </Text>
      <Text style={styles.subtitle}>로그인하면 폰을 바꿔도 데이터가 그대로 유지돼요</Text>

      <View style={styles.buttons}>
        {ordered.map((name) => (
          <Pressable
            key={name}
            accessibilityRole="button"
            accessibilityLabel={`${LABEL[name]}로 로그인`}
            accessibilityState={{ disabled: !!loading }}
            onPress={() => onProvider(name)}
            disabled={!!loading}
            style={({ pressed }) => [
              styles.button,
              name === 'apple' && styles.btn_apple,
              name === 'google' && styles.btn_google,
              name === 'kakao' && styles.btn_kakao,
              pressed && styles.pressed,
            ]}
          >
            {loading === name ? (
              <ActivityIndicator color={name === 'google' ? '#333' : '#fff'} />
            ) : (
              <Text
                style={[
                  styles.buttonText,
                  name === 'apple' && { color: '#fff' },
                  name === 'google' && { color: '#333' },
                  name === 'kakao' && { color: '#3C1E1E' },
                ]}
              >
                {LABEL[name]}로 시작하기
              </Text>
            )}
          </Pressable>
        ))}
      </View>

      {error && (
        <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="로그인 없이 계속하기"
        onPress={() => router.replace('/')}
        style={styles.skip}
      >
        <Text style={styles.skipText}>나중에 할게요</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#F8F7F5' },
  title: { fontSize: 24, fontWeight: '700', color: '#333344', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 32 },
  buttons: { gap: 12 },
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn_apple: { backgroundColor: '#000' },
  btn_google: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dadce0' },
  btn_kakao: { backgroundColor: '#FEE500' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.85 },
  error: { marginTop: 16, color: '#B91C1C', fontSize: 14 },
  skip: {
    marginTop: 24,
    alignSelf: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  skipText: { fontSize: 14, color: '#767676', textDecorationLine: 'underline' },
})

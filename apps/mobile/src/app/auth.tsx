import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, Platform, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import * as AppleAuthentication from 'expo-apple-authentication'
import { AuthService } from '../auth/AuthService'
import type { AuthProviderName } from '../auth/providers/types'
import { GoogleLogo } from '../components/GoogleLogo'
import { KakaoSymbol } from '../components/KakaoSymbol'

const LABEL: Record<AuthProviderName, string> = {
  apple: 'Apple',
  google: 'Google',
  kakao: '카카오',
}

// 각 브랜드 공식 색상값 (구글 라이트 버튼 / 카카오 디자인 가이드).
const GOOGLE_BORDER = '#747775'
const GOOGLE_TEXT = '#1F1F1F'
const KAKAO_TEXT = 'rgba(0,0,0,0.85)'

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
          '기존 계정으로 로그인하면 지금 이 기기에서 작성한 내용은 사라지고 되돌릴 수 없어요.\n취소하면 지금 내용을 그대로 보관해요.',
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
        {ordered.map((name) => {
          // 애플은 HIG 준수를 위해 공식 네이티브 버튼을 사용 (폭·높이·radius만 맞춤).
          if (name === 'apple') {
            return (
              <AppleAuthentication.AppleAuthenticationButton
                key="apple"
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={12}
                style={styles.appleButton}
                onPress={() => {
                  if (!loading) onProvider('apple')
                }}
              />
            )
          }

          const isLoading = loading === name
          return (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityLabel={`${LABEL[name]}로 로그인`}
              accessibilityState={{ disabled: !!loading }}
              onPress={() => onProvider(name)}
              disabled={!!loading}
              style={({ pressed }) => [
                styles.button,
                name === 'google' && styles.btn_google,
                name === 'kakao' && styles.btn_kakao,
                pressed && styles.pressed,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color={name === 'google' ? GOOGLE_TEXT : KAKAO_TEXT} />
              ) : (
                <View style={styles.buttonContent}>
                  {name === 'google' ? <GoogleLogo size={18} /> : <KakaoSymbol size={18} />}
                  <Text
                    style={[
                      styles.buttonText,
                      name === 'google' ? styles.googleText : styles.kakaoText,
                    ]}
                  >
                    {name === 'google' ? 'Google로 로그인' : '카카오 로그인'}
                  </Text>
                </View>
              )}
            </Pressable>
          )
        })}
      </View>

      {error && (
        <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="로그인 없이 계속하기"
        onPress={() => {
          // 로그인창은 push로 띄워지므로 이전 화면으로 복귀. 스택이 비어 있으면 홈으로 폴백.
          if (router.canGoBack()) router.back()
          else router.replace('/')
        }}
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
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleButton: { width: '100%', height: 52 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn_google: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: GOOGLE_BORDER },
  btn_kakao: { backgroundColor: '#FEE500' },
  buttonText: { fontSize: 18, fontWeight: '600' },
  googleText: { color: GOOGLE_TEXT },
  kakaoText: { color: KAKAO_TEXT },
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

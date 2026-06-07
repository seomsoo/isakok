import { ChevronLeft } from 'lucide-react'
import { useGoBack } from '@/shared/hooks/useGoBack'
import { PageHeader } from '@/shared/components/PageHeader'

const EFFECTIVE_DATE = '2026-06-05'

export function PrivacyPage() {
  const goBack = useGoBack('/settings')

  return (
    <div className="flex min-h-dvh flex-col bg-neutral">
      <PageHeader
        title="개인정보처리방침"
        left={
          <button
            type="button"
            onClick={goBack}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-secondary"
            aria-label="뒤로가기"
          >
            <ChevronLeft size={24} />
          </button>
        }
      />

      <article className="flex flex-col gap-7 px-5 pb-12 pt-2 text-secondary">
        <p className="text-body-sm text-muted">시행일: {EFFECTIVE_DATE}</p>

        <p className="text-body leading-relaxed">
          이사콕(이하 “서비스”)는 「개인정보 보호법」을 준수하며, 이용자의 개인정보를 어떤 목적과
          방법으로 처리·보관·파기하는지 본 처리방침을 통해 안내합니다.
        </p>

        <section>
          <h2 className="mb-2 text-h3 font-semibold">1. 처리 목적</h2>
          <ul className="list-disc space-y-1 pl-5 text-body leading-relaxed">
            <li>회원 식별 및 본인 인증</li>
            <li>이사 일정 관리 및 체크리스트 제공</li>
            <li>집 상태 사진 기록·열람·리포트 생성</li>
            <li>이용자 조건에 맞춘 가이드 제공</li>
            <li>서비스 남용 방지(요청 빈도 제한)</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-h3 font-semibold">2. 처리 항목 및 보유기간</h2>
          <div className="overflow-hidden rounded-2xl bg-surface">
            <table className="w-full text-left text-body-sm">
              <caption className="sr-only">처리 항목, 목적, 보유기간</caption>
              <thead>
                <tr className="border-b border-border bg-tertiary/40 text-muted">
                  <th scope="col" className="px-3 py-2 font-medium">
                    항목
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    목적
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    보유기간
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-3 py-2">소셜 식별자·이메일</td>
                  <td className="px-3 py-2">본인 식별·인증</td>
                  <td className="px-3 py-2">계정 삭제 시까지</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2">이사 정보(이사일·주거유형·계약유형 등)</td>
                  <td className="px-3 py-2">서비스 제공</td>
                  <td className="px-3 py-2">계정 삭제 시까지</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2">사진·EXIF(촬영일시·기기 정보 등)·SHA-256 해시</td>
                  <td className="px-3 py-2">집 상태 기록·증빙</td>
                  <td className="px-3 py-2">계정 삭제 시까지</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2">메모</td>
                  <td className="px-3 py-2">사용자 메모 보관</td>
                  <td className="px-3 py-2">계정 삭제 시까지</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2">익명 식별자·세션</td>
                  <td className="px-3 py-2">디바이스 격리</td>
                  <td className="px-3 py-2">장기 미활동/이사 일정 도래 시 파기</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2">기기 푸시 토큰</td>
                  <td className="px-3 py-2">알림 발송</td>
                  <td className="px-3 py-2">알림 해제·계정 삭제 시까지</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">해시 처리된 IP</td>
                  <td className="px-3 py-2">요청 빈도 제한</td>
                  <td className="px-3 py-2">2일</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-body-sm leading-relaxed text-muted">
            <li>원본 사진의 EXIF에는 촬영 위치(GPS)가 포함될 수 있습니다.</li>
            <li>메모와 사진은 AI 가이드 생성에 전송되지 않습니다.</li>
            <li>IP는 평문으로 저장하지 않고 해시 처리하여 저장합니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-h3 font-semibold">3. 제3자 제공</h2>
          <p className="text-body leading-relaxed">
            서비스는 이용자의 개인정보를 외부에 별도로 제공하지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-h3 font-semibold">4. 처리위탁</h2>
          <p className="mb-2 text-body leading-relaxed">
            앱 기능 제공에 필요한 최소 정보만 다음 위탁처에서 처리됩니다.
          </p>
          <ul className="list-disc space-y-2 pl-5 text-body leading-relaxed">
            <li>
              <span className="font-medium">Supabase Inc.</span> (서울 리전) —
              데이터베이스·인증·사진 저장. 데이터는 국내(대한민국)에서 처리됩니다.
            </li>
            <li>
              <span className="font-medium">Vercel Inc.</span> (미국) — 웹 호스팅. 호스팅 과정에서
              접속 로그 등 기술 정보가 처리될 수 있습니다.
            </li>
            <li>
              <span className="font-medium">Anthropic PBC</span> (미국) — 맞춤 가이드 생성. 이사
              조건과 체크리스트 항목만 전송하며 주소·메모·사진·이메일은 전송하지 않습니다.
            </li>
            <li>
              <span className="font-medium">Sentry (Functional Software, Inc.)</span> (미국) — 오류
              진단. 스택트레이스·임의 식별자(uuid)·기기/브라우저 등 기술적 오류정보가 전송되며,
              주소·연락처·메모·사진·이메일은 이벤트에 전송하지 않습니다. 약 30일 보관.
            </li>
            <li>
              <span className="font-medium">PostHog, Inc.</span> (미국) — 이용 통계 분석. 행동
              이벤트와 임의 식별자(uuid)만 처리하며, 주소·연락처·메모·사진·이메일은 전송하지
              않습니다. 약 12개월 보관.
            </li>
            <li>
              <span className="font-medium">Expo (650 Industries, Inc.)</span> (미국) — 푸시 알림
              발송. 기기 푸시 토큰과 알림 문구만 처리하며, 주소·연락처·메모·사진·이메일은 전송하지
              않습니다.
            </li>
            <li>
              <span className="font-medium">Apple · Google · Kakao</span> — 소셜 로그인을 통한 본인
              식별.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-h3 font-semibold">5. 국외 이전</h2>
          <p className="text-body leading-relaxed">
            Supabase에 저장되는 본 서비스 데이터는 국내(서울) 리전에서 처리됩니다.
            Vercel·Anthropic·Sentry·PostHog·Expo로의 처리위탁은 위 4항의 최소 범위로 한정되며,
            미국에서 처리됩니다. 분석·오류 진단 과정에서 IP는 분석 이벤트 속성으로 저장하지 않도록
            설정하며, 서비스 제공 과정의 네트워크/접속 정보는 각 수탁자 정책에 따라 최소한의
            기술정보로 처리될 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-h3 font-semibold">6. 정보주체의 권리·행사 방법</h2>
          <ul className="list-disc space-y-1 pl-5 text-body leading-relaxed">
            <li>열람: 앱 내 화면에서 직접 확인할 수 있습니다.</li>
            <li>정정·삭제: 이사 정보·메모·사진은 앱 내에서 직접 수정·삭제할 수 있습니다.</li>
            <li>
              계정 삭제: [설정 &gt; 계정 삭제]에서 직접 요청하거나 보호책임자에게 요청할 수
              있습니다.
            </li>
            <li>처리 정지: 보호책임자에게 이메일로 요청할 수 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-h3 font-semibold">7. 파기 절차 및 방법</h2>
          <ul className="list-disc space-y-1 pl-5 text-body leading-relaxed">
            <li>회원: 계정 삭제 요청 시 데이터베이스 행과 사진을 즉시 파기합니다.</li>
            <li>익명 사용자: 장기 미활동 또는 이사 일정 도래 시 자동 파기 정책을 적용합니다.</li>
            <li>해시 IP: 2일 후 자동 삭제합니다.</li>
            <li>백업본은 백업 보존 기한 도래 시 함께 폐기합니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-h3 font-semibold">8. 안전성 확보 조치</h2>
          <ul className="list-disc space-y-1 pl-5 text-body leading-relaxed">
            <li>행 수준 보안(RLS)으로 본인 데이터만 접근 가능</li>
            <li>전송 구간 HTTPS/TLS 암호화</li>
            <li>IP는 해시 처리 후 저장(평문 미저장)</li>
            <li>API 키·비밀 정보는 별도 보관</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-h3 font-semibold">9. 만 14세 미만 아동의 개인정보</h2>
          <p className="text-body leading-relaxed">
            서비스는 만 14세 미만 아동의 개인정보를 수집하지 않습니다. 가입 이후 만 14세 미만임이
            확인된 경우 즉시 계정과 데이터를 파기합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-h3 font-semibold">10. 개인정보 보호책임자</h2>
          <ul className="list-disc space-y-1 pl-5 text-body leading-relaxed">
            <li>이름: 서민수</li>
            <li>
              이메일:{' '}
              <a className="text-primary underline" href="mailto:usnimoes@gmail.com">
                usnimoes@gmail.com
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-h3 font-semibold">11. 처리방침의 변경</h2>
          <p className="text-body leading-relaxed">
            본 처리방침은 법령 개정 및 서비스 변경에 따라 수정될 수 있으며, 변경 시 시행일 7일 전 앱
            내 공지로 안내합니다.
          </p>
        </section>
      </article>
    </div>
  )
}

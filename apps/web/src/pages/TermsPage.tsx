import { ChevronLeft } from 'lucide-react'
import { useGoBack } from '@/shared/hooks/useGoBack'
import { PageHeader } from '@/shared/components/PageHeader'

const EFFECTIVE_DATE = '2026-05-26'

export function TermsPage() {
  const goBack = useGoBack('/settings')

  return (
    <div className="flex min-h-dvh flex-col bg-neutral">
      <PageHeader
        title="이용약관"
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

        <section>
          <h2 className="mb-2 text-h3 font-semibold">제1조 (목적)</h2>
          <p className="text-body leading-relaxed">
            본 약관은 “이사콕”(이하 “서비스”)의 이용 조건과 절차, 이용자와 운영자의 권리·의무에 관한
            사항을 정함을 목적으로 합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-h3 font-semibold">제2조 (정의)</h2>
          <ul className="list-disc space-y-1 pl-5 text-body leading-relaxed">
            <li>“서비스”: 이사 일정 관리 및 집 상태 기록을 제공하는 모바일·웹 애플리케이션</li>
            <li>“회원”: 소셜 로그인(Apple/Google/Kakao)을 통해 가입한 이용자</li>
            <li>“익명 사용자”: 로그인 없이 서비스를 이용하는 사람</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-h3 font-semibold">제3조 (약관의 효력 및 변경)</h2>
          <p className="text-body leading-relaxed">
            본 약관은 이용자가 서비스에 가입하거나 서비스를 이용함으로써 효력이 발생합니다. 운영자는
            관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 시행일 7일 전 앱 내
            공지로 안내합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-h3 font-semibold">제4조 (회원가입 및 계정)</h2>
          <ul className="list-disc space-y-1 pl-5 text-body leading-relaxed">
            <li>만 14세 이상이어야 회원가입할 수 있습니다.</li>
            <li>소셜 로그인(Apple / Google / Kakao) 중 하나로 가입합니다.</li>
            <li>계정 정보의 안전한 관리 책임은 회원에게 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-h3 font-semibold">제5조 (서비스 제공)</h2>
          <p className="mb-2 text-body leading-relaxed">서비스는 다음 기능을 제공합니다.</p>
          <ul className="list-disc space-y-1 pl-5 text-body leading-relaxed">
            <li>이사 일정에 맞춘 체크리스트 자동 생성</li>
            <li>체크리스트 진행 상황 관리</li>
            <li>집 상태 사진 기록 및 리포트</li>
            <li>이용자 조건 기반 맞춤 가이드(AI 활용)</li>
          </ul>
          <p className="mt-2 text-body leading-relaxed">
            서비스의 기능과 화면은 이용자에게 사전 고지 후 변경될 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-h3 font-semibold">제6조 (회원의 의무)</h2>
          <p className="mb-2 text-body leading-relaxed">회원은 다음 행위를 하여서는 안 됩니다.</p>
          <ul className="list-disc space-y-1 pl-5 text-body leading-relaxed">
            <li>타인의 명의를 도용하거나 허위 정보를 제공하는 행위</li>
            <li>서비스의 정상적 운영을 방해하는 행위(예: 비정상 요청, 자동화 접근, 보안 우회)</li>
            <li>법령에 위반되는 내용을 게시·전송하는 행위</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-h3 font-semibold">제7조 (회원 탈퇴 및 자격 상실)</h2>
          <ul className="list-disc space-y-1 pl-5 text-body leading-relaxed">
            <li>
              회원은 언제든지 [설정 &gt; 계정 삭제]에서 직접 탈퇴할 수 있으며, 탈퇴 시 회원의 모든
              데이터는 즉시 파기됩니다.
            </li>
            <li>
              회원이 본 약관을 위반하거나 법령에 반하는 행위를 한 경우 운영자는 사전 통지 후 회원
              자격을 제한·정지·해지할 수 있습니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-h3 font-semibold">제8조 (면책)</h2>
          <ul className="list-disc space-y-1 pl-5 text-body leading-relaxed">
            <li>
              서비스가 제공하는 체크리스트와 맞춤 가이드는 일반 정보 제공을 목적으로 하며,
              법률·세무·부동산 자문이 아닙니다. 실제 의사결정은 이용자 본인의 책임입니다.
            </li>
            <li>
              천재지변, 통신·전력 장애, 외부 서비스 장애 등 운영자의 통제를 벗어난 사유로 인한
              서비스 중단에 대해서는 책임을 지지 않습니다.
            </li>
            <li>
              회원 본인의 부주의로 인한 데이터 손실(예: 직접 삭제, 디바이스 분실)에 대해서는 책임을
              지지 않습니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-h3 font-semibold">제9조 (책임 제한)</h2>
          <p className="text-body leading-relaxed">
            운영자의 책임은 관련 법령이 허용하는 최대 범위 내에서 제한됩니다. 서비스는 현재 무료로
            제공되며, 운영자는 회원에게 별도의 손해배상 의무를 부담하지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-h3 font-semibold">제10조 (준거법 및 분쟁 해결)</h2>
          <p className="text-body leading-relaxed">
            본 약관과 서비스는 대한민국 법령을 준거법으로 하며, 분쟁 발생 시 서울중앙지방법원을
            제1심 관할 법원으로 합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-h3 font-semibold">제11조 (문의)</h2>
          <p className="text-body leading-relaxed">
            서비스 이용 및 약관 관련 문의는{' '}
            <a className="text-primary underline" href="mailto:usnimoes@gmail.com">
              usnimoes@gmail.com
            </a>
            로 연락주시기 바랍니다.
          </p>
        </section>
      </article>
    </div>
  )
}

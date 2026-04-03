interface OnboardingFooterProps {
  children: React.ReactNode
}

export function OnboardingFooter({ children }: OnboardingFooterProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-10 mx-auto max-w-[430px]">
      <div className="pointer-events-none h-8 bg-gradient-to-t from-neutral to-transparent" />
      <div className="bg-neutral px-5 pb-10">{children}</div>
    </div>
  )
}

import { Check } from 'lucide-react'

export function CompletionStamp() {
  return (
    <div
      aria-label="완료된 할 일"
      className="pointer-events-none absolute right-6 top-20 z-10 flex h-[92px] w-[92px] rotate-[-14deg] flex-col items-center justify-center rounded-full border-[3px] border-success text-success opacity-80"
    >
      <Check size={22} strokeWidth={3.5} />
      <span className="mt-0.5 text-[22px] font-black leading-none tracking-tight">완료</span>
    </div>
  )
}

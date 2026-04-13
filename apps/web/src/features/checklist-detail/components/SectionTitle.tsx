interface SectionTitleProps {
  children: React.ReactNode
  right?: React.ReactNode
}

export function SectionTitle({ children, right }: SectionTitleProps) {
  if (right) {
    return (
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-h3 font-semibold text-secondary">{children}</h2>
        {right}
      </div>
    )
  }
  return <h2 className="mb-4 text-h3 font-semibold text-secondary">{children}</h2>
}

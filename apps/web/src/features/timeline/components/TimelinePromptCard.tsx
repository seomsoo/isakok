export function TimelinePromptCard() {
  return (
    <div className="mx-5 mt-4 mb-6 rounded-2xl bg-surface p-5 shadow-sm">
      <p className="text-body font-medium text-secondary">
        꼼꼼한 마무리를 위해
      </p>
      <p className="mt-1 text-body-sm text-muted">
        입주 후 7일까지 꼼꼼하게 체크하세요
      </p>
      <button
        type="button"
        onClick={() => console.log('TODO: 추가 팁')}
        className="mt-3 text-body-sm font-medium text-primary"
      >
        추가 팁 보기 →
      </button>
    </div>
  )
}

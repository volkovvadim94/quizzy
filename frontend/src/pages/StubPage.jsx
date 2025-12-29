import SectionHeader from '../components/layout/SectionHeader'

export default function StubPage({ title, onBack, showHeader = false }) {
  return (
    <div className="-mx-4 -my-4 flex flex-col flex-1 min-h-0 bg-white">
      {showHeader ? (
        <SectionHeader title={title} backTo="/" onBack={onBack} hideBack />
      ) : null}
      <div className="w-full max-w-[430px] mx-auto flex-1 flex flex-col items-center justify-center px-4 pb-16 text-center gap-4">
        <div className="text-[24px] leading-[30px] font-extrabold text-[var(--qz-text)]">{title}</div>
        <div className="text-[15px] leading-[22px] text-[var(--qz-gray)]">Данный функционал ещё не готов</div>
        <button
          type="button"
          className="w-full max-w-[220px] h-[48px] rounded-[12px] bg-[var(--qz-blue)] text-white text-[17px] leading-[22px] font-semibold"
          onClick={onBack}
        >
          На главную
        </button>
      </div>
    </div>
  )
}

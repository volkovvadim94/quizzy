import { Play } from 'lucide-react'

/**
 * Difficulty selection modal (Home screen).
 * Controlled by parent via `modalRef` (HTMLDialogElement) and `topic`.
 */
export default function DifficultyModal({ modalRef, topic, difficulties, onStart, onClose }) {
  return (
    <dialog ref={modalRef} className="modal">
      {topic && (
        <div className="modal-box difficulty-modal text-base-content shadow-2xl opacity-100">
          <div className="flex items-center gap-2 mb-3">
            <Play size={18} />
            <div className="text-lg font-bold">{topic.name}</div>
          </div>

          <div className="space-y-3">
            {difficulties.map((diff) => (
              <button
                key={diff.id}
                className="w-full p-4 rounded-xl bg-base-200 hover:bg-base-300 transition text-left flex items-center justify-between"
                onClick={() => onStart(topic.id, diff.id)}
              >
                <div>
                  <div className="font-semibold">{diff.name}</div>
                  <div className="text-sm opacity-70">{diff.description}</div>
                </div>
                <span className={`badge ${diff.color}`}>{diff.name}</span>
              </button>
            ))}
          </div>

          <div className="modal-action">
            <button className="btn" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>
      )}
      <form method="dialog" className="modal-backdrop">
        <button aria-label="close" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  )
}

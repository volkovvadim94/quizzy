import CenteredCard from '../feedback/CenteredCard'

export default function RoomNotFound({ onGoHome }) {
  return (
    <CenteredCard
      title="Комната не найдена"
      actions={
        <button className="btn btn-primary" onClick={onGoHome}>
          На главную
        </button>
      }
    >
      <p className="opacity-70">Проверь код комнаты и попробуй снова.</p>
    </CenteredCard>
  )
}


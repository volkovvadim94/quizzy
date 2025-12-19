import CenteredCard from '../feedback/CenteredCard'

export default function RoomFull({ onGoHome, gameId }) {
  return (
    <CenteredCard
      title="Комната переполнена"
      actions={
        <button className="btn btn-primary" onClick={onGoHome}>
          На главную
        </button>
      }
    >
      <p className="opacity-70">
        {gameId ? (
          <>
            Код комнаты: <span className="font-black tracking-widest">{String(gameId).toUpperCase()}</span>
          </>
        ) : (
          'В этой комнате уже максимальное число игроков.'
        )}
      </p>
      <p className="opacity-70">Попробуй подключиться позже или попроси хоста создать новую комнату.</p>
    </CenteredCard>
  )
}


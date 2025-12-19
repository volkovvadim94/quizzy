# QUIZZY — Telegram‑квиз с комнатами и режимом трансляции (Spectate)

Quizzy — party‑квиз, который запускается в Telegram Mini App (WebApp) и поддерживает:
- комнаты (лобби) + готовность игроков,
- игру с вопросами (`single_choice` и `sequence`),
- фазы reveal + отдельную фазу начисления очков с “спортивной” анимацией,
- режим трансляции `/spectate/:roomId` для большого экрана + QR‑код,
- защиту от мультисессий (перехват сессии по `clientSessionId`),
- ботов (опционально) для массовки.

Этот README **общий** для двух окружений (**dev** и **main**) — код один и тот же, отличаются только `.env` (домены/порты/боты/фичи).

---

## 0) Термины и бизнес‑логика

### Сущности
- **Topic (Тема)** — категория вопросов.
- **Question (Вопрос)** — текст + варианты + (опционально) медиа.
- **Room (Комната)** — игровая сессия с кодом из 6 символов (например `A1B2C3`).
- **Host/Organizer (Хост/Организатор)** — создатель комнаты; может стартовать игру. Если хост дисконнектится — “корона” передаётся.
- **Player (Игрок)** — участник комнаты.
- **Spectator (Зритель)** — “большой экран”, который наблюдает за комнатой без участия.

### Экраны/режимы
- **Home** — выбор темы и создание комнаты (опционально — выбор сложности комнаты).
- **Room (Lobby)** — список игроков + “Готов” + старт от хоста.
- **Game** — вопросы/ответы + reveal + scoring overlay.
- **Spectate** — трансляция: список игроков слева, вопросы справа; в ожидании — QR‑код.

---

## 1) Архитектура (технически)

### Стек
- Frontend: React + Vite + Tailwind + daisyUI, Socket.IO client
- Backend: Node.js + Express + Socket.IO, Prisma
- DB: SQLite (в репо — `backend/prisma/dev.db`)

### Как это собрано
- В продакшене backend раздаёт и API, и собранный фронт.
- `frontend` собирается в `backend/dist` (см. `frontend/vite.config.js`).

### Важно про состояние комнат
Комнаты живут **в памяти процесса** (in‑memory store, `backend/src/utils/roomStore.js`).
Это означает:
- один backend‑процесс = один “мир” комнат,
- для горизонтального масштабирования нужны sticky‑sessions или общий стор (Redis/DB).

---

## 2) Быстрый старт (локально)

### Требования
- Node.js 18+ (лучше 20+)
- npm

### Backend
```bash
cd backend
npm i
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

### Frontend
```bash
cd frontend
npm i
npm run dev
```

В дев‑режиме фронт ходит в backend через proxy `/api` (см. `frontend/vite.config.js`).

### Сборка “как на сервере”
```bash
cd frontend
npm run build

cd ../backend
npm start
```

---

## 3) Окружения (dev и main)

### Что обычно отличается
- домен/порт (например у dev отдельный порт/поддомен),
- Telegram‑бот (token/username),
- включённые фичи.

### Принцип конфигов
- Backend читает `backend/.env`.
- Frontend читает “дефолты” из `VITE_*`, но финально подхватывает feature flags с `GET /api/config`.

### Шпаргалка: что и где настраивать
| Что | Dev | Main |
|---|---|---|
| Домен/порт | свои | свои |
| Telegram бот | отдельный bot token + username | отдельный bot token + username |
| Backend `.env` | `backend/.env` | `backend/.env` в main‑папке |
| Frontend `.env` | `frontend/.env` | `frontend/.env.production` (для билда) |

### Пример `backend/.env` (шаблон)
```env
PORT=5002
NODE_ENV=development
JWT_SECRET=change-me
TELEGRAM_BOT_TOKEN=change-me

# Feature flags
FEATURE_DIFFICULTY_SELECTION=false
FEATURE_PLAYERS_LIST_IN_GAME=true
FEATURE_BOTS=false

# Logging
LOG_ROOMS=true
LOG_SOCKETS=true
DEBUG_SESSIONS=false
```

### Пример `frontend/.env` (шаблон)
```env
# Для deep-link/QR в Spectate
VITE_TELEGRAM_BOT_USERNAME=your_bot_username
VITE_TELEGRAM_WEBAPP_NAME=your_webapp_name

# Обычно не нужно, потому что фронт ходит в same-origin и через proxy
# VITE_API_URL=https://example.com/api
# VITE_SOCKET_URL=https://example.com
```

Если меняешь порт backend локально — обнови `frontend/vite.config.js` (`server.proxy['/api'].target`).

---

## 4) Правила игры

### Типы вопросов
- `single_choice` — выбрать один вариант (сервер проверяет `answerIndex`).
- `sequence` — собрать порядок (сервер проверяет массив `sequence`).

### Перемешивание вариантов (важно)
Чтобы игроки не запоминали позиции ответов:
- порядок вариантов перемешивается **на бэкенде** один раз на вопрос,
- сервер отдаёт `options` (уже перемешанные) + `optionOrder` (перестановка),
- это **одинаково** для всех клиентов и для Spectate.

### Сложность
- Сложность вопроса хранится как `difficultyPreset`:
  - `0` easy, `1` medium, `2` hard, `3` hardcore
- Сложность комнаты:
  - либо конкретная (если включён `difficultySelection`),
  - либо `random` (“случайно”) — вопросы выбираются по распределению `RANDOM_DISTRIBUTION`.

### Очки
Очки начисляются за правильный ответ, зависят от сложности: `DIFFICULTY_SCORE` в `backend/src/utils/constants.js`.

### Фазы и тайминги
Константы находятся в `backend/src/utils/constants.js`:
- `QUESTION_TIME_MS` — время на ответ
- `REVEAL_TIME_MS` — подсветка правильного ответа
- `SCORING_TIME_MS` — фаза начисления очков (внутри UI разбита на подпереходы)

---

## 5) Room lifecycle: реконнект, оффлайн, перехват сессии

### Оффлайн/реконнект
- при потере сокета игрок сразу становится “offline” (в UI серый),
- есть `RECONNECT_GRACE_MS` (по умолчанию 10 секунд) на возвращение,
- если не вернулся — удаляется из комнаты,
- если отвалился хост — хост переходит первому онлайн‑игроку.

### Перехват сессии (мульти‑устройства/вкладки)
Клиент генерит `clientSessionId` и хранит его в localStorage.
Сервер использует `clientSessionId`, чтобы:
- разрешать “одну активную сессию на игрока”,
- при появлении нового `clientSessionId` отправлять `SESSION_TAKEN_OVER` старым сокетам и отключать их.

На фронте это ведёт на экран “Сессию перехватили” и кнопку “Подключиться здесь”.

### TTL комнаты
Комнаты не должны жить бесконечно:
- `ROOM_TTL_MS` — принудительное закрытие комнаты по истечении времени без активности (по умолчанию 10 минут).
- при закрытии отправляется `GAME_CLOSED`.

---

## 6) Боты

Фича включается `FEATURE_BOTS=true`.
Поведение:
- в каждую комнату добавляются 10 ботов,
- боты отвечают рандомно и умеют `single_choice` и `sequence`,
- ботам начисляются очки как обычным игрокам,
- “общий рейтинг” ботов ведётся **in‑memory** (после рестарта сбрасывается).

---

## 7) Медиа в вопросах (картинки/видео/аудио)

### Где хранить файлы
Кладём файлы сюда:

`frontend/public/media/`
- `pictures/*`
- `video/*`
- `audio/*`

После `npm run build` они попадают в `backend/dist/media/*` и доступны как `/media/*`.

### Что писать в БД
В полях `picture`, `video`, `audio` можно хранить:
- `media/pictures/test.jpg`
- `pictures/test.jpg`
- `test.jpg` (если понятно по типу поля)

Если файла нет — подставляется `/media/placeholder.png`.

---

## 8) HTTP API

Фронт использует relative baseURL (`baseURL=''`), поэтому за reverse‑proxy работать проще.

### Auth
- `POST /api/auth/telegram` — логин через Telegram (WebApp `initDataRaw` или widget payload)
- `GET /api/auth/me` — профиль + место + top‑10

### Game
- `POST /api/games/create` — создать комнату
- `GET /api/games/:roomId` — состояние комнаты (auth)
- `GET /api/games/spectate/:roomId` — публичное состояние для Spectate

### Config
- `GET /api/config` — фичетогглы сервера

### Health
- `GET /api/health`

---

## 9) WebSocket события (Socket.IO)

### Клиент → сервер
- `AUTH { token, clientSessionId }`
- `JOIN_GAME { gameId, playerId?, clientSessionId }`
- `LEAVE_GAME { gameId, playerId }`
- `PLAYER_READY { gameId, playerId, isReady }`
- `START_GAME { gameId }`
- `SUBMIT_ANSWER { gameId, questionId, answerIndex?, sequence?, playerId? }`
- `JOIN_SPECTATOR { spectateToken }`

### Сервер → клиент
- `AUTH_OK { userId }`
- `ACTIVE_GAME { gameId, status }`
- `GAME_STATE { ... }`
- `NEW_QUESTION { question, questionIndex, totalQuestions, questionTimeMs, revealTimeMs }`
- `QUESTION_ENDED { correctAnswer, correctSequence }`
- `SCORE_PHASE { scoringTimeMs, beforePlayers, afterPlayers, ... }`
- `GAME_STARTED`
- `GAME_FINISHED { leaderboard }`
- `GAME_CLOSED`
- `SESSION_TAKEN_OVER { gameId?, playerId }`
- `ANSWER_RECEIVED { isCorrect }`
- `ERROR { message }`

---

## 10) Feature flags и переменные окружения

### Backend (`backend/.env`)
Минимально нужное:
- `PORT=...`
- `JWT_SECRET=...` (обязательно для production)
- `TELEGRAM_BOT_TOKEN=...` (обязательно для production)

Feature flags:
- `FEATURE_DIFFICULTY_SELECTION=true|false` — выбор сложности комнаты
  - legacy alias: `FEATURE_QUESTION_RATING`
- `FEATURE_PLAYERS_LIST_IN_GAME=true|false` — показывать ли игрокам список игроков во время игры
- `FEATURE_BOTS=true|false` — включить ботов

Логи/диагностика:
- `LOG_ROOMS=true|false`
- `LOG_SOCKETS=true|false`
- `DEBUG_SESSIONS=true|false`

При старте backend печатает конфиг (фичи/тайминги): `backend/src/utils/startupInfo.js`.

### Frontend (`frontend/.env`, `frontend/.env.production`)
- `VITE_TELEGRAM_BOT_USERNAME=...` (username бота без `@`)
- `VITE_TELEGRAM_WEBAPP_NAME=...` (если используется `t.me/<bot>/<app>`)
- `VITE_SOCKET_URL=...` (опционально)
- `VITE_API_URL=...` (опционально)

---

## 11) Telegram: что нужно настроить

1) Создать бота через BotFather.
2) Настроить WebApp URL (для dev и main — разные).
3) Прописать `TELEGRAM_BOT_TOKEN` в `backend/.env`.

В production WebApp initData проверяется по правилам Telegram (HMAC).

---

## 12) Структура репозитория

- `backend/` — Express + Socket.IO + Prisma
- `frontend/` — React + Vite + Tailwind + daisyUI
- `backend/prisma/` — SQLite + схема + seed
- `backend/dist/` — production build фронта (генерируется)

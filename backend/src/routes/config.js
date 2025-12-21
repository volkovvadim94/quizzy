import express from 'express';

const router = express.Router();

const parseBool = (value, defaultValue = true) => {
  if (value === undefined || value === null) return defaultValue;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false;
  return defaultValue;
};

router.get('/', (_req, res) => {
  // Default OFF: выбор сложности включается только флагом
  const difficultySelection =
    parseBool(process.env.FEATURE_DIFFICULTY_SELECTION, false) ||
    // Backward-compat: older env name used in some setups
    parseBool(process.env.FEATURE_QUESTION_RATING, false);

  // Default ON: keep current UX unless explicitly disabled.
  const playersListInGame = parseBool(process.env.FEATURE_PLAYERS_LIST_IN_GAME, true);

  // Default OFF: bots should be opt-in.
  const bots = parseBool(process.env.FEATURE_BOTS, false);

  // ---------- Auth switches ----------
  const telegramEnabled = parseBool(process.env.AUTH_METHOD_TELEGRAM, true);
  const emailEnabled = parseBool(process.env.AUTH_METHOD_EMAIL, false);
  const vkEnabled = parseBool(process.env.AUTH_METHOD_VK, false);

  const telegramModeRaw = String(process.env.AUTH_TELEGRAM_LOGIN_MODE || 'oauth').trim().toLowerCase();
  const telegramMode = telegramModeRaw === 'qr' || telegramModeRaw === 'qrcode' ? 'qr' : 'oauth';

  res.set('Cache-Control', 'no-store');
  res.json({
    server: {
      pid: process.pid,
      uptimeSec: Math.round(process.uptime()),
      sessionTakeover: true,
    },
    features: {
      difficultySelection,
      playersListInGame,
      bots,
    },
    auth: {
      methods: {
        telegram: { enabled: telegramEnabled, mode: telegramMode },
        email: { enabled: emailEnabled },
        vk: { enabled: vkEnabled },
      },
    },
  });
});

export default router;

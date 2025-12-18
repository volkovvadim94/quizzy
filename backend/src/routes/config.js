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

  res.set('Cache-Control', 'no-store');
  res.json({
    server: {
      pid: process.pid,
      uptimeSec: Math.round(process.uptime()),
      sessionTakeover: true,
    },
    features: {
      difficultySelection,
    },
  });
});

export default router;

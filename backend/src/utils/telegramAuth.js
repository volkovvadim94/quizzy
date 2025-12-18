import crypto from 'crypto';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN';

export const verifyTelegramData = (telegramData) => {
  try {
    // Для разработки - пропускаем проверку хеша
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️  Development mode: Skipping Telegram hash verification');
      return true;
    }

    const dataCheckString = Object.keys(telegramData)
      .filter(key => key !== 'hash')
      .sort()
      .map(key => `${key}=${telegramData[key]}`)
      .join('\n');

    const secretKey = crypto.createHash('sha256')
      .update(BOT_TOKEN)
      .digest();
    
    const calculatedHash = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return calculatedHash === telegramData.hash;
  } catch (error) {
    console.error('Telegram auth error:', error);
    return false;
  }
};
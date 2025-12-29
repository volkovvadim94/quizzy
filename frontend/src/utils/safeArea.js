export const TG_TOP_WEBAPP_EXTRA_PX = 86

export function tgTopPadding(
  isWebApp,
  { webAppExtraPx = TG_TOP_WEBAPP_EXTRA_PX, defaultExtraPx = 0 } = {}
) {
  const extra = isWebApp ? webAppExtraPx : defaultExtraPx
  return `calc(env(safe-area-inset-top, 0px) + ${extra}px)`
}


import { CustomCssTarget, CustomCssFieldName, Stored } from 'src/types'
import { Styles } from 'src/services/styles'
import { Logs } from 'src/services/logs'
import { Settings } from 'src/services/settings'
import { Store } from 'src/services/storage'
import { Info } from 'src/services/info'
import Utils from 'src/utils'
import { FF_THEME_COLORS } from 'src/defaults'
import { Sidebar } from './sidebar'

/**
 * Load predefined theme and apply it
 */
export function initTheme(): void {
  const themeLinkEl = document.getElementById('theme_link') as HTMLLinkElement

  // Remove theme css
  if (Settings.reactive.theme === 'none') {
    themeLinkEl?.setAttribute('disabled', 'disabled')
    return
  }

  // Create next theme link
  const nextThemeLinkEl = document.createElement('link')
  nextThemeLinkEl.type = 'text/css'
  nextThemeLinkEl.rel = 'stylesheet'
  document.head.appendChild(nextThemeLinkEl)

  // Wait until new theme loaded
  nextThemeLinkEl.onload = () => {
    // Remove prev theme link
    if (themeLinkEl) themeLinkEl.remove()
    nextThemeLinkEl.id = 'theme_link'

    Sidebar.recalcElementSizesDebounced()
  }
  nextThemeLinkEl.href = `/themes/${Settings.reactive.theme}/${Info.getInstanceName()}.css`

  Logs.info(`Theme initialized: ${Settings.reactive.theme}`)
}

const PREF_DARK_MEDIA = '(prefers-color-scheme: dark), (prefers-color-scheme: no-preference)'
let darkMedia: MediaQueryList | undefined
export async function initColorScheme(theme?: browser.theme.Theme): Promise<void> {
  if (Settings.reactive.colorScheme === 'ff') {
    Logs.info('Styles: initColorScheme')
    if (!theme) theme = await browser.theme.getCurrent()
    // console.log('[DEBUG] theme', Utils.cloneObject(theme))

    const colorSchemeVariant = parseTheme(theme)
    if (colorSchemeVariant === ColorSchemeVariant.Dark) Styles.reactive.colorScheme = 'dark'
    if (colorSchemeVariant === ColorSchemeVariant.Light) Styles.reactive.colorScheme = 'light'

    if (theme.colors) applyFirefoxThemeColors(theme)
    else resetFirefoxThemeColors()

    if (browser.theme && !browser.theme.onUpdated.hasListener(onFirefoxThemeChange)) {
      browser.theme.onUpdated.addListener(onFirefoxThemeChange)
    }
  } else {
    resetFirefoxThemeColors()

    if (browser.theme?.onUpdated.hasListener(onFirefoxThemeChange)) {
      browser.theme.onUpdated.removeListener(onFirefoxThemeChange)
    }
  }

  if (Settings.reactive.colorScheme === 'sys') {
    if (!darkMedia) darkMedia = window.matchMedia(PREF_DARK_MEDIA)
    if (!darkMedia.onchange) darkMedia.onchange = onDarkMediaQueryChange
    if (darkMedia.matches) Styles.reactive.colorScheme = 'dark'
    else Styles.reactive.colorScheme = 'light'
    return
  } else {
    if (darkMedia?.onchange) darkMedia.onchange = null
  }

  if (Settings.reactive.colorScheme === 'dark') {
    Styles.reactive.colorScheme = 'dark'
    return
  }

  if (Settings.reactive.colorScheme === 'light') {
    Styles.reactive.colorScheme = 'light'
    return
  }
}

function onDarkMediaQueryChange(): void {
  if (darkMedia?.matches) Styles.reactive.colorScheme = 'dark'
  else Styles.reactive.colorScheme = 'light'
}

async function onFirefoxThemeChange(upd: browser.theme.Update): Promise<void> {
  if (!upd.theme || !upd.theme.colors) {
    const theme = await browser.theme.getCurrent()
    const colorSchemeVariant = parseTheme(theme)
    if (colorSchemeVariant === ColorSchemeVariant.Dark) Styles.reactive.colorScheme = 'dark'
    if (colorSchemeVariant === ColorSchemeVariant.Light) Styles.reactive.colorScheme = 'light'
    if (theme.colors) applyFirefoxThemeColors(theme)
    else resetFirefoxThemeColors()
  } else {
    const colorSchemeVariant = parseTheme(upd.theme)
    if (colorSchemeVariant === ColorSchemeVariant.Dark) Styles.reactive.colorScheme = 'dark'
    if (colorSchemeVariant === ColorSchemeVariant.Light) Styles.reactive.colorScheme = 'light'
    if (upd.theme.colors) applyFirefoxThemeColors(upd.theme)
    else resetFirefoxThemeColors()
  }
}

export const enum ColorSchemeVariant {
  Dark = 1,
  Light = 2,
}

function getColorSchemeVariant(bg?: RGBAColor, fg?: RGBAColor): ColorSchemeVariant | undefined {
  let variant: ColorSchemeVariant | undefined
  if (bg && fg && bg[3] > 0.1) {
    const bgn = (bg[0] + bg[1] + bg[2]) / 3
    const fgn = (fg[0] + fg[1] + fg[2]) / 3
    if (bgn > fgn) variant = ColorSchemeVariant.Light
    else variant = ColorSchemeVariant.Dark
  }
  return variant
}

function parseTheme(theme: browser.theme.Theme): ColorSchemeVariant {
  const parsed: ParsedThemeColors = {}

  parsed.frame = Utils.toRGBA(theme.colors?.frame ?? theme.colors?.frame_inactive)
  parsed.frameText = Utils.toRGBA(theme.colors?.tab_background_text)
  parsed.frameVariant = getColorSchemeVariant(parsed.frame, parsed.frameText)
  // console.log('[DEBUG] frame', parsed.frame, parsed.frameText)

  const toolbarBG = theme.colors?.toolbar ?? theme.colors?.frame
  const toolbarFG =
    theme.colors?.icons ??
    theme.colors?.bookmark_text ??
    theme.colors?.toolbar_text ??
    theme.colors?.icons_attention ??
    theme.colors?.tab_background_text
  parsed.toolbar = Utils.toRGBA(toolbarBG)
  parsed.toolbarText = Utils.toRGBA(toolbarFG)
  // console.log('[DEBUG] toolbar', parsed.toolbar, parsed.toolbarText)

  const sidebar = Utils.toRGBA(theme.colors?.sidebar)
  const sidebarText = Utils.toRGBA(theme.colors?.sidebar_text)

  const popup = Utils.toRGBA(theme.colors?.popup)
  const popupText = Utils.toRGBA(theme.colors?.popup_text)

  // Handle frame_image
  if (theme.colors && theme.images?.theme_frame && parsed.toolbar?.[3] === 1) {
    const ffg = parsed.frameText
    const tfg = parsed.toolbarText
    if (ffg && tfg) {
      const tn = (tfg[0] + tfg[1] + tfg[2]) / 3
      const fn = (ffg[0] + ffg[1] + ffg[2]) / 3
      if (Math.abs(tn - fn) < 16) {
        parsed.frame = parsed.toolbar
        theme.colors.frame = toolbarBG
      }
    }
  }

  // Normalize frame
  if (theme.colors && parsed.frame?.[3] !== 1) {
    const fb = parsed.frame
    if (fb) {
      const fa = fb[3]
      fb[0] = Math.trunc(fb[0] * fa)
      fb[1] = Math.trunc(fb[1] * fa)
      fb[2] = Math.trunc(fb[2] * fa)
      fb[3] = 1
      theme.colors.frame = `rgb(${fb[0]},${fb[1]},${fb[2]})`
    } else if (sidebar && sidebarText) {
      theme.colors.tab_background_text = `rgb(${sidebarText[0]},${sidebarText[1]},${sidebarText[2]})`
      theme.colors.frame = `rgb(${sidebar[0]},${sidebar[1]},${sidebar[2]})`
      parsed.frame = sidebar
      parsed.frameText = sidebarText
    } else {
      theme.colors = undefined
    }
  }

  // Normalize toolbar
  if (theme.colors && parsed.toolbar?.[3] !== 1) {
    const tb = parsed.toolbar
    const fb = parsed.frame
    if (tb && fb) {
      const ta = tb[3]
      const fa = 1 - ta
      tb[0] = Math.trunc(tb[0] * ta + fb[0] * fa)
      tb[1] = Math.trunc(tb[1] * ta + fb[1] * fa)
      tb[2] = Math.trunc(tb[2] * ta + fb[2] * fa)
      tb[3] = 1
      theme.colors.toolbar = `rgb(${tb[0]},${tb[1]},${tb[2]})`
    } else if (theme.colors.frame) {
      theme.colors.toolbar = theme.colors.frame
    } else if (sidebar && sidebarText) {
      theme.colors.toolbar_text = `rgb(${sidebarText[0]},${sidebarText[1]},${sidebarText[2]})`
      theme.colors.toolbar = `rgb(${sidebar[0]},${sidebar[1]},${sidebar[2]})`
    } else {
      theme.colors = undefined
    }
  }

  // Reset if contrast in frame is too low
  if (theme.colors && parsed.frame && parsed.frameText) {
    const bgn = (parsed.frame[0] + parsed.frame[1] + parsed.frame[2]) / 3
    const fgn = (parsed.frameText[0] + parsed.frameText[1] + parsed.frameText[2]) / 3
    if (Math.abs(bgn - fgn) < 16) {
      if (sidebar && sidebarText) {
        theme.colors.tab_background_text = `rgb(${sidebarText[0]},${sidebarText[1]},${sidebarText[2]})`
        theme.colors.frame = `rgb(${sidebar[0]},${sidebar[1]},${sidebar[2]})`
      } else {
        theme.colors = undefined
      }
    }
  }

  // Reset if contrast in toolbar is too low
  if (theme.colors && parsed.toolbar && parsed.toolbarText) {
    const bgn = (parsed.toolbar[0] + parsed.toolbar[1] + parsed.toolbar[2]) / 3
    const fgn = (parsed.toolbarText[0] + parsed.toolbarText[1] + parsed.toolbarText[2]) / 3
    if (Math.abs(bgn - fgn) < 16) {
      theme.colors = undefined
    }
  }

  // Detect sidebar border
  if (theme.colors && theme.colors.sidebar && theme.colors.sidebar_border) {
    if (theme.colors.sidebar === theme.colors.sidebar_border) {
      theme.colors.sidebar_border_width = '1px'
    }
  }

  // Normalize sidebar background color
  if (theme.colors && sidebar) {
    if (sidebar[3] && sidebar[3] < 1) {
      theme.colors.sidebar = `rgb(${sidebar[0]},${sidebar[1]},${sidebar[2]})`
    }
  }

  let variant = getColorSchemeVariant(parsed.toolbar, parsed.toolbarText)
  parsed.toolbarVariant = variant
  if (!variant) variant = getColorSchemeVariant(sidebar, sidebarText)
  if (!variant) variant = getColorSchemeVariant(popup, popupText)
  if (variant) {
    parsed.toolbarTopSeparator = Utils.toRGBA(theme.colors?.toolbar_top_separator)
    if (theme.colors) calcBorder(theme.colors, parsed)

    return variant
  }

  theme.colors = undefined

  // Fallback to system color scheme
  if (!darkMedia) darkMedia = window.matchMedia(PREF_DARK_MEDIA)
  if (darkMedia.matches) return ColorSchemeVariant.Dark
  else return ColorSchemeVariant.Light
}

type RGBAColor = [number, number, number, number]
interface ParsedThemeColors {
  frame?: RGBAColor
  frameText?: RGBAColor
  frameVariant?: ColorSchemeVariant
  toolbar?: RGBAColor
  toolbarText?: RGBAColor
  toolbarVariant?: ColorSchemeVariant
  toolbarTopSeparator?: RGBAColor
}

function calcBorder(themeColors: browser.theme.ThemeColors, parsed: ParsedThemeColors): void {
  const monoLight = parsed.frameVariant === parsed.toolbarVariant
  const border = parsed.toolbarTopSeparator
  const frame = parsed.frame
  const bar = parsed.toolbar

  // No border
  if (
    !monoLight ||
    !frame ||
    !bar ||
    border?.[3] === 0 ||
    (border?.[0] === frame?.[0] && border?.[1] === frame?.[1] && border?.[2] === frame?.[2]) ||
    (border?.[0] === bar?.[0] && border?.[1] === bar?.[1] && border?.[2] === bar?.[2])
  ) {
    themeColors.border = undefined
    themeColors.border_width = '0'
    return
  }

  // Native border
  if (monoLight && themeColors.toolbar_top_separator && border?.[3] === 1) {
    themeColors.border = themeColors.toolbar_top_separator
    themeColors.border_width = '1px'
    return
  }

  // Calc border
  const frameAv = (frame[0] + frame[1] + frame[2]) / 3
  const barAv = (bar[0] + bar[1] + bar[2]) / 3
  const base = frameAv < barAv ? frame : bar
  themeColors.border = `rgb(${base[0] - 8}, ${base[1] - 8}, ${base[2] - 8})`
  themeColors.border_width = '1px'
}

export function applyFirefoxThemeColors(theme: browser.theme.Theme): void {
  const rootEl = document.getElementById('root')
  if (!rootEl || !theme.colors) return

  for (const colorName of FF_THEME_COLORS) {
    if (theme.colors[colorName]) continue

    rootEl.style.removeProperty(Utils.toCSSVarName('ff_' + colorName))
  }

  for (const prop of Object.keys(theme.colors) as (keyof browser.theme.ThemeColors)[]) {
    const value = theme.colors[prop]

    if (value) {
      rootEl.style.setProperty(Utils.toCSSVarName('ff_' + prop), value)
    } else {
      rootEl.style.removeProperty(Utils.toCSSVarName('ff_' + prop))
    }
  }
}

export function resetFirefoxThemeColors(): void {
  const rootEl = document.getElementById('root')
  if (!rootEl) return

  for (const colorName of FF_THEME_COLORS) {
    rootEl.style.removeProperty(Utils.toCSSVarName('ff_' + colorName))
  }
}

export async function loadCustomSidebarCSS(): Promise<void> {
  const stored = await browser.storage.local.get<Stored>('sidebarCSS')
  applyCustomCSS(stored.sidebarCSS)
  // Recalculate sizes when custom CSS is changed
  Sidebar.recalcElementSizesDebounced()
}

export async function loadCustomGroupCSS(): Promise<void> {
  const stored = await browser.storage.local.get<Stored>('groupCSS')
  applyCustomCSS(stored.groupCSS)
}

/**
 * Update custom css
 */
function applyCustomCSS(css?: string | null): void {
  if (css === null || css === undefined) return

  // Find or create new style element
  let customStyleEl = document.getElementById('custom_css') as HTMLLinkElement
  if (!customStyleEl) {
    customStyleEl = document.createElement('style') as HTMLLinkElement
    customStyleEl.id = 'custom_css'
    customStyleEl.type = 'text/css'
    customStyleEl.rel = 'stylesheet'
    document.head.appendChild(customStyleEl)
  } else {
    // Remove old styles
    while (customStyleEl.lastChild) {
      customStyleEl.removeChild(customStyleEl.lastChild)
    }
  }

  // Apply css
  if (css) customStyleEl.appendChild(document.createTextNode(css))
}

/**
 * Get stored custom css
 */
export async function getCustomCSS(target: CustomCssTarget): Promise<string> {
  const fieldName = (target + 'CSS') as CustomCssFieldName
  const ans = await browser.storage.local.get<Stored>(fieldName)
  if (!ans || !ans[fieldName]) return ''

  return ans[fieldName] as string
}

export async function hasCustomCSS(): Promise<boolean> {
  const storage = await browser.storage.local.get<Stored>(['sidebarCSS', 'groupCSS'])
  return !!storage.sidebarCSS || !!storage.groupCSS
}

/**
 * Apply custom css and save it
 */
export function setCustomCSS(target: CustomCssTarget, css: string): void {
  const fieldName = (target + 'CSS') as CustomCssFieldName

  if (css) Settings.reactive[fieldName] = true
  else Settings.reactive[fieldName] = false

  if (fieldName === 'sidebarCSS') {
    Styles.sidebarCSS = css
    Settings.reactive.sidebarCSS = !!css
  } else if (fieldName === 'groupCSS') {
    Styles.groupCSS = css
    Settings.reactive.groupCSS = !!css
  }

  Settings.saveSettings()
  Store.set({ [fieldName]: css })

  if (Settings.reactive.syncSaveStyles) saveStylesToSync()
}

export function upgradeCustomStyles(stored: Stored, newStorage: Stored): void {
  const legacyCSSVars = stored.cssVars ? convertVarsToCSS(stored.cssVars) : ''

  let sidebarCSS = ''
  if (stored.sidebarCSS) sidebarCSS = `/* OLD STYLES\n${stored.sidebarCSS}\n*/`
  if (legacyCSSVars) sidebarCSS = legacyCSSVars + '\n\n' + sidebarCSS

  let groupCSS = ''
  if (stored.groupCSS) groupCSS = `/* OLD STYLES\n${stored.groupCSS}\n*/`
  if (legacyCSSVars) groupCSS = legacyCSSVars + '\n\n' + groupCSS

  newStorage.sidebarCSS = sidebarCSS
  newStorage.groupCSS = groupCSS
}

const UNDERSCORE_RE = /_/g
export function convertVarsToCSS(vars: Record<string, string | null>): string {
  const cssVars: string[] = []
  for (const key of Object.keys(vars)) {
    const value = vars[key]
    if (!value) continue

    const varName = '--' + key.replace(UNDERSCORE_RE, '-')
    cssVars.push(`#root.root {${varName}: ${value};}`)
  }

  if (!cssVars.length) return ''
  return `/* OLD CSS VARS\n${cssVars.join('\n')}\n*/`
}

export async function loadCustomCSS(): Promise<void> {
  const stored = await browser.storage.local.get<Stored>(['sidebarCSS', 'groupCSS'])
  if (stored.sidebarCSS) Styles.sidebarCSS = stored.sidebarCSS
  if (stored.groupCSS) Styles.groupCSS = stored.groupCSS
}

export async function saveStylesToSync(): Promise<void> {
  const value: Stored = {}

  if (Settings.reactive.sidebarCSS && Styles.sidebarCSS) value.sidebarCSS = Styles.sidebarCSS
  if (Settings.reactive.groupCSS && Styles.groupCSS) value.groupCSS = Styles.groupCSS

  await Store.sync('styles', value)
}

export function setupListeners(): void {
  if (Info.isSidebar) {
    Store.onKeyChange('sidebarCSS', css => applyCustomCSS(css))
  }
}

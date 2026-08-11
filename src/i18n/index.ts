import i18next from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import zh from './locales/zh.json'

export const LANGUAGES = ['zh', 'en'] as const

export type Language = (typeof LANGUAGES)[number]

/**
 * 每种语言用它自己写出来的名字。
 *
 * 切换控件上的字不跟着当前语言变：一个只会读英文的人打开中文界面，要认得出
 * 「English」那一颗才点得下去。所以这两个名字不进语言包。
 */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  zh: '中文',
}

/**
 * 写进 `<html lang>` 的 BCP 47 标记。
 *
 * i18next 只管挑文案，不碰这个属性，所以这份映射留在我们手里。用 `zh-CN` 而不是
 * 光秃秃的 `zh`：字体和断词规则在简繁之间有差别，说清楚一点没坏处。
 */
export const HTML_LANG: Record<Language, string> = {
  en: 'en',
  zh: 'zh-CN',
}

/** 存语言的键，交给 detector 缓存用。只有这里读写它。 */
export const LANGUAGE_STORAGE_KEY = 'aquarium-language'

/**
 * 建一个配好的 i18next 实例。
 *
 * 不用模块级单例：交互测试要一条用例开一个（有的固定语言、有的走检测），共用一个
 * 的话前一条留下的语言会漏到后一条身上。线上由 main.tsx 建一个，一直用它。
 *
 * 给了 `lng` 就以它开局，没给才让 detector 去认（先看存过的，再问浏览器）。两种
 * 情况下 detector 都挂着，所以观众点了切换，选择照样被缓存下来。
 */
export function createI18n({ lng }: { lng?: Language } = {}) {
  const instance = i18next.createInstance()

  instance
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      detection: {
        caches: ['localStorage'],
        lookupLocalStorage: LANGUAGE_STORAGE_KEY,
        /**
         * 只认这两处，顺序也就这两步：观众自己选过的优先，其余跟浏览器。默认的
         * order 还含 querystring、cookie、htmlTag 等等，这只缸用不到——留着等于
         * 多几条没人测过的入口。
         */
        order: ['localStorage', 'navigator'],
      },
      fallbackLng: 'en',
      interpolation: {
        /** React 自己会转义，再转一遍会把文案里的引号变成实体。 */
        escapeValue: false,
      },
      /** `zh-CN`、`zh-Hans` 之类一律归到 `zh`；认不出的语言落到 fallbackLng。 */
      load: 'languageOnly',
      lng,
      resources: {
        en: { translation: en },
        zh: { translation: zh },
      },
      supportedLngs: LANGUAGES,
    })

  /**
   * 英文里鱼名在句中要小写（Add one blue tang），列表里又是句首大写（Blue tang）。
   * i18next 内置的 formatter 只有 currency / datetime / list / number /
   * relativetime，小写得自己加一条——加在这里，语言包里就能写
   * `{{label, lowercase}}`，哪种语言要不要小写由那份语言包自己说。
   */
  instance.services.formatter?.add('lowercase', (value) => String(value).toLowerCase())

  return instance
}

export type I18n = ReturnType<typeof createI18n>

/** 当前语言，收窄到我们支持的那两种。 */
export function languageOf(instance: { resolvedLanguage?: string; language: string }): Language {
  const resolved = instance.resolvedLanguage ?? instance.language
  return resolved.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

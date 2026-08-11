import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { LANGUAGES, LANGUAGE_NAMES, languageOf } from '../i18n'

/**
 * 切界面语言的那一小排按钮，蹲在左下角。
 *
 * 每颗按钮上的字是那种语言自己的写法（中文 / English），不跟着当前语言翻：只读
 * 英文的人打开中文界面时，得先认出「English」那一颗才点得下去。
 *
 * 做成两颗按钮而不是一个下拉：只有两种语言，摊开来一眼看得见当前是哪种、还能切到
 * 哪种，比点开一层再选省一步。当前那颗用 aria-pressed 标出来，屏幕阅读器会念。
 */
export function LanguagePicker() {
  const { i18n, t } = useTranslation()
  const current = languageOf(i18n)

  return (
    <div
      aria-label={t('languagePicker.label')}
      className="absolute bottom-9 left-12 z-10 flex gap-1 rounded-full border border-glass/24 bg-surface/54 p-1 backdrop-blur-md max-[720px]:bottom-4 max-[720px]:left-4"
      role="group"
    >
      {LANGUAGES.map((language) => {
        const chosen = language === current

        return (
          <Button
            aria-pressed={chosen}
            className={
              chosen
                ? 'size-auto rounded-full border-transparent bg-lagoon px-3 py-1 text-[0.76rem] tracking-[0.08em] text-abyss hover:bg-lagoon hover:text-abyss max-[720px]:min-h-11'
                : 'size-auto rounded-full border-transparent bg-transparent px-3 py-1 text-[0.76rem] tracking-[0.08em] text-mist shadow-none hover:bg-control-hover hover:text-ink max-[720px]:min-h-11'
            }
            key={language}
            onClick={() => void i18n.changeLanguage(language)}
            type="button"
          >
            {LANGUAGE_NAMES[language]}
          </Button>
        )
      })}
    </div>
  )
}

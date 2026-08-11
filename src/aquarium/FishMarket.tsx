import { MinusIcon, PlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { FISH_SPECIES } from './fishSpecies'
import type { FishSpeciesId } from './fishSpecies'
import { Panel, PanelHeading } from './Panel'

const SPECIES = Object.keys(FISH_SPECIES) as FishSpeciesId[]

export type FishMarketProps = {
  /** How many of each species are currently swimming. */
  counts: Readonly<Partial<Record<FishSpeciesId, number>>>
  /** The most fish this tank will hold. */
  capacity: number
  onAdd: (species: FishSpeciesId) => void
  onRemove: (species: FishSpeciesId) => void
}

/**
 * The panel a viewer stocks the tank from: one row per species, with the count
 * in the tank and a way to add or take one out.
 *
 * The buttons are disabled rather than hidden when they cannot act, so the rows
 * never reflow as a viewer clicks; each carries an aria-label naming the species
 * because the glyph alone says nothing to a screen reader.
 */
export function FishMarket({ capacity, counts, onAdd, onRemove }: FishMarketProps) {
  const { t } = useTranslation()
  const total = SPECIES.reduce((sum, species) => sum + (counts[species] ?? 0), 0)
  const full = total >= capacity

  return (
    /* 面板由自己那行小标题命名，理由同鱼缸尺寸那块，见 App.tsx。 */
    <Panel aria-labelledby="fish-market-label">
      <PanelHeading className="mb-2.5" id="fish-market-label">
        {t('market.heading')}
      </PanelHeading>

      <ul className="grid list-none gap-1.5">
        {SPECIES.map((species) => {
          const label = t(`fish.${species}`)
          const count = counts[species] ?? 0

          return (
            <li
              key={species}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-1.5"
            >
              <span className="text-[0.86rem] tracking-[0.04em]">{label}</span>
              <span
                aria-hidden="true"
                className="min-w-8 text-right text-[0.78rem] text-mist tabular-nums"
              >
                ×{count}
              </span>
              <Button
                aria-label={t('market.removeOne', { label })}
                className="size-6.5 border-input bg-control text-ink hover:border-lagoon/70 hover:bg-control-hover hover:text-ink"
                disabled={count === 0}
                onClick={() => onRemove(species)}
                type="button"
              >
                <MinusIcon />
              </Button>
              <Button
                aria-label={t('market.addOne', { label })}
                className="size-6.5 border-input bg-control text-ink hover:border-lagoon/70 hover:bg-control-hover hover:text-ink"
                disabled={full}
                onClick={() => onAdd(species)}
                type="button"
              >
                <PlusIcon />
              </Button>
            </li>
          )
        })}
      </ul>

      {/*
        A live region: adding a fish changes this text, and a screen reader
        announces it, which is the only feedback a non-visual viewer gets that
        the click landed.
      */}
      <p aria-live="polite" className="mt-3 text-[0.76rem] tracking-[0.06em] text-mist">
        {t('market.tally', { capacity, context: full ? 'full' : undefined, stocked: total })}
      </p>
    </Panel>
  )
}

import { MinusIcon, PlusIcon } from 'lucide-react'
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
  const total = SPECIES.reduce((sum, species) => sum + (counts[species] ?? 0), 0)
  const full = total >= capacity

  return (
    <Panel aria-label="鱼市">
      <PanelHeading className="mb-2.5">鱼市</PanelHeading>

      <ul className="grid list-none gap-1.5">
        {SPECIES.map((species) => {
          const { label } = FISH_SPECIES[species]
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
                aria-label={`少养一条${label}`}
                className="size-6.5 border-input bg-control text-ink hover:border-lagoon/70 hover:bg-control-hover hover:text-ink"
                disabled={count === 0}
                onClick={() => onRemove(species)}
                size="icon-xs"
                type="button"
                variant="outline"
              >
                <MinusIcon />
              </Button>
              <Button
                aria-label={`多养一条${label}`}
                className="size-6.5 border-input bg-control text-ink hover:border-lagoon/70 hover:bg-control-hover hover:text-ink"
                disabled={full}
                onClick={() => onAdd(species)}
                size="icon-xs"
                type="button"
                variant="outline"
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
        缸里 {total} 条 · 上限 {capacity} 条{full ? ' · 已养满' : ''}
      </p>
    </Panel>
  )
}

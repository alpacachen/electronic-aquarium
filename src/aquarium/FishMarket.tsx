import { FISH_SPECIES } from './fishSpecies'
import type { FishSpeciesId } from './fishSpecies'

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
    <section aria-label="鱼市" className="fish-market">
      <h2>鱼市</h2>

      <ul>
        {SPECIES.map((species) => {
          const { label } = FISH_SPECIES[species]
          const count = counts[species] ?? 0

          return (
            <li key={species}>
              <span className="fish-market__name">{label}</span>
              <span aria-hidden="true" className="fish-market__count">
                ×{count}
              </span>
              <button
                aria-label={`少养一条${label}`}
                disabled={count === 0}
                onClick={() => onRemove(species)}
                type="button"
              >
                −
              </button>
              <button
                aria-label={`多养一条${label}`}
                disabled={full}
                onClick={() => onAdd(species)}
                type="button"
              >
                +
              </button>
            </li>
          )
        })}
      </ul>

      {/*
        A live region: adding a fish changes this text, and a screen reader
        announces it, which is the only feedback a non-visual viewer gets that
        the click landed.
      */}
      <p aria-live="polite" className="fish-market__total">
        缸里 {total} 条 · 上限 {capacity} 条{full ? ' · 已养满' : ''}
      </p>
    </section>
  )
}

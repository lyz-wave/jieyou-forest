// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AnimalSprite, { ANIMAL_METAS, type AnimalSpecies } from './AnimalSprite'

const ALL_SPECIES: AnimalSpecies[] = [
  'fox',
  'owl',
  'bear',
  'deer',
  'hedgehog',
  'turtle',
  'raccoon',
  'bird',
]

describe('AnimalSprite Cut-Paper Component', () => {
  it('renders all 8 thinking animal species with correct metadata and svg graphics', () => {
    ALL_SPECIES.forEach((species) => {
      const { container } = render(<AnimalSprite species={species} />)
      const wrap = container.querySelector('.animal-sprite-wrap')
      expect(wrap).toBeTruthy()
      expect(wrap?.classList.contains(species)).toBe(true)
      expect(ANIMAL_METAS[species].name).toBeTruthy()
      expect(ANIMAL_METAS[species].title).toBeTruthy()
      // 验证具有对应剪纸色系类名
      const svg = container.querySelector('svg')
      expect(svg).toBeTruthy()
    })
  })

  it('renders speech bubble when speech text is provided', () => {
    render(
      <AnimalSprite
        species="fox"
        speech="嘿！换个角度试试看"
        speechTitle="灵狐 · 探索破局者"
        speaking={true}
      />,
    )
    expect(screen.getByText('嘿！换个角度试试看')).toBeTruthy()
    expect(screen.getByText('灵狐 · 探索破局者')).toBeTruthy()
  })

  it('triggers onClick handler when clicked', () => {
    const handleClick = vi.fn()
    const { container } = render(
      <AnimalSprite species="bear" onClick={handleClick} />,
    )
    const wrap = container.querySelector('.animal-sprite-wrap')
    expect(wrap).toBeTruthy()
    fireEvent.click(wrap!)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('applies directional horizontal flip when direction=-1', () => {
    const { container } = render(
      <AnimalSprite species="deer" direction={-1} />,
    )
    const svg = container.querySelector('svg')
    expect(svg?.style.transform).toContain('scaleX(-1)')
  })
})

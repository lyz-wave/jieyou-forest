// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PaperForest from './PaperForest'

describe('PaperForest Day/Night toggle', () => {
  it('toggles body.pf-night, pf-stage.pf-night, and button state on click', () => {
    const { container } = render(<PaperForest />)
    const toggleBtn = screen.getByRole('button', { name: /静夜/ })
    const stage = container.querySelector('.pf-stage')
    expect(toggleBtn).toBeDefined()
    expect(stage).toBeDefined()
    expect(document.body.classList.contains('pf-night')).toBe(false)
    expect(stage?.classList.contains('pf-night')).toBe(false)

    // 点击切换为静夜
    fireEvent.click(toggleBtn)
    expect(document.body.classList.contains('pf-night')).toBe(true)
    expect(stage?.classList.contains('pf-night')).toBe(true)
    expect(toggleBtn.getAttribute('aria-pressed')).toBe('true')

    // 再次点击切回白昼
    fireEvent.click(toggleBtn)
    expect(document.body.classList.contains('pf-night')).toBe(false)
    expect(stage?.classList.contains('pf-night')).toBe(false)
    expect(toggleBtn.getAttribute('aria-pressed')).toBe('false')
  })
})

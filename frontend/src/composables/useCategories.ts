import { useStore } from './useStore'

const BADGE_COLORS: Record<string, { bg: string; fg: string }> = {
  blue:   { bg: '#dbeafe', fg: '#1d4ed8' },
  green:  { bg: '#d1fae5', fg: '#065f46' },
  amber:  { bg: '#fef3c7', fg: '#92400e' },
  gray:   { bg: '#f3f4f6', fg: '#6b7280' },
  red:    { bg: '#fee2e2', fg: '#991b1b' },
  purple: { bg: '#ede9fe', fg: '#5b21b6' },
  pink:   { bg: '#fce7f3', fg: '#9d174d' },
  teal:   { bg: '#ccfbf1', fg: '#115e59' },
}

export function useCategories() {
  const { db } = useStore()

  function getCatColor(catName: string) {
    const cat = (db.categories || []).find(c => c.name === catName)
    const colorId = cat?.color || 'gray'
    return BADGE_COLORS[colorId] || BADGE_COLORS.gray
  }

  function catStyle(catName: string) {
    const c = getCatColor(catName)
    return { background: c.bg, color: c.fg }
  }

  return { getCatColor, catStyle }
}

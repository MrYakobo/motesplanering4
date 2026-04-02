// Shared stub factory for views not yet migrated
import { defineComponent, h } from 'vue'

export function stubView(name: string) {
  return defineComponent({
    name,
    render() {
      return h('div', { class: 'flex-1 flex items-center justify-center text-gray-400 text-sm' },
        `${name} — inte migrerad ännu`)
    },
  })
}

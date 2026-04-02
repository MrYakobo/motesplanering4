<script setup lang="ts" generic="T extends { id: number }">
import { Ellipsis } from 'lucide-vue-next'

export interface Column<T> {
  key: string
  label: string
  render?: (row: T) => string
}

defineProps<{
  columns: Column<T>[]
  rows: T[]
  selectedId?: number | null
}>()

const emit = defineEmits<{
  select: [id: number]
  contextMenu: [event: MouseEvent, id: number]
}>()
</script>

<template>
  <div class="flex-1 overflow-auto">
    <table class="w-full border-collapse">
      <thead>
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            class="sticky top-0 z-[3] bg-gray-50 border-b-2 border-gray-200 px-3.5 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
          >
            {{ col.label }}
          </th>
          <th class="sticky top-0 z-[3] bg-gray-50 border-b-2 border-gray-200 w-10" />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.id"
          @click="emit('select', row.id)"
          class="border-b border-gray-200 cursor-pointer transition-colors hover:bg-accent-light group"
          :class="{ 'bg-indigo-50/50': selectedId === row.id }"
        >
          <td
            v-for="col in columns"
            :key="col.key"
            class="px-3.5 py-2.5 text-sm"
            v-html="col.render ? col.render(row) : (row as any)[col.key] ?? '—'"
          />
          <td class="w-10 text-center px-1">
            <button
              @click.stop="emit('contextMenu', $event, row.id)"
              class="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
            >
              <Ellipsis :size="16" />
            </button>
          </td>
        </tr>
        <tr v-if="rows.length === 0">
          <td :colspan="columns.length + 1" class="py-6 text-center text-gray-400 text-sm">
            Inga resultat
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

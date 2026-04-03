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
            class="skeu-th"
          >
            {{ col.label }}
          </th>
          <th class="skeu-th w-10" />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.id"
          @click="emit('select', row.id)"
          class="skeu-row group"
          :class="{ 'skeu-row-selected': selectedId === row.id }"
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
              class="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-all"
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

<style scoped>
.skeu-th {
  position: sticky;
  top: 0;
  z-index: 3;
  padding: 7px 14px;
  text-align: left;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
  color: #666;
  background: linear-gradient(180deg, #eee 0%, #ddd 100%);
  border-bottom: 1px solid #bbb;
  box-shadow: 0 1px 0 rgba(255,255,255,.5) inset;
  text-shadow: 0 1px 0 rgba(255,255,255,.7);
}
.skeu-row {
  cursor: pointer;
  transition: background 0.1s ease;
  border-bottom: 1px solid #d8d8d8;
  background: linear-gradient(180deg, #f8f8f8 0%, #f0f0f0 100%);
}
.skeu-row:hover {
  background: linear-gradient(180deg, #fff 0%, #f4f4f4 100%);
}
.skeu-row-selected {
  background: linear-gradient(180deg, #e8e0ff 0%, #ddd5f8 100%) !important;
}
</style>

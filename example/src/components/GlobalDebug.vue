<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { debugStores, listStores, disposeAllStores } from 'vue-light-store'
import { useUserStore } from '@/stores/userStore'
import { useCartStore } from '@/stores/cartStore'

const debugInfo = ref(debugStores())
const autoRefresh = ref(true)
let intervalId: number | null = null

useUserStore()
useCartStore()

function refresh() {
  debugInfo.value = debugStores()
}

onMounted(() => {
  intervalId = window.setInterval(() => {
    if (autoRefresh.value) {
      refresh()
    }
  }, 500)
})

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId)
  }
})

function handleDisposeAll() {
  if (confirm('确定要销毁所有 store 吗？')) {
    disposeAllStores()
    refresh()
  }
}
</script>

<template>
  <div class="card" style="grid-column: 1 / -1;">
    <h2>🔍 全局调试面板</h2>

    <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 16px;">
      <button @click="refresh">手动刷新</button>
      <label style="display: flex; align-items: center; gap: 4px; color: white;">
        <input type="checkbox" v-model="autoRefresh" />
        自动刷新 (500ms)
      </label>
      <button @click="handleDisposeAll" style="background: #e53935;">销毁所有 Store</button>
      <span style="color: white;">已注册 Store: {{ listStores().join(', ') }}</span>
    </div>

    <div class="state-display">
      <span>总 Store 数: {{ debugInfo.totalStores }}</span>
      <span>总订阅者: {{ debugInfo.totalSubscribers }}</span>
      <span>总 Action 订阅者: {{ debugInfo.totalActionSubscribers }}</span>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 16px;">
      <div v-for="(store, name) in debugInfo.stores" :key="name" class="debug-section">
        <h3>Store: {{ name }}</h3>
        <div style="margin-bottom: 8px;">
          <span style="color: #00ff88;">状态:</span>
          <span :style="{ color: store.isDisposed ? '#ff6b6b' : '#00ff88' }">
            {{ store.isDisposed ? '已销毁' : '运行中' }}
          </span>
          <span style="color: #888; margin-left: 16px;">
            订阅者: {{ store.subscriberCount }} |
            Action 订阅者: {{ store.actionSubscriberCount }}
          </span>
        </div>
        <pre>{{ JSON.stringify(store, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

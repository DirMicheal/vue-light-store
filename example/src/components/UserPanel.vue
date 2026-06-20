<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '@/stores/userStore'
import type { MutationInfo } from 'vue-light-store'

const userStore = useUserStore()

const loginForm = reactive({
  username: '',
  password: ''
})

const isLoggingIn = ref(false)
const mutations = ref<MutationInfo<any>[]>([])
const actions: { name: string; args: any[]; timestamp: number }[] = reactive([])

let unsubscribeMutation: (() => void) | null = null
let unsubscribeAction: (() => void) | null = null

onMounted(() => {
  unsubscribeMutation = userStore.$subscribe((mutation) => {
    mutations.value.unshift(mutation)
    if (mutations.value.length > 10) mutations.value.pop()
  })

  unsubscribeAction = userStore.$onAction((info) => {
    const entry = {
      name: info.name,
      args: [...info.args],
      timestamp: Date.now()
    }
    actions.unshift(entry)
    if (actions.length > 10) actions.pop()

    info.after?.(() => {
      entry.args.push('completed')
    })
  })
})

onUnmounted(() => {
  unsubscribeMutation?.()
  unsubscribeAction?.()
})

async function handleLogin() {
  isLoggingIn.value = true
  try {
    const success = await userStore.login(loginForm.username, loginForm.password)
    if (success) {
      loginForm.username = ''
      loginForm.password = ''
    }
  } finally {
    isLoggingIn.value = false
  }
}

function handleLogout() {
  userStore.logout()
}

function tryDirectModify() {
  try {
    ;(userStore as any).username = 'Hacked!'
    alert('修改成功！这是不应该发生的！')
  } catch (e: any) {
    alert(`状态保护生效！\n\n错误信息: ${e.message}`)
  }
}
</script>

<template>
  <div class="card">
    <h2>👤 用户模块</h2>

    <div v-if="userStore.isLoggedIn" class="state-display">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
        <img :src="userStore.avatar" :alt="userStore.displayName" style="width: 48px; height: 48px; border-radius: 50%;" />
        <div>
          <div style="font-weight: bold;">{{ userStore.displayName }}</div>
          <div style="font-size: 0.85rem; color: #666;">{{ userStore.email }}</div>
        </div>
      </div>
      <span>ID: {{ userStore.id }}</span>
      <span>显示名: {{ userStore.displayName }}</span>
      <span>缩写: {{ userStore.initials }}</span>
    </div>

    <div v-else class="state-display">
      <span>状态: 未登录</span>
      <span>显示名: {{ userStore.displayName }}</span>
    </div>

    <h3>操作</h3>
    <div v-if="!userStore.isLoggedIn">
      <input
        v-model="loginForm.username"
        type="text"
        placeholder="用户名"
      />
      <input
        v-model="loginForm.password"
        type="text"
        placeholder="密码（任意）"
      />
      <button @click="handleLogin" :disabled="isLoggingIn || !loginForm.username || !loginForm.password">
        {{ isLoggingIn ? '登录中...' : '登录' }}
      </button>
    </div>
    <div v-else>
      <button @click="handleLogout">退出登录</button>
    </div>

    <h3>测试状态保护</h3>
    <button @click="tryDirectModify">尝试直接修改 state</button>

    <h3>最近变更 ({{ mutations.length }})</h3>
    <div class="mutation-log">
      <div v-for="(m, i) in mutations" :key="i">
        [{{ new Date(m.timestamp).toLocaleTimeString() }}] {{ m.type }}: {{ m.path || m.actionName || '-' }}
      </div>
      <div v-if="mutations.length === 0" style="color: #999;">暂无变更</div>
    </div>

    <h3>最近 Action ({{ actions.length }})</h3>
    <div class="mutation-log">
      <div v-for="(a, i) in actions" :key="i">
        [{{ new Date(a.timestamp).toLocaleTimeString() }}] {{ a.name }}({{ a.args.join(', ') }})
      </div>
      <div v-if="actions.length === 0" style="color: #999;">暂无 Action</div>
    </div>

    <div class="debug-section">
      <h3>$debug() 输出</h3>
      <pre>{{ JSON.stringify(userStore.$debug(), null, 2) }}</pre>
    </div>
  </div>
</template>

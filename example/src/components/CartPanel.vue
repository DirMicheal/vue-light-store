<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useCartStore, sampleProducts } from '@/stores/cartStore'
import { useUserStore } from '@/stores/userStore'

const cartStore = useCartStore()
const userStore = useUserStore()

const couponCode = ref('')
const couponMessage = ref('')
const isCheckingOut = ref(false)
const checkoutResult = reactive<{ success: boolean; message: string } | null>(null)

const itemsList = computed(() => cartStore.items)

function addProduct(product: typeof sampleProducts[0]) {
  cartStore.addItem(product)
  checkoutResult = null
}

function applyCoupon() {
  const success = cartStore.applyCoupon(couponCode.value.toUpperCase())
  if (success) {
    couponMessage.value = `✅ 优惠券 "${couponCode.value.toUpperCase()}" 已应用！`
  } else {
    couponMessage.value = `❌ 无效的优惠券代码`
  }
  setTimeout(() => {
    couponMessage.value = ''
  }, 3000)
}

async function handleCheckout() {
  isCheckingOut.value = true
  checkoutResult = null
  try {
    const result = await cartStore.checkout()
    checkoutResult = {
      success: result.success,
      message: result.message || ''
    }
    if (result.success) {
      cartStore.clearCart()
    }
  } finally {
    isCheckingOut.value = false
  }
}

function resetCart() {
  cartStore.$reset()
  checkoutResult = null
}
</script>

<template>
  <div class="card">
    <h2>🛒 购物车模块 (跨模块调用示例)</h2>

    <div class="state-display">
      <span>商品数: {{ cartStore.totalItems }}</span>
      <span>小计: ¥{{ cartStore.subtotal }}</span>
      <span v-if="cartStore.discount > 0">折扣: {{ (cartStore.discount * 100).toFixed(0) }}%</span>
      <span style="font-weight: bold; background: #e8f5e9; color: #2e7d32;">
        总计: ¥{{ cartStore.total }}
      </span>
      <span v-if="cartStore.coupon">优惠券: {{ cartStore.coupon }}</span>
    </div>

    <h3>商品列表</h3>
    <div v-if="itemsList.length === 0" style="color: #999; padding: 12px 0;">
      购物车是空的
    </div>
    <div v-else style="max-height: 200px; overflow-y: auto;">
      <div
        v-for="item in itemsList"
        :key="item.id"
        style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #eee;"
      >
        <div>
          <span style="font-size: 1.5rem; margin-right: 8px;">{{ item.image }}</span>
          <strong>{{ item.name }}</strong>
          <div style="font-size: 0.85rem; color: #666;">
            ¥{{ item.price }} × {{ item.quantity }}
          </div>
        </div>
        <div>
          <button @click="cartStore.updateQuantity(item.id, item.quantity - 1)" style="padding: 4px 8px;">-</button>
          <span style="padding: 0 8px;">{{ item.quantity }}</span>
          <button @click="cartStore.updateQuantity(item.id, item.quantity + 1)" style="padding: 4px 8px;">+</button>
          <button @click="cartStore.removeItem(item.id)" style="padding: 4px 8px; background: #e53935;">×</button>
        </div>
      </div>
    </div>

    <h3>添加商品</h3>
    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
      <button
        v-for="product in sampleProducts"
        :key="product.id"
        @click="addProduct(product)"
        style="font-size: 0.8rem; padding: 6px 12px;"
      >
        {{ product.image }} {{ product.name }} ¥{{ product.price }}
      </button>
    </div>

    <h3>优惠券</h3>
    <input v-model="couponCode" type="text" placeholder="输入优惠码 (SAVE10 / SAVE20)" />
    <button @click="applyCoupon">应用</button>
    <div v-if="couponMessage" :class="couponMessage.includes('✅') ? 'success' : 'error'" style="margin-top: 8px;">
      {{ couponMessage }}
    </div>

    <h3>结账 (需要登录)</h3>
    <div v-if="!userStore.isLoggedIn" class="error">
      ⚠️ 请先在用户模块登录后再结账
    </div>
    <div v-else class="success">
      ✅ 已登录为 {{ userStore.displayName }}，可以结账
    </div>

    <button
      @click="handleCheckout"
      :disabled="isCheckingOut || !cartStore.hasItems || !userStore.isLoggedIn"
    >
      {{ isCheckingOut ? '处理中...' : '立即结账' }}
    </button>
    <button @click="resetCart">重置购物车</button>

    <div v-if="checkoutResult" :class="checkoutResult.success ? 'success' : 'error'">
      {{ checkoutResult.message }}
    </div>

    <div class="debug-section">
      <h3>$debug() 输出</h3>
      <pre>{{ JSON.stringify(cartStore.$debug(), null, 2) }}</pre>
    </div>
  </div>
</template>

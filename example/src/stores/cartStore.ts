import { defineStore, getStore } from 'vue-light-store'
import type { PublicStore } from 'vue-light-store'
import type { useUserStore } from './userStore'

interface CartItem {
  id: number
  name: string
  price: number
  quantity: number
  image: string
}

interface CartState {
  items: CartItem[]
  coupon: string | null
}

interface CartGetters {
  totalItems: (state: CartState) => number
  subtotal: (state: CartState) => number
  discount: (state: CartState) => number
  total: (state: CartState, getters: any) => number
  hasItems: (state: CartState) => boolean
}

interface CartActions {
  addItem: (item: Omit<CartItem, 'quantity'>) => void
  removeItem: (id: number) => void
  updateQuantity: (id: number, quantity: number) => void
  clearCart: () => void
  applyCoupon: (code: string) => boolean
  checkout: () => Promise<{ success: boolean; orderId?: string; message?: string }>
}

type UserStoreType = ReturnType<typeof useUserStore> extends PublicStore<infer S, infer G, infer A>
  ? PublicStore<S, G, A>
  : never

export const useCartStore = defineStore<CartState, CartGetters, CartActions>({
  name: 'cart',
  state: () => ({
    items: [],
    coupon: null
  }),
  getters: {
    totalItems: (state) => state.items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: (state) => state.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    discount: (state) => {
      if (state.coupon === 'SAVE10') return 0.1
      if (state.coupon === 'SAVE20') return 0.2
      return 0
    },
    total: (state, getters) => {
      const subtotal = getters.subtotal
      const discount = getters.discount
      return Math.round((subtotal * (1 - discount)) * 100) / 100
    },
    hasItems: (state) => state.items.length > 0
  },
  actions: {
    addItem(item) {
      const existingItem = this.$state.items.find(i => i.id === item.id)
      if (existingItem) {
        existingItem.quantity++
      } else {
        this.$state.items.push({ ...item, quantity: 1 })
      }
    },
    removeItem(id) {
      const index = this.$state.items.findIndex(i => i.id === id)
      if (index > -1) {
        this.$state.items.splice(index, 1)
      }
    },
    updateQuantity(id, quantity) {
      const item = this.$state.items.find(i => i.id === id)
      if (item) {
        if (quantity <= 0) {
          this.$actions.removeItem(id)
        } else {
          item.quantity = quantity
        }
      }
    },
    clearCart() {
      this.$state.items = []
      this.$state.coupon = null
    },
    applyCoupon(code) {
      const validCoupons = ['SAVE10', 'SAVE20']
      if (validCoupons.includes(code)) {
        this.$state.coupon = code
        return true
      }
      return false
    },
    async checkout() {
      const userStore = getStore<UserStoreType>('user')

      if (!userStore?.isLoggedIn) {
        return {
          success: false,
          message: '请先登录后再结账'
        }
      }

      if (!this.$getters.hasItems) {
        return {
          success: false,
          message: '购物车是空的'
        }
      }

      await new Promise(resolve => setTimeout(resolve, 800))

      const orderId = 'ORD-' + Date.now()

      return {
        success: true,
        orderId,
        message: `订单 ${orderId} 创建成功！总价: ¥${this.$getters.total}`
      }
    }
  }
})

export const sampleProducts = [
  { id: 1, name: '无线蓝牙耳机', price: 299, image: '🎧' },
  { id: 2, name: '机械键盘', price: 459, image: '⌨️' },
  { id: 3, name: '游戏鼠标', price: 199, image: '🖱️' },
  { id: 4, name: '4K显示器', price: 2999, image: '🖥️' },
  { id: 5, name: '笔记本电脑', price: 7999, image: '💻' },
  { id: 6, name: '智能手表', price: 1299, image: '⌚' }
]

import { defineStore } from 'vue-light-store'

interface UserState {
  id: number
  username: string
  email: string
  avatar: string
  isLoggedIn: boolean
}

interface UserGetters {
  displayName: (state: UserState) => string
  initials: (state: UserState) => string
}

interface UserActions {
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  updateEmail: (email: string) => void
  updateUsername: (username: string) => void
}

export const useUserStore = defineStore<UserState, UserGetters, UserActions>({
  name: 'user',
  state: () => ({
    id: 0,
    username: '',
    email: '',
    avatar: '',
    isLoggedIn: false
  }),
  getters: {
    displayName: (state) => state.isLoggedIn ? state.username : 'Guest',
    initials: (state) => state.username
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
  },
  actions: {
    async login(username: string, password: string) {
      await new Promise(resolve => setTimeout(resolve, 500))

      if (username && password) {
        this.$state.id = Date.now()
        this.$state.username = username
        this.$state.email = `${username.toLowerCase()}@example.com`
        this.$state.avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
        this.$state.isLoggedIn = true
        return true
      }
      return false
    },
    logout() {
      this.$state.id = 0
      this.$state.username = ''
      this.$state.email = ''
      this.$state.avatar = ''
      this.$state.isLoggedIn = false
    },
    updateEmail(email: string) {
      this.$state.email = email
    },
    updateUsername(username: string) {
      this.$state.username = username
    }
  }
})

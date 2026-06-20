<script setup lang="ts">
import UserPanel from './components/UserPanel.vue'
import CartPanel from './components/CartPanel.vue'
import GlobalDebug from './components/GlobalDebug.vue'
</script>

<template>
  <div>
    <div class="header">
      <h1>✨ Vue Light Store</h1>
      <p>轻量级 · TypeScript 友好 · 可观测 · 跨模块调用 · 状态保护</p>
    </div>

    <div class="container">
      <UserPanel />
      <CartPanel />
      <GlobalDebug />
    </div>
  </div>
</template>

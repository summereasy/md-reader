<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { storage } from '@/shared/storage'
import { getDefaultData, MD_PLUGINS } from '@/shared/types'
import type { StorageData, MdPlugin, Theme } from '@/shared/types'
import {
  Switch as TSwitch,
  Select as TSelect,
  Option as TOption,
} from 'tdesign-vue-next'

const data = ref<StorageData>(getDefaultData())
const isFileAccess = ref(true)
const loading = ref(true)

const languages = [
  { value: 'en', label: 'English' },
  { value: 'zh_CN', label: '简体中文' },
  { value: 'zh_TW', label: '繁體中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'uk', label: 'Українська' },
]

const themes: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto' },
]

onMounted(async () => {
  try {
    const saved = await storage.get()
    data.value = getDefaultData(saved)
  } catch {
    // ignore
  }
  // Check file access
  chrome.extension.isAllowedFileSchemeAccess((allowed: boolean) => {
    isFileAccess.value = !!allowed
  })
  loading.value = false
})

function updateStorage(key: keyof StorageData, value: unknown): void {
  chrome.runtime.sendMessage({
    action: 'storage',
    data: { key, value },
  })
}

function openOptions(): void {
  chrome.runtime.openOptionsPage?.()
}

function openGitHub(): void {
  chrome.tabs.create({ url: 'https://github.com/summereasy/md-reader' })
}

function togglePlugin(plugin: MdPlugin): void {
  const plugins = data.value.mdPlugins || []
  if (plugins.includes(plugin)) {
    data.value.mdPlugins = plugins.filter((p) => p !== plugin)
  } else {
    data.value.mdPlugins = [...plugins, plugin]
  }
  updateStorage('mdPlugins', data.value.mdPlugins)
}

watch(
  () => data.value.pageTheme,
  (v) => updateStorage('pageTheme', v),
)
watch(
  () => data.value.language,
  (v) => {
    if (v) updateStorage('language', v)
  },
)
</script>

<template>
  <main class="popup" v-if="!loading" :data-disabled="!data.enable">
    <header class="popup__header">
      <div class="popup__brand">
        <img src="../assets/logo-stroke.png" alt="" class="popup__logo">
        <div>
          <h1>md-viewer</h1>
          <p>Open-source Markdown viewer</p>
        </div>
      </div>
      <button type="button" class="popup__link" @click="openGitHub">GitHub</button>
    </header>

    <div v-if="!isFileAccess" class="popup__warning">
      Enable "Allow access to file URLs" in extension settings to preview local markdown files.
    </div>

    <section class="popup__section popup__section--toggles">
      <label class="popup__row">
        <span>
          <strong>Enable</strong>
          <small>Turn markdown preview on or off</small>
        </span>
        <TSwitch
          v-model="data.enable"
          @change="(v: boolean | string | number) => updateStorage('enable', v as boolean)"
          size="small"
        />
      </label>

      <label class="popup__row">
        <span>
          <strong>Centered</strong>
          <small>Use a focused reading width</small>
        </span>
        <TSwitch
          v-model="data.centered"
          :disabled="!data.enable"
          @change="(v: boolean | string | number) => updateStorage('centered', v as boolean)"
          size="small"
        />
      </label>

      <label class="popup__row">
        <span>
          <strong>Auto Refresh</strong>
          <small>Reload when the source file changes</small>
        </span>
        <TSwitch
          v-model="data.refresh"
          :disabled="!data.enable"
          @change="(v: boolean | string | number) => updateStorage('refresh', v as boolean)"
          size="small"
        />
      </label>
    </section>

    <section class="popup__section">
      <div class="popup__section-head">
        <span>Plugins</span>
        <small>{{ data.mdPlugins?.length || 0 }}/{{ MD_PLUGINS.length }}</small>
      </div>
      <div class="popup__chips">
        <button
          v-for="p in MD_PLUGINS"
          :key="p"
          type="button"
          :class="['popup__chip', data.mdPlugins?.includes(p) && 'popup__chip--active']"
          :disabled="!data.enable"
          @click="togglePlugin(p)"
        >
          {{ p }}
        </button>
      </div>
    </section>

    <section class="popup__section">
      <div class="popup__section-head">
        <span>Theme</span>
      </div>
      <div class="popup__theme-group" :aria-disabled="!data.enable">
        <button
          v-for="t in themes"
          :key="t.value"
          type="button"
          :class="['popup__theme', data.pageTheme === t.value && 'popup__theme--active']"
          :disabled="!data.enable"
          @click="data.pageTheme = t.value"
        >
          {{ t.label }}
        </button>
      </div>
    </section>

    <section class="popup__section">
      <label class="popup__select-label">Language</label>
        <TSelect
          v-model="data.language"
          :disabled="!data.enable"
          size="small"
          class="popup__select"
        >
          <TOption v-for="l in languages" :key="l.value" :value="l.value" :label="l.label" />
        </TSelect>
    </section>

    <footer class="popup__footer">
      <button type="button" class="popup__settings" @click="openOptions">
        Full Settings
      </button>
      <span>v1.0.0</span>
    </footer>
  </main>
</template>

<style scoped>
:global(body) {
  margin: 0;
  background: #fff;
}

.popup {
  box-sizing: border-box;
  width: 340px;
  max-height: 599px;
  overflow: auto;
  padding: 22px 24px 14px;
  border: 1px solid rgba(36, 49, 88, 0.34);
  color: #243158;
  background: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
}

.popup[data-disabled='true'] {
  color: rgba(36, 49, 88, 0.58);
}

.popup__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 20px;
}

.popup__brand {
  display: flex;
  align-items: center;
  min-width: 0;
}

.popup__logo {
  flex: 0 0 24px;
  width: 24px;
  height: 24px;
  margin-right: 8px;
}

.popup h1 {
  margin: 0;
  color: #35363a;
  font-size: 18px;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: 0;
}

.popup__brand p {
  margin: 3px 0 0;
  color: rgba(36, 49, 88, 0.54);
  font-size: 11px;
  line-height: 1.2;
}

.popup__link {
  padding: 3px 0;
  border: 0;
  color: #607cd2;
  background: transparent;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.popup__link:hover {
  color: #4c68bb;
  text-decoration: underline;
}

.popup__warning {
  padding: 8px 10px;
  margin: -8px 0 15px;
  border: 1px solid currentColor;
  border-radius: 4px;
  color: #e24a3f;
  background: #fff1f0;
  font-size: 12px;
  line-height: 1.35;
}

.popup__section {
  padding: 0 0 16px;
  margin: 0 0 14px;
  border-bottom: 1px solid rgba(36, 49, 88, 0.1);
}

.popup__section--toggles {
  padding-bottom: 6px;
}

.popup__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 42px;
  margin-bottom: 8px;
}

.popup__row span {
  display: block;
  flex: 1 1 auto;
  min-width: 0;
}

.popup__row strong,
.popup__section-head,
.popup__select-label {
  color: rgba(36, 49, 88, 0.9);
  font-size: 13px;
  font-weight: 800;
  line-height: 1.2;
}

.popup__row small {
  display: block;
  margin-top: 3px;
  color: rgba(36, 49, 88, 0.48);
  font-size: 11px;
  line-height: 1.25;
}

.popup__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 9px;
}

.popup__section-head small {
  color: rgba(36, 49, 88, 0.46);
  font-size: 11px;
  font-weight: 700;
}

.popup__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.popup__chip {
  min-height: 27px;
  max-width: 100%;
  padding: 0 11px;
  border: 1px solid rgba(36, 49, 88, 0.13);
  border-radius: 999px;
  color: rgba(36, 49, 88, 0.66);
  background: rgba(36, 49, 88, 0.045);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s, opacity 0.12s;
}

.popup__chip:hover:not(:disabled) {
  border-color: rgba(96, 124, 210, 0.45);
  color: #607cd2;
}

.popup__chip--active {
  border-color: transparent;
  color: #fff;
  background: #607cd2;
}

.popup__chip:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.popup__theme-group {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 4px;
  border: 1px solid rgba(36, 49, 88, 0.13);
  border-radius: 16px;
  background: rgba(36, 49, 88, 0.045);
}

.popup__theme-group[aria-disabled='true'] {
  opacity: 0.48;
}

.popup__theme {
  height: 32px;
  border: 0;
  border-radius: 12px;
  color: rgba(36, 49, 88, 0.62);
  background: transparent;
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.popup__theme:hover:not(:disabled),
.popup__theme--active {
  color: #607cd2;
}

.popup__theme--active {
  background: #fff;
  box-shadow: 0 8px 22px rgba(30, 41, 59, 0.09),
    inset 0 0 0 1px rgba(36, 49, 88, 0.08);
}

.popup__theme:disabled {
  cursor: not-allowed;
}

.popup__select-label {
  display: block;
  margin-bottom: 8px;
}

.popup__select {
  width: 100%;
}

.popup__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 2px;
}

.popup__settings {
  height: 32px;
  padding: 0 13px;
  border: 1px solid rgba(96, 124, 210, 0.35);
  border-radius: 8px;
  color: #607cd2;
  background: rgba(96, 124, 210, 0.08);
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.popup__settings:hover {
  border-color: rgba(96, 124, 210, 0.55);
  background: rgba(96, 124, 210, 0.12);
}

.popup__footer span {
  color: rgba(36, 49, 88, 0.42);
  font-size: 11px;
  font-weight: 700;
}

:deep(.t-switch.t-is-checked) {
  background: #607cd2;
}

:deep(.t-switch) {
  position: relative;
  flex: 0 0 36px;
  width: 36px;
  min-width: 36px;
  height: 20px;
  border-radius: 999px;
  background: rgba(36, 49, 88, 0.2);
}

:deep(.t-switch)::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.24);
  transition: transform 0.16s;
}

:deep(.t-switch.t-is-checked)::after {
  transform: translateX(16px);
}

:deep(.t-switch__handle) {
  position: absolute;
  display: block;
  top: 2px;
  left: 2px;
  z-index: 1;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.24);
  transition: transform 0.16s;
}

:deep(.t-switch.t-is-checked .t-switch__handle) {
  transform: translateX(16px);
}

:deep(.t-switch.t-is-disabled) {
  opacity: 0.42;
}

:deep(.t-select__wrap) {
  width: 100%;
}

:deep(.t-input) {
  border-radius: 8px;
  border-color: rgba(36, 49, 88, 0.16);
  box-shadow: none;
}

:deep(.t-input:hover),
:deep(.t-input.t-is-focused) {
  border-color: rgba(96, 124, 210, 0.45);
  box-shadow: none;
}
</style>

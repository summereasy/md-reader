<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { storage } from '@/shared/storage'
import { getDefaultData, MD_PLUGINS } from '@/shared/types'
import type { StorageData, MdPlugin, Theme } from '@/shared/types'
import {
  Switch as TSwitch,
  Radio as TRadio,
  RadioGroup as TRadioGroup,
  Select as TSelect,
  Option as TOption,
  Tag as TTag,
  Space as TSpace,
  Divider as TDivider,
  Button as TButton,
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
  <div class="popup p-5" v-if="!loading">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-lg font-bold m-0">Markdown Reader</h2>
        <p class="text-xs text-gray-400 m-0 mt-0.5">v3.0.0</p>
      </div>
      <a
        href="https://github.com/summereasy/md-reader"
        target="_blank"
        class="text-xs text-blue-500 no-underline hover:underline"
      >
        GitHub
      </a>
    </div>

    <!-- File access warning -->
    <div
      v-if="!isFileAccess"
      class="bg-yellow-50 border border-yellow-200 rounded p-2 mb-3 text-xs text-yellow-800"
    >
      ⚠️ Enable "Allow access to file URLs" in extension settings to preview local markdown files.
    </div>

    <TSpace direction="vertical" size="small" class="w-full">
      <!-- Enable -->
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">Enable</span>
        <TSwitch
          v-model="data.enable"
          @change="(v: boolean | string | number) => updateStorage('enable', v as boolean)"
          size="small"
        />
      </div>

      <!-- Centered -->
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">Centered</span>
        <TSwitch
          v-model="data.centered"
          :disabled="!data.enable"
          @change="(v: boolean | string | number) => updateStorage('centered', v as boolean)"
          size="small"
        />
      </div>

      <!-- Auto Refresh -->
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">Auto Refresh</span>
        <TSwitch
          v-model="data.refresh"
          :disabled="!data.enable"
          @change="(v: boolean | string | number) => updateStorage('refresh', v as boolean)"
          size="small"
        />
      </div>

      <TDivider class="!my-1" />

      <!-- Theme -->
      <div>
        <span class="text-sm font-medium block mb-1">Theme</span>
        <TRadioGroup v-model="data.pageTheme" :disabled="!data.enable" size="small">
          <TRadio v-for="t in themes" :key="t.value" :value="t.value">
            {{ t.label }}
          </TRadio>
        </TRadioGroup>
      </div>

      <TDivider class="!my-1" />

      <!-- Language -->
      <div>
        <span class="text-sm font-medium block mb-1">Language</span>
        <TSelect
          v-model="data.language"
          :disabled="!data.enable"
          size="small"
          class="w-full"
        >
          <TOption v-for="l in languages" :key="l.value" :value="l.value" :label="l.label" />
        </TSelect>
      </div>

      <TDivider class="!my-1" />

      <!-- Plugins -->
      <div>
        <span class="text-sm font-medium block mb-1">Plugins</span>
        <div class="flex flex-wrap gap-1.5">
          <TTag
            v-for="p in MD_PLUGINS"
            :key="p"
            :theme="data.mdPlugins?.includes(p) ? 'primary' : 'default'"
            :class="['cursor-pointer', !data.enable && 'opacity-50 pointer-events-none']"
            @click="data.enable && togglePlugin(p)"
            size="small"
          >
            {{ p }}
          </TTag>
        </div>
      </div>

      <TDivider class="!my-1" />

      <!-- Open options -->
      <TButton
        block
        variant="outline"
        size="small"
        @click="openOptions"
      >
        Full Settings
      </TButton>
    </TSpace>
  </div>
</template>

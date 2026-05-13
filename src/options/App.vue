<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { storage } from '@/shared/storage'
import { getDefaultData, MD_PLUGINS, FONT_SIZE_MAP, LIGHT_THEMES, DARK_THEMES } from '@/shared/types'
import type { StorageData, MdPlugin, ColorMode, LightTheme, DarkTheme, FontSize } from '@/shared/types'
import {
  Card as TCard,
  Switch as TSwitch,
  Radio as TRadio,
  RadioGroup as TRadioGroup,
  Select as TSelect,
  Option as TOption,
  Tag as TTag,
  Space as TSpace,
  Divider as TDivider,
} from 'tdesign-vue-next'

const data = ref<StorageData>(getDefaultData())
const loading = ref(true)

const languages = [
  { value: 'en', label: 'English' },
  { value: 'zh_CN', label: '简体中文' },
  { value: 'zh_TW', label: '繁體中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'uk', label: 'Українська' },
]

const colorModes: { value: ColorMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto (follow system)' },
]

const lightThemes = LIGHT_THEMES
const darkThemes = DARK_THEMES

const fontSizes: { value: FontSize; label: string }[] = Object.entries(FONT_SIZE_MAP).map(
  ([label]) => ({ value: label as FontSize, label }),
)

const codeThemes = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

onMounted(async () => {
  const saved = await storage.get()
  data.value = getDefaultData(saved)
  loading.value = false
})

function updateStorage(key: keyof StorageData, value: unknown): void {
  chrome.runtime.sendMessage({
    action: 'storage',
    data: { key, value },
  })
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

watch(() => data.value.colorMode, (v) => updateStorage('colorMode', v))
watch(() => data.value.lightTheme, (v) => updateStorage('lightTheme', v))
watch(() => data.value.darkTheme, (v) => updateStorage('darkTheme', v))
watch(() => data.value.codeTheme, (v) => updateStorage('codeTheme', v))
watch(() => data.value.fontSize, (v) => updateStorage('fontSize', v))
watch(() => data.value.language, (v) => { if (v) updateStorage('language', v) })
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-8" v-if="!loading">
    <div class="mb-6">
      <h1 class="text-2xl font-bold m-0">md-viewer Settings</h1>
      <p class="text-sm text-gray-500 mt-1">v1.0.0 · MIT License</p>
    </div>

    <!-- General -->
    <TCard title="General" class="mb-4">
      <TSpace direction="vertical" size="medium" class="w-full">
        <div class="flex items-center justify-between">
          <div>
            <div class="font-medium">Enable Extension</div>
            <div class="text-xs text-gray-400">Turn on/off markdown preview</div>
          </div>
          <TSwitch v-model="data.enable" @change="(v: any) => updateStorage('enable', v as boolean)" />
        </div>

        <div class="flex items-center justify-between">
          <div>
            <div class="font-medium">Centered Layout</div>
            <div class="text-xs text-gray-400">Center the content horizontally</div>
          </div>
          <TSwitch
            v-model="data.centered"
            :disabled="!data.enable"
            @change="(v: any) => updateStorage('centered', v as boolean)"
          />
        </div>

        <div class="flex items-center justify-between">
          <div>
            <div class="font-medium">Auto Refresh</div>
            <div class="text-xs text-gray-400">Watch file changes and auto-reload</div>
          </div>
          <TSwitch
            v-model="data.refresh"
            :disabled="!data.enable"
            @change="(v: any) => updateStorage('refresh', v as boolean)"
          />
        </div>
      </TSpace>
    </TCard>

    <!-- Theme -->
    <TCard title="Appearance" class="mb-4">
      <TSpace direction="vertical" size="medium" class="w-full">
        <div>
          <div class="font-medium mb-1">Appearance</div>
          <TRadioGroup v-model="data.colorMode" :disabled="!data.enable">
            <TRadio v-for="m in colorModes" :key="m.value" :value="m.value">{{ m.label }}</TRadio>
          </TRadioGroup>
        </div>
        <div class="flex gap-4">
          <div>
            <div class="text-sm text-gray-500 mb-1">Light theme</div>
            <TSelect v-model="data.lightTheme" :disabled="!data.enable" style="width: 160px">
              <TOption v-for="t in lightThemes" :key="t.value" :value="t.value" :label="t.label" />
            </TSelect>
          </div>
          <div>
            <div class="text-sm text-gray-500 mb-1">Dark theme</div>
            <TSelect v-model="data.darkTheme" :disabled="!data.enable" style="width: 160px">
              <TOption v-for="t in darkThemes" :key="t.value" :value="t.value" :label="t.label" />
            </TSelect>
          </div>
        </div>

        <div>
          <div class="font-medium mb-1">Code Theme</div>
          <TSelect v-model="data.codeTheme" :disabled="!data.enable" style="width: 200px">
            <TOption v-for="c in codeThemes" :key="c.value" :value="c.value" :label="c.label" />
          </TSelect>
        </div>

        <div>
          <div class="font-medium mb-1">Font Size</div>
          <TSelect v-model="data.fontSize" :disabled="!data.enable" style="width: 200px">
            <TOption v-for="f in fontSizes" :key="f.value" :value="f.value" :label="f.label" />
          </TSelect>
        </div>
      </TSpace>
    </TCard>

    <!-- Plugins -->
    <TCard title="Plugins" class="mb-4">
      <div class="flex flex-wrap gap-2">
        <TTag
          v-for="p in MD_PLUGINS"
          :key="p"
          :theme="data.mdPlugins?.includes(p) ? 'primary' : 'default'"
          :class="['cursor-pointer select-none', !data.enable && 'opacity-50 pointer-events-none']"
          @click="data.enable && togglePlugin(p)"
        >
          {{ p }}
        </TTag>
      </div>
      <div class="text-xs text-gray-400 mt-2">
        Click tags to enable/disable individual features
      </div>
    </TCard>

    <!-- Language -->
    <TCard title="Language" class="mb-4">
      <TSelect v-model="data.language" :disabled="!data.enable" style="width: 200px">
        <TOption v-for="l in languages" :key="l.value" :value="l.value" :label="l.label" />
      </TSelect>
    </TCard>

    <!-- About -->
    <TCard title="About" class="mb-4">
      <div class="text-sm text-gray-500 space-y-1">
        <p>md-viewer — read Markdown files in your browser.</p>
        <p>Independent open-source fork based on the original MIT-licensed project by <strong>Bener</strong>.</p>
        <p>
          <a
            href="https://github.com/summereasy/md-reader"
            target="_blank"
            class="text-blue-500"
          >
            GitHub Repository
          </a>
        </p>
      </div>
    </TCard>
  </div>
</template>

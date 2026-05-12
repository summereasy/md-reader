import type { StorageData } from './types'

class Storage {
  private local = chrome.storage.local

  async set(data: Partial<StorageData>): Promise<void>
  async set<K extends keyof StorageData>(key: K, value: StorageData[K]): Promise<void>
  async set(keyOrData: unknown, value?: unknown): Promise<void> {
    if (typeof keyOrData === 'string') {
      return this.setObject({ [keyOrData]: value })
    }
    return this.setObject(keyOrData as Partial<StorageData>)
  }

  private setObject(data: Partial<StorageData>): Promise<void> {
    return new Promise((resolve) => this.local.set(data, resolve))
  }

  async get(): Promise<StorageData>
  async get<K extends keyof StorageData>(keys: K): Promise<Pick<StorageData, K>>
  async get<K extends keyof StorageData>(keys: K[]): Promise<Pick<StorageData, K>>
  async get(keys?: unknown): Promise<StorageData> {
    return new Promise((resolve) => {
      this.local.get(keys as string | string[] | null, resolve as (items: Record<string, unknown>) => void)
    })
  }
}

export const storage = new Storage()

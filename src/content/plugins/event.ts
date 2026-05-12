type ClickHandler = (target: HTMLElement, event: MouseEvent) => void

interface PluginCtx {
  on(event: 'click', handler: ClickHandler): void
  emit(event: 'click', target: HTMLElement, e: MouseEvent): void
}

class EventBus {
  private handlers: Map<string, Function[]> = new Map()

  on(event: string, handler: Function): void {
    if (!this.handlers.has(event)) this.handlers.set(event, [])
    this.handlers.get(event)!.push(handler)
  }

  emit(event: string, ...args: unknown[]): void {
    this.handlers.get(event)?.forEach((h) => h(...args))
  }
}

const eventBus = new EventBus()

export function createPluginCtx(): PluginCtx {
  return {
    on: (event, handler) => eventBus.on(event, handler as Function),
    emit: (event, target, e) => eventBus.emit(event, target, e),
  }
}

export function getEventBus(): EventBus {
  return eventBus
}

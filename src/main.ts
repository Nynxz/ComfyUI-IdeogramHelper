import { app } from '@comfy/app'

import { mountWidget } from '@/lib/mountWidget'
import IdeogramStudio from '@/components/IdeogramStudio.vue'
import '@/extensions/scrollFix'
import '@/extensions/overrideList'

console.log('[IdeogramStudio] main.js loaded — registering extension')

app.registerExtension({
  name: 'nynxz.ideogram-studio',
  getCustomWidgets() {
    return {
      IDEOGRAM_STUDIO(node: unknown) {
        return mountWidget(node as Parameters<typeof mountWidget>[0], {
          widgetName: 'studio',
          widgetType: 'IDEOGRAM_STUDIO',
          component: IdeogramStudio,
          minHeight: 680,
          defaultValue: null,
        })
      },
    } as never
  },
  nodeCreated(node: unknown) {
    const lg = node as {
      constructor?: { comfyClass?: string }
      size: [number, number]
      setSize: (s: [number, number]) => void
    }
    if (lg.constructor?.comfyClass !== 'IdeogramStudio') return
    const [w, h] = lg.size
    lg.setSize([Math.max(w, 560), Math.max(h, 760)])
  },
})

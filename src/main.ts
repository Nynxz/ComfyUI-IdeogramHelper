import { app } from '@comfy/app'

import { mountWidget } from '@/lib/mountWidget'
import IdeogramStudio from '@/components/IdeogramStudio.vue'
import PaletteNode from '@/components/PaletteNode.vue'
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
      IDEOGRAM_PALETTE(node: unknown) {
        return mountWidget(node as Parameters<typeof mountWidget>[0], {
          widgetName: 'palette',
          widgetType: 'IDEOGRAM_PALETTE',
          component: PaletteNode,
          minHeight: 44,
          defaultValue: [],
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
    const cls = lg.constructor?.comfyClass
    if (cls === 'IdeogramStudio') lg.setSize([Math.max(lg.size[0], 560), Math.max(lg.size[1], 760)])
    else if (cls === 'IdeogramPalette') lg.setSize([Math.max(lg.size[0], 220), Math.max(lg.size[1], 90)])
  },
})

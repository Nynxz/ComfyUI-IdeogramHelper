/**
 * Autogrow inputs for the "Ideogram Studio Override List" node.
 *
 * The Python node declares only `overrides_1`; here we keep exactly one empty
 * trailing `IDEOGRAM_OVERRIDE` slot, adding/removing slots as connections
 * change. ComfyUI resolves linked inputs even when they aren't declared, so the
 * grown slots reach the node's `**kwargs`.
 *
 * Sync is debounced (setTimeout 0) so that on workflow load — where links
 * restore one-by-one and would briefly look "empty" — it runs once after every
 * link is in place, instead of pruning slots mid-restore.
 */
import { app } from '@comfy/app'

const TYPE = 'IDEOGRAM_OVERRIDE'
const NAME = /^overrides_(\d+)$/

type LGNode = {
  inputs?: { name: string; type: string; link: number | null }[]
  addInput: (name: string, type: string) => void
  removeInput: (slot: number) => void
  setDirtyCanvas?: (fg: boolean, bg: boolean) => void
  __ovSync?: boolean
}

function syncInputs(node: LGNode) {
  const inputs = node.inputs
  if (!inputs) return
  // drop every empty override slot...
  for (let i = inputs.length - 1; i >= 0; i--) {
    const inp = inputs[i]
    if (inp && NAME.test(inp.name) && inp.link == null) node.removeInput(i)
  }
  // ...then append exactly one fresh empty slot after the highest remaining index
  let max = 0
  for (const inp of node.inputs ?? []) {
    const m = inp?.name?.match(NAME)
    if (m) max = Math.max(max, Number(m[1]))
  }
  node.addInput(`overrides_${max + 1}`, TYPE)
  node.setDirtyCanvas?.(true, true)
}

function scheduleSync(node: LGNode) {
  if (node.__ovSync) return
  node.__ovSync = true
  setTimeout(() => {
    node.__ovSync = false
    syncInputs(node)
  }, 0)
}

app.registerExtension({
  name: 'nynxz.ideogram-override-list',
  beforeRegisterNodeDef(nodeType: any, nodeData: any) {
    if (nodeData?.name !== 'IdeogramOverrideList') return

    const onCreated = nodeType.prototype.onNodeCreated
    nodeType.prototype.onNodeCreated = function () {
      onCreated?.apply(this)
      scheduleSync(this)
    }

    const onConn = nodeType.prototype.onConnectionsChange
    nodeType.prototype.onConnectionsChange = function (...args: unknown[]) {
      onConn?.apply(this, args)
      scheduleSync(this)
    }
  },
})

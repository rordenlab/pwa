import type NiiVue from '@niivue/niivue/webgl2'

declare global {
  const nv: NiiVue
  const doc: { dirty: boolean; name: string }
}

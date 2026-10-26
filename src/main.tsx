import { registerSW } from 'virtual:pwa-register'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { doc } from './doc'
import './install' // listen for the install prompt from the start
import { applyPrefs } from './prefs'
import { script } from './script/Script'
import { app, notify } from './state'
import './app.css'

applyPrefs()
doc.dirty = false // startup preferences are not user edits to the scene
createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Updates wait for an explicit reload so unsaved work is never lost (plan §6).
const update = registerSW({
  onNeedRefresh() {
    notify('An update is available: Help ▸ Reload to Update.')
    app.reloadToUpdate = () => {
      if ((doc.dirty || script.dirty) && !confirm('Discard unsaved changes and reload?')) return
      doc.dirty = script.dirty = false // already confirmed; skip the browser's leave prompt
      update(true)
    }
  },
})

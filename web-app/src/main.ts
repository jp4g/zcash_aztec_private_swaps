import './style.css'
import { initAztecView } from './views/aztec.ts'
import { initZcashView } from './views/zcash.ts'

type ViewName = 'zcash' | 'aztec'

const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab-button'))
const panels: Record<ViewName, HTMLElement | null> = {
  zcash: document.getElementById('zcash-view') as HTMLElement | null,
  aztec: document.getElementById('aztec-view') as HTMLElement | null,
}

const setActiveView = (view: ViewName) => {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.view === view
    button.classList.toggle('active', isActive)
  })

  ;(Object.keys(panels) as ViewName[]).forEach((key) => {
    const panel = panels[key]
    if (!panel) {
      return
    }

    const isActive = key === view
    panel.classList.toggle('active', isActive)
    if (isActive) {
      panel.removeAttribute('hidden')
    } else {
      panel.setAttribute('hidden', 'true')
    }
  })
}

const setupTabNavigation = () => {
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.view as ViewName | undefined
      if (view) {
        setActiveView(view)
      }
    })
  })
}

const bootstrap = () => {
  setupTabNavigation()
  setActiveView('zcash')
  void initZcashView()
  initAztecView()
}

bootstrap()

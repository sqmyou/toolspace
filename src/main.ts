import './styles/main.css'
import { loadToolStyles } from './core/tool-styles'
import { mountApp } from './ui/app'

loadToolStyles()

const app = document.getElementById('app')
if (app) mountApp(app)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Offline support is a bonus; the app works fine without it.
    })
  })
}

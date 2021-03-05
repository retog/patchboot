import ssbConnect from './scuttle-shell-browser-consumer.js'
import './components/AppSelector'
import './components/AppRunner'
import './components/SourceViewer'
import { default as pull } from 'pull-stream'

const sidebar = document.getElementById('sidebar')
const sidebarToggle = document.getElementById('toggle-apps')
const sidebarClose = document.getElementById('close-apps')
const sidebarCloseBackdrop = document.getElementById('close-apps-backdrop')

const closeSidebar = () => {
  console.log('closing')
  sidebar.classList.add('gone')
  sidebarCloseBackdrop.classList.add('gone')
  sidebarCloseBackdrop.removeEventListener('click', closeSidebar)
}

const openSidebar = () => {
  console.log('opening')
  sidebar.classList.remove('gone')
  sidebarCloseBackdrop.classList.remove('gone')
  sidebarCloseBackdrop.addEventListener('click', closeSidebar)
}

sidebarToggle.addEventListener('click', e => {
  console.log('toggling', sidebar.classList, sidebar.classList.contains('gone') )
  if (sidebar.classList.contains('gone')) openSidebar()
  else closeSidebar()
})
sidebarClose.addEventListener('click', closeSidebar)
sidebarCloseBackdrop.addEventListener('click', closeSidebar)

setTimeout(() => {
  document.body.classList.add('waited')
}, 1000)

const selectionArea = document.getElementById('sidebar-inner')
ssbConnect().then(sbot => {

  if (document.getElementById('connecting')) document.getElementById('connecting').classList.add('hidden')
  if (document.getElementById('info')) document.getElementById('info').classList.remove('hidden')

  const selector = document.createElement('app-selector')
  selector.sbot = sbot
  selector.addEventListener('run', run)
  selector.addEventListener('show-source', showSource)
  selectionArea.appendChild(selector)
  
  const statusBar = document.getElementById('status')
  
  const view = document.getElementById('view')
  //const shadowView = view.attachShadow({ mode: 'closed' });
  //const shadowHtml = document.createElement('html')
  //shadowView.appendChild(shadowHtml)

  function run(event) {
    const app = event.detail
    document.getElementById('info').classList.add('hidden')
    document.getElementById('title-ext').innerHTML = app.name
    statusBar.classList.remove('hidden')
    statusBar.innerText = 'Loading ' + app.name
    view.innerHTML = ''
    const appRunner = document.createElement('app-runner')
    appRunner.sbot = sbot
    appRunner.app = app
    view.appendChild(appRunner)

    appRunner.addEventListener('loaded', e => {
      statusBar.classList.add('hidden')
    })
  }

  function showSource(event) {
    const app = event.detail
    console.log('showSource', app)
    const outer = document.createElement('div')
    outer.id = 'outer'
    const oldTop = window.scrollY
    const oldLeft = window.scrollX
    window.scroll(0,0)
    document.body.classList.add('modal-open')
    document.body.appendChild(outer)
    //const inner = document.createElement('div')
    const sourceViewer = document.createElement('source-viewer')
    sourceViewer.id = 'inner'
    sourceViewer.app = app
    sourceViewer.sbot = sbot
    sourceViewer.name = app.name || app.comment || ''
    outer.appendChild(sourceViewer)
    const close = () => {
      document.body.removeChild(outer)
      document.body.classList.remove('modal-open')
      window.scroll(oldLeft, oldTop)
    }
    outer.addEventListener('click', close)
    sourceViewer.addEventListener('close', close)
    sourceViewer.addEventListener('click', e => e.stopPropagation())
  }
},
error => {
  console.log('An error occured', error)
})
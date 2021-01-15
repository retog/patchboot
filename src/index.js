import ssbConnect from './scuttle-shell-browser-consumer.js'
import './components/AppSelector'
import './components/AppRunner'
import './components/SourceViewer'
import { default as pull } from 'pull-stream'

const sidebarToggle = document.getElementById('toggle-apps')
if (sidebarToggle) sidebarToggle.addEventListener('click', e => {
  document.getElementById('sidebar').classList.toggle('gone')
})
const sidebarClose = document.getElementById('close-apps')
if (sidebarClose) sidebarClose.addEventListener('click', e => {
  document.getElementById('sidebar').classList.add('gone')
})

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
    sourceViewer.blobId = app.link || app.mentions[0].link
    sourceViewer.sbot = sbot
    sourceViewer.name = app.name || app.mentions[0].name || app.comment || ''
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
import ssbConnect from './scuttle-shell-browser-consumer.js'
import './components/AppSelector'
import './components/AppRunner'
import './components/SourceViewer'
import { default as pull } from 'pull-stream'

const selectionArea = document.getElementById('app-selection')
ssbConnect().then(sbot => {
  
  const selector = document.createElement('app-selector')
  selector.sbot = sbot
  selector.addEventListener('run', run)
  selector.addEventListener('show-source', showSource)
  selectionArea.appendChild(selector)
  
  const view = document.getElementById('view')
  //const shadowView = view.attachShadow({ mode: 'closed' });
  //const shadowHtml = document.createElement('html')
  //shadowView.appendChild(shadowHtml)
  let headObserver = null;
  function run(event) {
    const app = event.detail
    view.innerHTML = ''
    const appRunner = document.createElement('app-runner')
    appRunner.sbot = sbot
    appRunner.app = app
    view.appendChild(appRunner)
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
    sourceViewer.blobId = app.link
    sourceViewer.sbot = sbot
    sourceViewer.name = app.name
    outer.appendChild(sourceViewer)
    const close = () => {
      document.body.removeChild(outer)
      document.body.classList.remove('modal-open')
      window.scroll(oldLeft, oldTop)
    }
    outer.addEventListener('click', close)
    sourceViewer.addEventListener('close', close)
  }
},
error => {
  console.log('An error occured', error)
})
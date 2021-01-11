import ssbConnect from 'scuttle-shell-browser-consumer'
import './components/AppSelector'
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
  const shadowView = view.attachShadow({ mode: 'closed' });
  const shadowHtml = document.createElement('html')
  shadowView.appendChild(shadowHtml)
  let headObserver = null;
  function run(event) {
    const app = event.detail
    const blobId = app.link
    sbot.blobs.want(blobId).then(() => {
      pull(
        sbot.blobs.get(blobId),
        pull.collect(function (err, values) {
          if (err) throw err
          document.getElementById('title-ext').innerHTML = ' - Running: ' + app.name
          const code = values.join('')
          window.setTimeout(() => {
            const outerHead = document.getElementsByTagName('head')[0]
            const config = { attributes: false, childList: true, subtree: false }
            const callback = function (mutationsList, observer) {
              mutationsList.forEach(mutation => {
                mutation.addedNodes.forEach(n => shadowHtml.getElementsByTagName('head')[0].appendChild(n))
              })
            }
            if (headObserver) {
              headObserver.disconnect()
            }
            headObserver = new MutationObserver(callback);
            headObserver.observe(outerHead, config);
            const fun = new Function('document','root', 'ssb', 'sbot', 'pull', code);
            shadowHtml.innerHTML = '';
            shadowHtml.createElement = document.createElement
            fun(document, shadowHtml.getElementsByTagName('body')[0], cb => cb(undefined,sbot), sbot, pull);
          }, 0)
        }))
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
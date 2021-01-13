import ssbConnect from 'scuttle-shell-browser-consumer'
import './components/AppSelector'
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

  if (document.getElementById('connecting')) document.getElementById('connecting').classList.add('hidden');
  if (document.getElementById('info')) document.getElementById('info').classList.remove('hidden');

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
          document.getElementById('title-ext').innerHTML = app.name
          if (document.getElementById('info')) document.getElementById('info').classList.add('hidden');
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
  }
},
error => {
  console.log('An error occured', error)
})
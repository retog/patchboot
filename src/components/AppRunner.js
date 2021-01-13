/* provides a web-component to execute a PatchBoot app. It is passed the app msg rather than the blob to support 
 * different app formats in future.
 */

import { default as pull, paraMap, collect } from 'pull-stream'
import MRPC from 'muxrpc'

class AppRunner extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback() {
    const runnerArea = this.attachShadow({ mode: 'open' })
    const iFrame = document.createElement('iframe')
    const blobId = this.app.link
    this.sbot.blobs.want(blobId).then(() => {
      pull(
        this.sbot.blobs.get(blobId),
        pull.collect((err, values) => {
          if (err) throw err
          const code = values.join('')
          const utf8Encode = new TextEncoder()
          const iFrameContent = `
          <!DOCTYPE html>
          <html>
          <body>

            <div id="patchboot-app">
              If Scuttle Shell Browser is installed correctly and activated for this page, the PatchBoot App will appear here.
            </div>

            <script type="module">
              import {default as ssbConnect, pull} from 'http://localhost:9090/ssb-connect.js' //'https://retog.github.io/scuttle-shell-browser/ssb-connect.js'
              console.log('connecting',ssbConnect)
              ssbConnect().then(sbot => {
                window.sbot = sbot
                window.root = document.getElementById('patchboot-app')
                window.pull = pull
                window.root.innerHTML = ''
                const script = document.createElement('script')
                script.defer = true
                script.src = 'data:text/javascript;base64,${btoa(utf8Encode.encode(code))}'
                document.head.append(script)
              },
              error => {
                console.log('An error occured', error)
              })

            </script>

          </body>
          </html>
          `
          //console.log(iFrameContent)
          runnerArea.appendChild(iFrame)
          iFrame.contentWindow.document.open();
          iFrame.contentWindow.document.write(iFrameContent);
          iFrame.contentWindow.document.close();
          
          let messageDataCallback = null
          let messageDataBuffer = []

          const fromPage = function read(abort, cb) {
            if (messageDataBuffer.length > 0) {
              const data = messageDataBuffer[0]
              messageDataBuffer = messageDataBuffer.splice(1)
              cb(null, data)
            } else {
              messageDataCallback = cb
            }

          }

          function ping() {
            console.log('pinging')
            iFrame.contentWindow.postMessage({
              direction: "from-content-script",
              action: 'ping'
            }, '*');
          }

          iFrame.contentWindow.addEventListener("message", (event) => {
            console.log('also got msg', event.source, event.source === window)
          })
          iFrame.contentWindow.addEventListener("message", (event) => {
            console.log('got msg', event)
            if (event.data && event.data.direction === "from-page-script") {
                if (event.data.action === "ping") {
                  ping()
                } else {
                  //new Uint8Array(event.data.message) is not accepted by muxrpc
                  const asBuffer = Buffer.from(event.data.message)
                  if (messageDataCallback) {
                      const _messageDataCallback = messageDataCallback
                      messageDataCallback = null
                      _messageDataCallback(null, asBuffer)
                  } else {
                    console.log('buffering....')
                    messageDataBuffer.push(asBuffer)
                  }
                }
              }
            })
          const toPage = function sink(done) {
            return function (source) {
              source(null, function more (end,data) {
                iFrame.contentWindow.postMessage({
                  direction: "from-content-script",
                  message: data
                }, '*');
                source(null, more)
              })
            }
          }
          //console.log('starting RPC')
          function logger(text) {
            return pull.map((v) => {
              console.log(text,v)
              return v
            })
          }
          this.sbot.manifest().then(manifest => {
            //console.log('manifest', JSON.stringify(manifest))
            const asyncManifest = asyncifyManifest(manifest)
            this.sbot.manifest = function () {
              return manifest
            }
            const server = MRPC(null, asyncManifest) (this.sbot)
            const serverStream = server.createStream(() => {console.log('closed')})
            pull(fromPage, logger('from page'), serverStream, logger('to page'), toPage)
            console.log('connected')
          })
        })
      )
    })
  }
}

function asyncifyManifest(manifest) {
  if (typeof manifest !== 'object') return manifest
  let asyncified = {}
  for (let k in manifest) {
    var value = manifest[k]
    // Rewrite re-exported sync methods as async,
    // except for manifest method, as we define it later
    if (value === 'sync' && k !== 'manifest') {
      value = 'async'
    }
    asyncified[k] = value
  }
  return asyncified
}

customElements.define("app-runner", AppRunner)
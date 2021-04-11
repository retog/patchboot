/* provides a web-component to execute a PatchBoot app. It is passed the app msg rather than the blob to support 
 * different app formats in future.
 */

import { default as pull, paraMap, collect } from 'pull-stream'
import MRPC from 'muxrpc'
import Util from '../Util.js';

class AppRunner extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback() {
    const runnerArea = this.attachShadow({ mode: 'open' })

    const util = new Util(this.sbot)

    const getClassicAppFrameContent = () => {
      const blobId = this.app.link
      return util.dereferenceUriOrSigil(blobId).then(code => {
        function utf8_to_b64(str) {
          return btoa(unescape(encodeURIComponent(str)));
        }
        return `
          <!DOCTYPE html>
          <html>
          <head>
          <title>Patchboot app</title>
          </head>
          <body>

            <div id="patchboot-app" style="padding-right: 8px; min-width: min-content;">Connecting to SSB.</div>

            <script type="module">
              import {default as ssbConnect, pull} from './scuttle-shell-browser-consumer.js'
              ssbConnect().then(sbot => {
                window.sbot = sbot
                window.root = document.getElementById('patchboot-app')
                window.pull = pull
                window.root.innerHTML = ''
                const script = document.createElement('script')
                script.defer = true
                script.src = 'data:text/javascript;base64,${utf8_to_b64(code)}'
                document.head.append(script)
              },
              error => {
                console.log('An error occured', error)
              })

            </script>

          </body>
          </html>
          `
      })

    }

    const addBaseUrl = (htmlString) => htmlString.replace('<head>',`<head><base href="${this.app.link}">`)

    const getWebappContent = () => {
      const link = this.app.link
      // because of same originy policy we cab't just use original link
      return util.dereferenceUriOrSigil(link).then(content => {
        content = (link.startsWith('&') || link.startsWith('ssb')) ? content : addBaseUrl(content)
        return content
      })
    }

    const getAppFrameContent = () => {
      if (this.app.type === 'patchboot-app') {
        return getClassicAppFrameContent()
      } else if (this.app.type === 'patchboot-webapp') {
        return getWebappContent()
      } else {
        throw new Error('unsupported: ' + this.app.type)
      }
    }

    const createIFrame = () => {
      const iFrame = document.createElement('iframe')
      runnerArea.appendChild(iFrame) // has to appended before contentWindow is accessed
      iFrame.style = "width: 100%; height: 100%; border: none;"
      return getAppFrameContent().then(iFrameContent => {
        iFrame.contentWindow.document.open()
        iFrame.contentWindow.document.write(iFrameContent)
        iFrame.contentWindow.document.close()
        return iFrame
      })
    }
    
    createIFrame().then(iFrame => {
      console.log(iFrame)
      
      this.dispatchEvent(new Event('loaded'))

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
        iFrame.contentWindow.postMessage({
          direction: "from-content-script",
          action: 'ping'
        }, '*');
      }

      iFrame.contentWindow.addEventListener("message", (event) => {
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
      const toPage = function (source) {
        source(null, function more(end, data) {
          iFrame.contentWindow.postMessage({
            direction: "from-content-script",
            message: data
          }, '*');
          source(null, more)
        })
      }
      iFrame.contentWindow.addEventListener('load', () => this.dispatchEvent(new CustomEvent('ready')))
      /*function logger(text) {
        return pull.map((v) => {
          console.log(text,v)
          console.log(new TextDecoder("utf-8").decode(v))
          return v
        })
      }*/
      this.sbot.manifest().then(manifest => {
        //console.log('manifest', JSON.stringify(manifest))
        const asyncManifest = asyncifyManifest(manifest)
        const server = MRPC(null, asyncManifest)(this.sbot)
        const serverStream = server.createStream(() => { console.log('closed') })
        pull(fromPage, serverStream, toPage)
      })
    })

  }
}

function asyncifyManifest(manifest) {
  if (typeof manifest !== 'object') return manifest
  let asyncified = {}
  for (let k in manifest) {
    var value = manifest[k]
    // Rewrite re-exported sync methods as async,
    if (value === 'sync') {
      value = 'async'
    }
    asyncified[k] = value
  }
  return asyncified
}

customElements.define("app-runner", AppRunner)
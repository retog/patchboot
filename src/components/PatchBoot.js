
import './AppSelector.js'
import './AppRunner.js'
import './SourceViewer.js'
import { default as pull } from 'pull-stream'

class PatchBoot extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback() {
    const componentArea = this.attachShadow({ mode: 'open' })

    componentArea.innerHTML = `
    <div id="component-root">
    <style>
      * {
        box-sizing: border-box;
        overflow-wrap: anywhere;
      }
      
      #component-root {
        background-color: #ffffff;
        font-family: Inter, 'Helvetica Neue', Arial, Helvetica, sans-serif;
        --lineColor1: #79cfd9;
        --lineColor2: #b0bec5;
        --topBarHeight: 45px;
      }
      
      
      .flex {
        display: flex;
        width: 100vw;
      }
      
      #sidebar {
        flex-shrink: 0;
        width: 248px;
        border-right: 1px solid var(--lineColor1);
        height: 100vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transition: width 0.3s ease-in-out, margin-left 0.3s ease-in-out;
        background: #ffffff;
      }
      
      #sidebar.gone {
        width: 0px;
        margin-left: -1px;
      }
      
      #sidebar-inner {
        width: 247px;
        height: 100vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      #close-apps,
      #close-apps-backdrop {
        display: none;
      }
      
      @media screen and (max-width: 500px) {
        #close-apps {
          display: block;
        }
      
        #close-apps-backdrop {
          display: block;
          content: "";
          position: absolute;
          background: rgba(0, 0, 0, 0.2);
          transition: width 0.3s ease-in-out;
          top: 0;
          bottom: 0;
          right: 0;
          left: 0;
        }
      
        #sidebar {
          position: absolute;
          top: 0;
          right: 16px;
          bottom: 0;
          left: 0;
          width: unset;
          border: none;
          transition: right 0.3s ease-in-out;
          box-shadow: -5px 0 10px 0 black;
          z-index: 100;
        }
      
        #sidebar-inner {
          width: calc(100vw - 16px);
        }
      
        #sidebar.gone,
        #close-apps-backdrop.gone {
          width: unset;
          margin: 0;
          right: 100vw;
        }
      }
      
      #connecting {
        padding: 0 0.5rem;
        animation: 1s infinite alternate ease-in-out loading-color;
      }
      
      @keyframes loading-color {
        from {
          color: black;
        }
        to {
          color: var(--lineColor1);
        }
      }
      
      #connecting p {
        margin: 0.5rem 0;
      }
      
      #connecting .muted {
        color: rgba(0,0,0,0);
      }
      
      .waited #connecting .muted {
        color: rgba(0, 0, 0, 0.4);
      }
      
      .muted {
        color: rgba(0, 0, 0, 0.4);
      }
      
      .bar {
        border-bottom: 1px solid var(--lineColor1);
        border-radius: 0;
        padding: 0.5rem;
        background: #e0f7fa;
        background: #79cfd9;
        display: flex;
        justify-content: space-between;
        height: var(--topBarHeight);
        line-height: 28px;
      }
      
      .bar h1 {
        display: block;
        font-size: 1rem;
        margin: 0;
        padding: 0;
      }
      
      #title-ext {
        font-weight: 500;
      }
      
      .icons {
        display: flex;
      }
      
      .icons button {
        margin: 0 2px;
        padding: 6px;
        border: none;
        border-radius: 50%;
        height: 28px;
        background-color: rgba(0,0,0,0.027450980392156863);
      }
      
      .icons button:hover {
        background-color: rgba(0,0,0,0.13333333333333334);
      }
      
      .icons button svg {
        display: block;
        height: 16px;
        width: 16px;
      }
      
      .svghover .onhover {
        display: none;
      }
      
      .svghover:hover path {
        display: none;
      }
      
      .svghover:hover .onhover {
        display: unset;
      }
      
      #info {
        transition: all 0.3s ease-in-out;
        max-height: 90vh;
        overflow-y: auto;
        padding: 0.5rem;
      }
      
      #status {
        max-height: 90vh;
        padding: 0.5rem;
        background: #def3f6;
        transform: all 0.3s ease-in-out;
      }
      
      .hidden {
        display: none;
      }
      
      #info.hidden
      #status.hidden {
        max-height: 0 !important;
        border: none;
        padding: 0;
        margin: 0;
        opacity: 0;
        overflow: hidden;
      }
      
      #outer {
        position: absolute;
        right: 0;
        left: 0;
        bottom: 0;
        top: 0;
        padding: 2rem;
        background: rgba(0, 0, 0, 0.2);
        height: 100vh;
        width: 100vw;
        max-height: 100vh;
        max-width: 100vw;
      }
      
      #inner {
        background: white;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        opacity: 1;
        height: 100%;
        width: 100%;
        max-height: 100%;
        max-width: 100%;
        box-shadow: 4px 4px 12px -8px black;
      }
      
      #inner * {
        margin: 0.2rem;
      }
      
      #inner .main {
        overflow: auto;
        background: lightgray;
        max-width: 100%;
        flex: 1;
      }
      
      .modal-open {
        overflow: hidden;
        max-height: 100vh;
        max-width: 100vw;
      }
      
      app-selector {
        display: flex;
        flex-direction: column;
        flex: 0 auto;
        max-height: calc(100vh - 45px);
      }
      
      .main {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        height: 100vh;
        min-width: 45px;
        overflow: hidden;
      }
      
      #view {
        height: 100%;
        overflow: hidden;
      }
      
      #view:empty {
        height: 0;
      }
      
      app-runner {
        width: 100%;
        height: 100%;
        display: block;
      }

    </style>
    <div class="flex">
      <div id="sidebar">
        <div id="sidebar-inner">
          <header class="bar">
            <h1>PatchBoot</h1>
            <div class="icons">
              <button id="close-apps">
                <svg width="24" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
                </svg>
              </button>
            </div>
          </header>
        </div>
      </div>
      <div class="main">
        <header class="bar">
          <div class="icons">
            <button id="toggle-apps">
              <svg width="24" viewBox="0 0 24 24">
                <path fill="currentColor"
                  d="M16,20H20V16H16M16,14H20V10H16M10,8H14V4H10M16,8H20V4H16M10,14H14V10H10M4,14H8V10H4M4,20H8V16H4M10,20H14V16H10M4,8H8V4H4V8Z" />
              </svg>
            </button>
          </div>
          <h1 id="title-ext"></h1>
          <div></div>
        </header>
        <div id="connecting">
          <p>Connecting to SSB</p>
          <p class="muted"><small>If nothing happens, please make sure you have an SSB server running and the plugin
              intstalled.</small></p>
        </div>
        <div id="info" class="hidden">
          <h2>No App is Running yet</h2>
          <p>
            Only execute apps you trust,
            as they’ll have full access to your SSB account.
          </p>
        </div>
        <div id="status" class="hidden"></div>
        <div id="view"></div>
      </div>
    </div>
    <div id="close-apps-backdrop"></div>
    </div>
    `
    const componentRoot = componentArea.getElementById('component-root')
    const sidebar = componentArea.getElementById('sidebar')
    const sidebarToggle = componentArea.getElementById('toggle-apps')
    const sidebarClose = componentArea.getElementById('close-apps')
    const sidebarCloseBackdrop = componentArea.getElementById('close-apps-backdrop')

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
      console.log('toggling', sidebar.classList, sidebar.classList.contains('gone'))
      if (sidebar.classList.contains('gone')) openSidebar()
      else closeSidebar()
    })
    sidebarClose.addEventListener('click', closeSidebar)
    sidebarCloseBackdrop.addEventListener('click', closeSidebar)

    setTimeout(() => {
      componentRoot.classList.add('waited')
    }, 1000)

    const selectionArea = componentArea.getElementById('sidebar-inner')
    this.ssbConnect().then(sbot => {

      if (componentArea.getElementById('connecting')) componentArea.getElementById('connecting').classList.add('hidden')
      if (componentArea.getElementById('info')) componentArea.getElementById('info').classList.remove('hidden')

      const selector = document.createElement('app-selector')
      selector.sbot = sbot
      selector.addEventListener('run', run)
      selector.addEventListener('show-source', showSource)
      selectionArea.appendChild(selector)

      const statusBar = componentArea.getElementById('status')

      const view = componentArea.getElementById('view')
      //const shadowView = view.attachShadow({ mode: 'closed' });
      //const shadowHtml = componentArea.createElement('html')
      //shadowView.appendChild(shadowHtml)

      function run(event) {
        const app = event.detail
        componentArea.getElementById('info').classList.add('hidden')
        componentArea.getElementById('title-ext').innerHTML = app.name
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
        window.scroll(0, 0)
        componentRoot.classList.add('modal-open')
        componentArea.appendChild(outer)
        //const inner = document.createElement('div')
        const sourceViewer = document.createElement('source-viewer')
        sourceViewer.id = 'inner'
        sourceViewer.app = app
        sourceViewer.sbot = sbot
        sourceViewer.name = app.name || app.comment || ''
        outer.appendChild(sourceViewer)
        const close = () => {
          componentArea.removeChild(outer)
          componentRoot.classList.remove('modal-open')
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

  }


}

customElements.define('patch-boot', PatchBoot)
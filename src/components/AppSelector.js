import './AppController'
import { VotesManager } from '../VotesManager.js'
import { default as pull, paraMap, collect } from 'pull-stream'

class AppSelector extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback() {
    const controllerArea = this.attachShadow({ mode: 'open' })
    const view = document.getElementById('view')
    const opts = {
      live: true,
      reverse: false,
      query: [
        {
          $filter: {
            value: {
              content: { type: {$prefix: 'patchboot-'} }
            }
          }
        },
        {
          $filter: {
            value: {
              content: { type: {$in: ['patchboot-app','patchboot-webapp'] } }
            }
          }
        }
      ]
    }
    controllerArea.innerHTML = `
    <style>
    * {
      box-sizing: border-box;
      overflow-wrap: anywhere;
    }
    app-controller {
      --spacing: 0.5rem;
      --lineColor: var(--lineColor2);
    }
    #apps {
      border-radius: 0;
      padding: 0;
      min-height: 1rem;
      max-height: 100%;
      overflow-y: scroll;
    }
    .show-only-liked app-controller:not(.liked) {
      display: none;
    }
    .top {
      border-bottom: 1px solid gray;
      width: 100%;
      display: block;
    }
    </style>
    <label class="top"><input type="checkbox" id="showLiked" />Show only apps I like</label>`
    const appsGrid = document.createElement('div')
    appsGrid.id = 'apps'
    controllerArea.appendChild(appsGrid)

    const showLikedcheckbox = controllerArea.getElementById('showLiked')
    showLikedcheckbox.addEventListener('change', (e) => {
      if (showLikedcheckbox.checked) {
        appsGrid.classList.add('show-only-liked')
      } else {
        appsGrid.classList.remove('show-only-liked')
      }

    })

    let headObserver = null;
    const sbot = this.sbot
    pull(sbot.query.read(opts), pull.drain((msg) => {
      if (!msg.value) {
        return;
      }
      ensureNotRevoked(sbot, msg).then(() => {
        const controller = document.createElement('app-controller');
        controller.msg = msg
        controller.sbot = sbot
        appsGrid.insertBefore(controller, appsGrid.firstChild);
        const blobId = msg.value.content.link || msg.value.content.mentions[0].link;
        controller.addEventListener('run', () => {
          this.dispatchEvent(new CustomEvent('run', {detail: msg.value.content}))
        });
        controller.addEventListener('view-source', () => {
          this.dispatchEvent(new CustomEvent('show-source', {detail: msg.value.content}))
        })
        controller.addEventListener('like', async () => {
          try {
            console.log(await VotesManager.getVotes(msg.key));
          } catch (e) {
            console.log('error', e);
          }
          return true
        })
        controller.addEventListener('unlike', () => {
          //vote(msg.key, 0)
        })
      }).catch(() => { })
    }, () => console.log('End of apps stream reached.')))

  }
}

function ensureNotRevoked(sbot, msg) {
  return new Promise((resolve, reject) => {
    const queryOpts = {
      reverse: true,
      query: [
        {
          $filter: {
            value: {
              content: {
                about: msg.key,
                type: 'about',
                status: 'revoked'
              }
            }
          }
        }
      ],
      limit: 1
    }
    const backlinksOpts = {
      reverse: true,
      query: [
        {
          $filter: {
            dest: msg.key,
            value: {
              content: {
                about: msg.key,
                type: 'about',
                status: 'revoked'
              }
            }
          }
        }
      ],
      limit: 1
    }
    pull(
      sbot.backlinks ? sbot.backlinks.read(backlinksOpts) : sbot.query.read(queryOpts),
      pull.collect((err, revocations) => {
      if (err) {
        reject(err)
      } else {
        if (revocations.length > 0) {
          reject()
        } else {
          resolve()
        }
      }
    }))
  })
}


customElements.define("app-selector", AppSelector)
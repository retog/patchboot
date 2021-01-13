import { VotesManager } from '../VotesManager.js';
import { IdentityManager } from '../IdentityManager.js';

class AppController extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback() {
    const appDescription = this.msg.value;
    const votesManager = new VotesManager(this.sbot)
    const controllerArea = this.attachShadow({ mode: 'open' });
    controllerArea.innerHTML = `
<style>
  * {
    box-sizing: border-box;
  }

  #app {
    font-size: 16px;
    font-family: Inter, 'Helvetica Neue', Arial, Helvetica, sans-serif;
    border-bottom: 1px solid gray;
    width: 100%;
    margin: 0;
    padding: 8px 6px 0 8px;
  }

  .bar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    padding-bottom: 8px;
    white-space: nowrap;
  }

  .info > * {
    text-overflow: ellipsis;
    overflow-x: hidden;
  }

  .details {
    padding-bottom: 0;
    overflow-x: hidden;
    height: 0;
    white-space: normal;
  }

  #app.expanded .info * {
    height: unset;
    white-space: normal;
  }

  #app.expanded .details {
    padding-bottom: 8px;
    height: auto;
  }

  .name {
    font-size: 17px;
    line-height: 20px;
    height: 20px;
    font-weight: 600;
  }

  #author,
  .time,
  #author-id {
    font-size: 13px;
    line-height: 16px;
    height: 16px;
  }

  .time:not(:empty)::before {
    content: 'Published on ';
    color: gray;
  }

  #author-id {
    font-family: monospace;
    color: gray;
  }

  .actions {
    display: flex;
  }

  .actions button {
    margin: 0 2px;
    padding: 6px;
    border: none;
    border-radius: 50%;
    height: 36px;
    background-color: #f8f8f8;
  }

  .actions button:hover {
    background-color: #dddddd;
  }

  .actions button svg {
    display: block;
    height: 24px;
    width: 24px;
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

  .hidden {
    display: none;
  }

  .count {
    position: relative;
  }

  .count[data-count]::before {
    content: attr(data-count);
    position: absolute;
    bottom: 0;
    left: 0;
    font-size: 13px;
    line-height: 13px;
    font-weight: 600;
    padding: 0 0 4px 4px;
    border-top-right-radius: 4px;
    /* color: #ff2f92; */
    background-color: #f8f8f8;
    background: linear-gradient(45deg, rgba(255,255,255,0) 0%, #f8f8f8 100%);
  }

  .count[data-count]:hover::before {
    background: linear-gradient(45deg, rgba(255, 255, 255, 0) 50%, rgba(221, 221, 221, 1) 100%);
  }
</style>
<div id="app">
  <div class="bar">
    <div class="info">
      <div class="name">${appDescription.content.name || appDescription.content.mentions[0].name || appDescription.content.comment || ''}</div>
      <div id="author"></div>
    </div>
    <div class="actions">
      <button id="like" class="svghover hidden count">
        <svg viewBox="0 0 24 24">
          <path fill="currentColor"
            d="M12.1,18.55L12,18.65L11.89,18.55C7.14,14.24 4,11.39 4,8.5C4,6.5 5.5,5 7.5,5C9.04,5 10.54,6 11.07,7.36H12.93C13.46,6 14.96,5 16.5,5C18.5,5 20,6.5 20,8.5C20,11.39 16.86,14.24 12.1,18.55M16.5,3C14.76,3 13.09,3.81 12,5.08C10.91,3.81 9.24,3 7.5,3C4.42,3 2,5.41 2,8.5C2,12.27 5.4,15.36 10.55,20.03L12,21.35L13.45,20.03C18.6,15.36 22,12.27 22,8.5C22,5.41 19.58,3 16.5,3Z" />
          <path class="onhover" fill="currentColor"
            d="M12.67 20.74L12 21.35L10.55 20.03C5.4 15.36 2 12.27 2 8.5C2 5.41 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.08C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.41 22 8.5C22 9.93 21.5 11.26 20.62 12.61C20 12.31 19.31 12.11 18.59 12.04C19.5 10.8 20 9.65 20 8.5C20 6.5 18.5 5 16.5 5C14.96 5 13.46 6 12.93 7.36H11.07C10.54 6 9.04 5 7.5 5C5.5 5 4 6.5 4 8.5C4 11.39 7.14 14.24 11.89 18.55L12 18.65L12.04 18.61C12.12 19.37 12.34 20.09 12.67 20.74M17 14V17H14V19H17V22H19V19H22V17H19V14H17Z" />
        </svg>
      </button>
      <button id="unlike" class="svghover hidden count">
        <svg viewBox="0 0 24 24">
          <path fill="currentColor"
            d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z" />
          <path class="onhover" fill="currentColor"
            d="M12 18C12 19 12.25 19.92 12.67 20.74L12 21.35L10.55 20.03C5.4 15.36 2 12.27 2 8.5C2 5.41 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.08C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.41 22 8.5C22 9.93 21.5 11.26 20.62 12.61C19.83 12.23 18.94 12 18 12C14.69 12 12 14.69 12 18M14 17V19H22V17H14Z" />
        </svg>
      </button>
      <button id="run">
        <svg viewBox="0 0 24 24">
          <path fill="currentColor" d="M8,5.14V19.14L19,12.14L8,5.14Z" />
        </svg>
      </button>
    </div>
  </div>
  <div class="details bar">
    <div class="info">
      <div class="comment">${appDescription.content.comment || ''}</div>
      <div id="author-id">${appDescription.author}</div>
      <div class="time">${(new Date(appDescription.timestamp)).toLocaleString() || ''}</div>
    </div>
    <div class="actions">
      <button id="revoke" class="hidden">
        <svg viewBox="0 0 24 24">
          <path fill="currentColor"
            d="M8.27,3L3,8.27V15.73L8.27,21H15.73L21,15.73V8.27L15.73,3M8.41,7L12,10.59L15.59,7L17,8.41L13.41,12L17,15.59L15.59,17L12,13.41L8.41,17L7,15.59L10.59,12L7,8.41" />
        </svg>
      </button>
      <button id="source">
        <svg viewBox="0 0 24 24">
          <path fill="currentColor"
            d="M13,9H18.5L13,3.5V9M6,2H14L20,8V20A2,2 0 0,1 18,22H6C4.89,22 4,21.1 4,20V4C4,2.89 4.89,2 6,2M6.12,15.5L9.86,19.24L11.28,17.83L8.95,15.5L11.28,13.17L9.86,11.76L6.12,15.5M17.28,15.5L13.54,11.76L12.12,13.17L14.45,15.5L12.12,17.83L13.54,19.24L17.28,15.5Z" />
        </svg>
      </button>
    </div>
  </div>
</div>`

    const appEl = controllerArea.getElementById('app')
    appEl.addEventListener('click', e => {
      appEl.classList.toggle('expanded')
    })

    const renderLikesStuff = () => {
      votesManager.getVotes(this.msg.key).then(likes => {
        const count = likes.length
        if (count > 0) {
          controllerArea.querySelectorAll('.count').forEach(e => e.setAttribute('data-count', count))
        } else {
          controllerArea.querySelectorAll('.count').forEach(e => e.removeAttribute('data-count'))
        }
      })
      
      votesManager.getOwnVote(this.msg.key).then(liked => {
        if (liked) {
          this.classList.add('liked')
          controllerArea.getElementById('like').classList.add('hidden')
          controllerArea.getElementById('unlike').classList.remove('hidden')
        } else {
          this.classList.remove('liked')
          controllerArea.getElementById('like').classList.remove('hidden')
          controllerArea.getElementById('unlike').classList.add('hidden')
        }
      }, e => {
        console.log("error getting own vote:", e)
      })
    }
    renderLikesStuff()

    this.sbot.whoami().then(
      currentUser => this.msg.value.author === currentUser.id)
      .then(own => {
        if (own) { 
          controllerArea.getElementById('revoke').classList.remove('hidden')
        }
      })
    
    
    ;(new IdentityManager(this.sbot)).getSelfAssignedName(appDescription.author).then(name => {
      controllerArea.getElementById('author').innerHTML = name
    }).catch(e => console.log(e));
    
    controllerArea.getElementById('run').addEventListener('click', e => {
      e.stopPropagation()
      this.dispatchEvent(new Event('run'));
    })
    controllerArea.getRootNode().getElementById('source').addEventListener('click', e => {
      e.stopPropagation()
      this.dispatchEvent(new Event('view-source'));
    })
    controllerArea.getRootNode().getElementById('like').addEventListener('click', async e => {
      e.stopPropagation()
      await votesManager.vote(this.msg.key, 1)
      renderLikesStuff()
      this.dispatchEvent(new Event('like'))
    })
    controllerArea.getRootNode().getElementById('unlike').addEventListener('click', async e => {
      e.stopPropagation()
      await votesManager.vote(this.msg.key, 0)
      renderLikesStuff()
      this.dispatchEvent(new Event('unlike'))
    })
    controllerArea.getRootNode().getElementById('revoke').addEventListener('click', async e => {
      e.stopPropagation()
      if (!confirm("Revoke App? This action cannot be undone.")) {
        return;
      }
      await this.revoke()
      this.parentElement.removeChild(this)
      this.dispatchEvent(new Event('revoked'))
    })
  }

  revoke() {
    return new Promise((resolve, reject) => {
      this.sbot.publish({
        type: 'about',
        about: this.msg.key,
        status: 'revoked'
      }, function (err, msg) {
        if (err) {
          reject(err)
        } else {
          resolve(true)
        }
      })
    })
  }
}

customElements.define("app-controller", AppController);
class FollowScuttleboot extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback() {
    const area = this.attachShadow({ mode: 'open' })
    area.innerHTML = `
    <div>
      You might see more apps by following an connecting to scuttleboot.app.
      <button id="follow">Follow scuttleboot.app</button>
    </div>`
    const button = area.getElementById('follow')
    button.addEventListener('click', () => {
      this.sbot.publish({
        "type": "contact",
        "following": true,
        "contact": "@luoZnBKHXeJl4kB39uIkZnQD4L0zl6Vd+Pe75gKS4fo=.ed25519"
      }, console.log)
      const multiAddr = 'wss://scuttleboot.app~shs:luoZnBKHXeJl4kB39uIkZnQD4L0zl6Vd+Pe75gKS4fo=;net:scuttleboot.app:8088~shs:luoZnBKHXeJl4kB39uIkZnQD4L0zl6Vd+Pe75gKS4fo='
      if (this.sbot.conn?.connect) {
        this.sbot.conn.remember(multiAddr)
        this.sbot.conn.connect(multiAddr, console.log)
      } else {
        if (this.sbot.gossip?.add) {
          this.sbot.gossip.add(multiAddr, console.log)
        }
      }
      area.innerHTML = ''
    });
  }
}

  customElements.define("follow-scuttleboot", FollowScuttleboot);
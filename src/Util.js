import { default as pull} from 'pull-stream'
import fetch from 'isomorphic-fetch'

export default class Util {

  constructor(sbot) {
    this.sbot = sbot
  }

  getBlob(blobId) {
    return new Promise((resolve, reject) => {
      this.sbot.blobs.want(blobId).then(() => {
        pull(
          this.sbot.blobs.get(blobId),
          pull.collect((err, values) => {
            if (err) reject(err)
            const code = values.join('')
            resolve(code)
          })
        )
      })
    })
  }
  
  dereferenceUriOrSigil(uriOrSigil) {
    if (uriOrSigil.startsWith('&')) {
      return this.getBlob(uriOrSigil)
    } else {
      return fetch(uriOrSigil).then(response => response.text())
    }
  }
}
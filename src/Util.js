import { default as pull } from 'pull-stream'
import fetch from 'isomorphic-fetch'

export default class Util {

  constructor(sbot) {
    this.sbot = sbot
  }

  getBlob(blobId) {
    function Utf8ArrayToStr(array) {
      return new Promise((resolve, reject) => {
        var bb = new Blob([array]);
        var f = new FileReader();
        f.onload = function(e) {
            resolve(e.target.result);
        };
        f.readAsText(bb);
      })
    }

    

    return new Promise((resolve, reject) => {
      this.sbot.blobs.want(blobId).then(() => {
        pull(
          this.sbot.blobs.get(blobId),
          pull.collect((err, values) => {
            if (err) reject(err)
            Promise.all(values.map(v => Utf8ArrayToStr(v))).then(s => s.join('')).then(resolve)
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
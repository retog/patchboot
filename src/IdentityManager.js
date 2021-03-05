import { default as pull, paraMap, collect } from 'pull-stream'
pull.paraMap = paraMap

class IdentityManager {

  constructor(sbot) {
    this.sbot = sbot
  }
  /** returns a promise for the self-assigned name of the user */
  getSelfAssignedName(id) {
    const queryOpts = {
      reverse: true,
      limit: 1,
      query: [{
        $filter: {
          value: {
            author: id,
            content: {
              type: 'about',
              about: id,
              name: { $is: 'string' }
            }
          }
        }
      },
      {
        $map: {
          name: ['value', 'content', 'name']
        }
      }]
    }
    const backlinksOpts = {
      reverse: true,
      limit: 1,
      query: [{
        $filter: {
          dest: id,
          value: {
            author: id,
            content: {
              type: 'about',
              about: id,
              name: { $is: 'string' }
            }
          }
        }
      },
      {
        $map: {
          name: ['value', 'content', 'name']
        }
      }]
    }
    return new Promise((resolve, reject) => {
      pull(
        this.sbot.backlinks ? this.sbot.backlinks.read(backlinksOpts) : this.sbot.query.read(queryOpts),
        collect((err, data) => {
          if (err) {
            reject(err);
          } else {
            if (data.length > 0) {
              resolve(data[0].name)
            } else {
              reject('the user hasn\'t assigned a name to themself yet');
            }
          }
        })
      )
    })
  }
}

const _IdentityManager = IdentityManager
export { _IdentityManager as IdentityManager }
var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getAugmentedNamespace(n) {
	if (n.__esModule) return n;
	var a = Object.defineProperty({}, '__esModule', {value: true});
	Object.keys(n).forEach(function (k) {
		var d = Object.getOwnPropertyDescriptor(n, k);
		Object.defineProperty(a, k, d.get ? d : {
			enumerable: true,
			get: function () {
				return n[k];
			}
		});
	});
	return a;
}

function createCommonjsModule(fn) {
  var module = { exports: {} };
	return fn(module, module.exports), module.exports;
}

var abortCb = function abortCb(cb, abort, onAbort) {
  cb(abort);
  onAbort && onAbort(abort === true ? null: abort);
  return
};

var values = function values (array, onAbort) {
  if(!array)
    return function (abort, cb) {
      if(abort) return abortCb(cb, abort, onAbort)
      return cb(true)
    }
  if(!Array.isArray(array))
    array = Object.keys(array).map(function (k) {
      return array[k]
    });
  var i = 0;
  return function (abort, cb) {
    if(abort)
      return abortCb(cb, abort, onAbort)
    if(i >= array.length)
      cb(true);
    else
      cb(null, array[i++]);
  }
};

var keys = function (object) {
  return values(Object.keys(object))
};

var once = function once (value, onAbort) {
  return function (abort, cb) {
    if(abort)
      return abortCb(cb, abort, onAbort)
    if(value != null) {
      var _value = value; value = null;
      cb(null, _value);
    } else
      cb(true);
  }
};

var count = function count (max) {
  var i = 0; max = max || Infinity;
  return function (end, cb) {
    if(end) return cb && cb(end)
    if(i > max)
      return cb(true)
    cb(null, i++);
  }
};

var infinite = function infinite (generate) {
  generate = generate || Math.random;
  return function (end, cb) {
    if(end) return cb && cb(end)
    return cb(null, generate())
  }
};

//a stream that ends immediately.
var empty = function empty () {
  return function (abort, cb) {
    cb(true);
  }
};

//a stream that errors immediately.
var error = function error (err) {
  return function (abort, cb) {
    cb(err);
  }
};

var sources = {
  keys: keys,
  once: once,
  values: values,
  count: count,
  infinite: infinite,
  empty: empty,
  error: error
};

var drain = function drain (op, done) {
  var read, abort;

  function sink (_read) {
    read = _read;
    if(abort) return sink.abort()
    //this function is much simpler to write if you
    //just use recursion, but by using a while loop
    //we do not blow the stack if the stream happens to be sync.
    ;(function next() {
        var loop = true, cbed = false;
        while(loop) {
          cbed = false;
          read(null, function (end, data) {
            cbed = true;
            if(end = end || abort) {
              loop = false;
              if(done) done(end === true ? null : end);
              else if(end && end !== true)
                throw end
            }
            else if(op && false === op(data) || abort) {
              loop = false;
              read(abort || true, done || function () {});
            }
            else if(!loop){
              next();
            }
          });
          if(!cbed) {
            loop = false;
            return
          }
        }
      })();
  }

  sink.abort = function (err, cb) {
    if('function' == typeof err)
      cb = err, err = true;
    abort = err || true;
    if(read) return read(abort, cb || function () {})
  };

  return sink
};

var onEnd = function onEnd (done) {
  return drain(null, done)
};

var log = function log (done) {
  return drain(function (data) {
    console.log(data);
  }, done)
};

var prop = function prop (key) {
  return key && (
    'string' == typeof key
    ? function (data) { return data[key] }
    : 'object' === typeof key && 'function' === typeof key.exec //regexp
    ? function (data) { var v = key.exec(data); return v && v[0] }
    : key
  )
};

function id (e) { return e }



var find = function find (test, cb) {
  var ended = false;
  if(!cb)
    cb = test, test = id;
  else
    test = prop(test) || id;

  return drain(function (data) {
    if(test(data)) {
      ended = true;
      cb(null, data);
    return false
    }
  }, function (err) {
    if(ended) return //already called back
    cb(err === true ? null : err, null);
  })
};

var reduce = function reduce (reducer, acc, cb ) {
  if(!cb) cb = acc, acc = null;
  var sink = drain(function (data) {
    acc = reducer(acc, data);
  }, function (err) {
    cb(err, acc);
  });
  if (arguments.length === 2)
    return function (source) {
      source(null, function (end, data) {
        //if ended immediately, and no initial...
        if(end) return cb(end === true ? null : end)
        acc = data; sink(source);
      });
    }
  else
    return sink
};

var collect = function collect (cb) {
  return reduce(function (arr, item) {
    arr.push(item);
    return arr
  }, [], cb)
};

var concat = function concat (cb) {
  return reduce(function (a, b) {
    return a + b
  }, '', cb)
};

var sinks = {
  drain: drain,
  onEnd: onEnd,
  log: log,
  find: find,
  reduce: reduce,
  collect: collect,
  concat: concat
};

function id$1 (e) { return e }


var map = function map (mapper) {
  if(!mapper) return id$1
  mapper = prop(mapper);
  return function (read) {
    return function (abort, cb) {
      read(abort, function (end, data) {
        try {
        data = !end ? mapper(data) : null;
        } catch (err) {
          return read(err, function () {
            return cb(err)
          })
        }
        cb(end, data);
      });
    }
  }
};

function id$2 (e) { return e }


var asyncMap = function asyncMap (map) {
  if(!map) return id$2
  map = prop(map);
  var busy = false, abortCb, aborted;
  return function (read) {
    return function next (abort, cb) {
      if(aborted) return cb(aborted)
      if(abort) {
        aborted = abort;
        if(!busy) read(abort, function (err) {
          //incase the source has already ended normally,
          //we should pass our own error.
          cb(abort);
        });
        else read(abort, function (err) {
          //if we are still busy, wait for the mapper to complete.
          if(busy) abortCb = cb;
          else cb(abort);
        });
      }
      else
        read(null, function (end, data) {
          if(end) cb(end);
          else if(aborted) cb(aborted);
          else {
            busy = true;
            map(data, function (err, data) {
              busy = false;
              if(aborted) {
                cb(aborted);
                abortCb && abortCb(aborted);
              }
              else if(err) next (err, cb);
              else cb(null, data);
            });
          }
        });
    }
  }
};

function id$3 (e) { return e }

var tester = function tester (test) {
  return (
    'object' === typeof test && 'function' === typeof test.test //regexp
    ? function (data) { return test.test(data) }
    : prop (test) || id$3
  )
};

var filter = function filter (test) {
  //regexp
  test = tester(test);
  return function (read) {
    return function next (end, cb) {
      var sync, loop = true;
      while(loop) {
        loop = false;
        sync = true;
        read(end, function (end, data) {
          if(!end && !test(data))
            return sync ? loop = true : next(end, cb)
          cb(end, data);
        });
        sync = false;
      }
    }
  }
};

var filterNot = function filterNot (test) {
  test = tester(test);
  return filter(function (data) { return !test(data) })
};

//a pass through stream that doesn't change the value.
var through = function through (op, onEnd) {
  var a = false;

  function once (abort) {
    if(a || !onEnd) return
    a = true;
    onEnd(abort === true ? null : abort);
  }

  return function (read) {
    return function (end, cb) {
      if(end) once(end);
      return read(end, function (end, data) {
        if(!end) op && op(data);
        else once(end);
        cb(end, data);
      })
    }
  }
};

//read a number of items and then stop.
var take = function take (test, opts) {
  opts = opts || {};
  var last = opts.last || false; // whether the first item for which !test(item) should still pass
  var ended = false;
  if('number' === typeof test) {
    last = true;
    var n = test; test = function () {
      return --n
    };
  }

  return function (read) {

    function terminate (cb) {
      read(true, function (err) {
        last = false; cb(err || true);
      });
    }

    return function (end, cb) {
      if(ended && !end) last ? terminate(cb) : cb(ended);
      else if(ended = end) read(ended, cb);
      else
        read(null, function (end, data) {
          if(ended = ended || end) {
            //last ? terminate(cb) :
            cb(ended);
          }
          else if(!test(data)) {
            ended = true;
            last ? cb(null, data) : terminate(cb);
          }
          else
            cb(null, data);
        });
    }
  }
};

function id$4 (e) { return e }



//drop items you have already seen.
var unique = function unique (field, invert) {
  field = prop(field) || id$4;
  var seen = {};
  return filter(function (data) {
    var key = field(data);
    if(seen[key]) return !!invert //false, by default
    else seen[key] = true;
    return !invert //true by default
  })
};

//passes an item through when you see it for the second time.
var nonUnique = function nonUnique (field) {
  return unique(field, true)
};

//convert a stream of arrays or streams into just a stream.
var flatten = function flatten () {
  return function (read) {
    var _read;
    return function (abort, cb) {
      if (abort) { //abort the current stream, and then stream of streams.
        _read ? _read(abort, function(err) {
          read(err || abort, cb);
        }) : read(abort, cb);
      }
      else if(_read) nextChunk();
      else nextStream();

      function nextChunk () {
        _read(null, function (err, data) {
          if (err === true) nextStream();
          else if (err) {
            read(true, function(abortErr) {
              // TODO: what do we do with the abortErr?
              cb(err);
            });
          }
          else cb(null, data);
        });
      }
      function nextStream () {
        _read = null;
        read(null, function (end, stream) {
          if(end)
            return cb(end)
          if(Array.isArray(stream) || stream && 'object' === typeof stream)
            stream = values(stream);
          else if('function' != typeof stream)
            stream = once(stream);
          _read = stream;
          nextChunk();
        });
      }
    }
  }
};

var throughs = {
  map: map,
  asyncMap: asyncMap,
  filter: filter,
  filterNot: filterNot,
  through: through,
  take: take,
  unique: unique,
  nonUnique: nonUnique,
  flatten: flatten
};

var pull = function pull (a) {
  var length = arguments.length;
  if (typeof a === 'function' && a.length === 1) {
    var args = new Array(length);
    for(var i = 0; i < length; i++)
      args[i] = arguments[i];
    return function (read) {
      if (args == null) {
        throw new TypeError("partial sink should only be called once!")
      }

      // Grab the reference after the check, because it's always an array now
      // (engines like that kind of consistency).
      var ref = args;
      args = null;

      // Prioritize common case of small number of pulls.
      switch (length) {
      case 1: return pull(read, ref[0])
      case 2: return pull(read, ref[0], ref[1])
      case 3: return pull(read, ref[0], ref[1], ref[2])
      case 4: return pull(read, ref[0], ref[1], ref[2], ref[3])
      default:
        ref.unshift(read);
        return pull.apply(null, ref)
      }
    }
  }

  var read = a;

  if (read && typeof read.source === 'function') {
    read = read.source;
  }

  for (var i = 1; i < length; i++) {
    var s = arguments[i];
    if (typeof s === 'function') {
      read = s(read);
    } else if (s && typeof s === 'object') {
      s.sink(read);
      read = s.source;
    }
  }

  return read
};

var pullStream = createCommonjsModule(function (module, exports) {





exports = module.exports = pull;

exports.pull = exports;

for(var k in sources)
  exports[k] = sources[k];

for(var k in throughs)
  exports[k] = throughs[k];

for(var k in sinks)
  exports[k] = sinks[k];
});

pullStream.paraMap = pullStream.paraMap;

class VotesManager {

  constructor(sbot) {
    this.sbot = sbot;
  }

  vote(id, value) {
    return new Promise((resolve, reject) => {
      this.sbot.publish({
        type: 'vote',
        vote: {
          'link': id,
          value,
          expression: value ? 'Like' : 'Unlike'
        }
      }, function (err, msg) {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    })
  }

  getVotes(id) {

    const queryOpts = {
      reverse: false,
      query: [{
        $filter: {
          value: {
            content: {
              type: 'vote',
              vote: {
                link: id
              }
            }
          }
        }
      },
      {
        $map: {
          author: ['value', 'author'],
          value: ['value', 'content', 'vote', 'value']
        }
      }]
    };
    const backlinksOpts = {
      reverse: false,
      query: [{
        $filter: {
          dest: id,
          value: {
            content: {
              type: 'vote',
              vote: {
                link: id
              }
            }
          }
        }
      },
      {
        $map: {
          author: ['value', 'author'],
          value: ['value', 'content', 'vote', 'value']
        }
      }]
    };

    const votesMapPromises = new Promise((resolve, reject) => {
      const votes = new Map();
      pullStream(
        this.sbot.backlinks ? this.sbot.backlinks.read(backlinksOpts) : this.sbot.query.read(queryOpts),
        /*pull.drain((msg) => {
          votes.set(msg.author, msg.value)
        },
        () => {
          resolve(votes);
        })*/
        pullStream.collect((err, msgs) => {
          if (err) {
            reject(err);
          } else {
            msgs.forEach(msg => {
              //console.log('msg', msg)
              votes.set(msg.author, msg.value);
            });
            resolve(votes);
          }
        })
      );
    });

    return votesMapPromises.then(votesMap => votesMap.entries())
      .then(entries => [...entries].filter(mapping => mapping[1] > 0))
      .then(filtered => filtered.map(tuple => tuple[0]))
  }

  getOwnVote(msgID) {
    return new Promise((resolve, reject) => {
      this.sbot.whoami().then(thisisme => {
        const feedID = thisisme.id;
        return this.getVotes(msgID).then(votes => {
          resolve(votes.indexOf(feedID) > -1);
        })
      }).catch(reject);
    })
  }

}

pullStream.paraMap = pullStream.paraMap;

class IdentityManager {

  constructor(sbot) {
    this.sbot = sbot;
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
    };
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
    };
    return new Promise((resolve, reject) => {
      pullStream(
        this.sbot.backlinks ? this.sbot.backlinks.read(backlinksOpts) : this.sbot.query.read(queryOpts),
        pullStream.collect((err, data) => {
          if (err) {
            reject(err);
          } else {
            if (data.length > 0) {
              resolve(data[0].name);
            } else {
              reject('the user hasn\'t assigned a name to themself yet');
            }
          }
        })
      );
    })
  }
}

const _IdentityManager = IdentityManager;

class AppController extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback() {
    const appDescription = this.msg.value;
    const votesManager = new VotesManager(this.sbot);
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

  .details .actions {
    float: right;
  }

  .actions {
    display: flex;
    margin-left: 6px;
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
      <button title="Like" id="like" class="svghover hidden count">
        <svg width="24" viewBox="0 0 24 24">
          <path fill="currentColor"
            d="M12.1,18.55L12,18.65L11.89,18.55C7.14,14.24 4,11.39 4,8.5C4,6.5 5.5,5 7.5,5C9.04,5 10.54,6 11.07,7.36H12.93C13.46,6 14.96,5 16.5,5C18.5,5 20,6.5 20,8.5C20,11.39 16.86,14.24 12.1,18.55M16.5,3C14.76,3 13.09,3.81 12,5.08C10.91,3.81 9.24,3 7.5,3C4.42,3 2,5.41 2,8.5C2,12.27 5.4,15.36 10.55,20.03L12,21.35L13.45,20.03C18.6,15.36 22,12.27 22,8.5C22,5.41 19.58,3 16.5,3Z" />
          <path class="onhover" fill="currentColor"
            d="M12.67 20.74L12 21.35L10.55 20.03C5.4 15.36 2 12.27 2 8.5C2 5.41 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.08C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.41 22 8.5C22 9.93 21.5 11.26 20.62 12.61C20 12.31 19.31 12.11 18.59 12.04C19.5 10.8 20 9.65 20 8.5C20 6.5 18.5 5 16.5 5C14.96 5 13.46 6 12.93 7.36H11.07C10.54 6 9.04 5 7.5 5C5.5 5 4 6.5 4 8.5C4 11.39 7.14 14.24 11.89 18.55L12 18.65L12.04 18.61C12.12 19.37 12.34 20.09 12.67 20.74M17 14V17H14V19H17V22H19V19H22V17H19V14H17Z" />
        </svg>
      </button>
      <button title="Unlike" id="unlike" class="svghover hidden count">
        <svg width="24" viewBox="0 0 24 24">
          <path fill="currentColor"
            d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z" />
          <path class="onhover" fill="currentColor"
            d="M12 18C12 19 12.25 19.92 12.67 20.74L12 21.35L10.55 20.03C5.4 15.36 2 12.27 2 8.5C2 5.41 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.08C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.41 22 8.5C22 9.93 21.5 11.26 20.62 12.61C19.83 12.23 18.94 12 18 12C14.69 12 12 14.69 12 18M14 17V19H22V17H14Z" />
        </svg>
      </button>
      <button title="Run" id="run">
        <svg width="24" viewBox="0 0 24 24">
          <path fill="currentColor" d="M8,5.14V19.14L19,12.14L8,5.14Z" />
        </svg>
      </button>
    </div>
  </div>
  <div class="details bar">
    <div class="info">
      <div class="actions">
        <button title="Revoke App" id="revoke" class="hidden">
          <svg width="24" viewBox="0 0 24 24">
            <path fill="currentColor"
              d="M8.27,3L3,8.27V15.73L8.27,21H15.73L21,15.73V8.27L15.73,3M8.41,7L12,10.59L15.59,7L17,8.41L13.41,12L17,15.59L15.59,17L12,13.41L8.41,17L7,15.59L10.59,12L7,8.41" />
          </svg>
        </button>
        <button title="View Source" id="source">
          <svg width="24" viewBox="0 0 24 24">
            <path fill="currentColor"
              d="M13,9H18.5L13,3.5V9M6,2H14L20,8V20A2,2 0 0,1 18,22H6C4.89,22 4,21.1 4,20V4C4,2.89 4.89,2 6,2M6.12,15.5L9.86,19.24L11.28,17.83L8.95,15.5L11.28,13.17L9.86,11.76L6.12,15.5M17.28,15.5L13.54,11.76L12.12,13.17L14.45,15.5L12.12,17.83L13.54,19.24L17.28,15.5Z" />
          </svg>
        </button>
      </div>
      <div class="comment">${appDescription.content.comment || ''}</div>
      <div id="author-id">${appDescription.author}</div>
      <div class="time">${(new Date(appDescription.timestamp)).toLocaleString() || ''}</div>
    </div>
  </div>
</div>`;

    const appEl = controllerArea.getElementById('app');
    appEl.addEventListener('click', e => {
      appEl.classList.toggle('expanded');
    });

    const renderLikesStuff = () => {
      votesManager.getVotes(this.msg.key).then(likes => {
        const count = likes.length;
        if (count > 0) {
          controllerArea.querySelectorAll('.count').forEach(e => e.setAttribute('data-count', count));
        } else {
          controllerArea.querySelectorAll('.count').forEach(e => e.removeAttribute('data-count'));
        }
      });
      
      votesManager.getOwnVote(this.msg.key).then(liked => {
        if (liked) {
          this.classList.add('liked');
          controllerArea.getElementById('like').classList.add('hidden');
          controllerArea.getElementById('unlike').classList.remove('hidden');
        } else {
          this.classList.remove('liked');
          controllerArea.getElementById('like').classList.remove('hidden');
          controllerArea.getElementById('unlike').classList.add('hidden');
        }
      }, e => {
        console.log("error getting own vote:", e);
      });
    };
    renderLikesStuff();

    this.sbot.whoami().then(
      currentUser => this.msg.value.author === currentUser.id)
      .then(own => {
        if (own) { 
          controllerArea.getElementById('revoke').classList.remove('hidden');
        }
      })
    
    
    ;(new _IdentityManager(this.sbot)).getSelfAssignedName(appDescription.author).then(name => {
      controllerArea.getElementById('author').innerHTML = name;
    }).catch(e => console.log(e));
    
    controllerArea.getElementById('run').addEventListener('click', e => {
      e.stopPropagation();
      this.dispatchEvent(new Event('run'));
    });
    controllerArea.getRootNode().getElementById('source').addEventListener('click', e => {
      e.stopPropagation();
      this.dispatchEvent(new Event('view-source'));
    });
    controllerArea.getRootNode().getElementById('like').addEventListener('click', async e => {
      e.stopPropagation();
      await votesManager.vote(this.msg.key, 1);
      renderLikesStuff();
      this.dispatchEvent(new Event('like'));
    });
    controllerArea.getRootNode().getElementById('unlike').addEventListener('click', async e => {
      e.stopPropagation();
      await votesManager.vote(this.msg.key, 0);
      renderLikesStuff();
      this.dispatchEvent(new Event('unlike'));
    });
    controllerArea.getRootNode().getElementById('revoke').addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm("Revoke App? This action cannot be undone.")) {
        return;
      }
      await this.revoke();
      this.parentElement.removeChild(this);
      this.dispatchEvent(new Event('revoked'));
    });
  }

  revoke() {
    return new Promise((resolve, reject) => {
      this.sbot.publish({
        type: 'about',
        about: this.msg.key,
        status: 'revoked'
      }, function (err, msg) {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    })
  }
}

customElements.define("app-controller", AppController);

class FollowScuttleboot extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback() {
    const area = this.attachShadow({ mode: 'open' });
    area.innerHTML = `
    <div>
      You might see more apps by following an connecting to scuttleboot.app.
      <button id="follow">Follow scuttleboot.app</button>
    </div>`;
    const button = area.getElementById('follow');
    button.addEventListener('click', () => {
      this.sbot.publish({
        "type": "contact",
        "following": true,
        "contact": "@luoZnBKHXeJl4kB39uIkZnQD4L0zl6Vd+Pe75gKS4fo=.ed25519"
      }, console.log);
      this.sbot.gossip.add('wss://scuttleboot.app~shs:luoZnBKHXeJl4kB39uIkZnQD4L0zl6Vd+Pe75gKS4fo=;net:scuttleboot.app:8088~shs:luoZnBKHXeJl4kB39uIkZnQD4L0zl6Vd+Pe75gKS4fo=', console.log);
      area.innerHTML = '';
    });
  }
}

  customElements.define("follow-scuttleboot", FollowScuttleboot);

class AppSelector extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback() {
    const controllerArea = this.attachShadow({ mode: 'open' });
    const view = document.getElementById('view');
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
    };
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
    <label class="top"><input type="checkbox" id="showLiked" />Show only apps I like</label>`;
    const appsGrid = document.createElement('div');
    appsGrid.id = 'apps';
    controllerArea.appendChild(appsGrid);
    this.sbot.whoami().then(keys => this.sbot.friends.isFollowing({
      source: keys.id,
      dest: '@luoZnBKHXeJl4kB39uIkZnQD4L0zl6Vd+Pe75gKS4fo=.ed25519'
    })).then(followingSboot => {
      if (!followingSboot) {
        const followScuttleboot = document.createElement('follow-scuttleboot');
        followScuttleboot.sbot = this.sbot;
        controllerArea.append(followScuttleboot);
      } else {
        console.log('Allready following scuttleboot.app');
      }
    });
    const showLikedcheckbox = controllerArea.getElementById('showLiked');
    showLikedcheckbox.addEventListener('change', (e) => {
      if (showLikedcheckbox.checked) {
        appsGrid.classList.add('show-only-liked');
      } else {
        appsGrid.classList.remove('show-only-liked');
      }

    });
    const sbot = this.sbot;
    pullStream(sbot.query.read(opts), pullStream.drain((msg) => {
      if (!msg.value) {
        return;
      }
      ensureNotRevoked(sbot, msg).then(() => {
        const controller = document.createElement('app-controller');
        controller.msg = msg;
        controller.sbot = sbot;
        appsGrid.insertBefore(controller, appsGrid.firstChild);
        const blobId = msg.value.content.link || msg.value.content.mentions[0].link;
        controller.addEventListener('run', () => {
          this.dispatchEvent(new CustomEvent('run', {detail: msg.value.content}));
        });
        controller.addEventListener('view-source', () => {
          this.dispatchEvent(new CustomEvent('show-source', {detail: msg.value.content}));
        });
        controller.addEventListener('like', async () => {
          try {
            console.log(await VotesManager.getVotes(msg.key));
          } catch (e) {
            console.log('error', e);
          }
          return true
        });
        controller.addEventListener('unlike', () => {
          //vote(msg.key, 0)
        });
      }).catch(() => { });
    }, () => console.log('End of apps stream reached.')));

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
    };
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
    };
    pullStream(
      sbot.backlinks ? sbot.backlinks.read(backlinksOpts) : sbot.query.read(queryOpts),
      pullStream.collect((err, revocations) => {
      if (err) {
        reject(err);
      } else {
        if (revocations.length > 0) {
          reject();
        } else {
          resolve();
        }
      }
    }));
  })
}


customElements.define("app-selector", AppSelector);

var global$1 = (typeof global !== "undefined" ? global :
            typeof self !== "undefined" ? self :
            typeof window !== "undefined" ? window : {});

var lookup = [];
var revLookup = [];
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;
var inited = false;
function init () {
  inited = true;
  var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (var i = 0, len = code.length; i < len; ++i) {
    lookup[i] = code[i];
    revLookup[code.charCodeAt(i)] = i;
  }

  revLookup['-'.charCodeAt(0)] = 62;
  revLookup['_'.charCodeAt(0)] = 63;
}

function toByteArray (b64) {
  if (!inited) {
    init();
  }
  var i, j, l, tmp, placeHolders, arr;
  var len = b64.length;

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0;

  // base64 is 4/3 + up to two characters of the original data
  arr = new Arr(len * 3 / 4 - placeHolders);

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len;

  var L = 0;

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)];
    arr[L++] = (tmp >> 16) & 0xFF;
    arr[L++] = (tmp >> 8) & 0xFF;
    arr[L++] = tmp & 0xFF;
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4);
    arr[L++] = tmp & 0xFF;
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2);
    arr[L++] = (tmp >> 8) & 0xFF;
    arr[L++] = tmp & 0xFF;
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp;
  var output = [];
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
    output.push(tripletToBase64(tmp));
  }
  return output.join('')
}

function fromByteArray (uint8) {
  if (!inited) {
    init();
  }
  var tmp;
  var len = uint8.length;
  var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
  var output = '';
  var parts = [];
  var maxChunkLength = 16383; // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1];
    output += lookup[tmp >> 2];
    output += lookup[(tmp << 4) & 0x3F];
    output += '==';
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1]);
    output += lookup[tmp >> 10];
    output += lookup[(tmp >> 4) & 0x3F];
    output += lookup[(tmp << 2) & 0x3F];
    output += '=';
  }

  parts.push(output);

  return parts.join('')
}

function read (buffer, offset, isLE, mLen, nBytes) {
  var e, m;
  var eLen = nBytes * 8 - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var nBits = -7;
  var i = isLE ? (nBytes - 1) : 0;
  var d = isLE ? -1 : 1;
  var s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

function write (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c;
  var eLen = nBytes * 8 - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0);
  var i = isLE ? 0 : (nBytes - 1);
  var d = isLE ? 1 : -1;
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128;
}

var toString = {}.toString;

var isArray = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

var INSPECT_MAX_BYTES = 50;

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global$1.TYPED_ARRAY_SUPPORT !== undefined
  ? global$1.TYPED_ARRAY_SUPPORT
  : true;

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length);
    that.__proto__ = Buffer.prototype;
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length);
    }
    that.length = length;
  }

  return that
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192; // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype;
  return arr
};

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length)
};

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype;
  Buffer.__proto__ = Uint8Array;
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size);
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
};

function allocUnsafe (that, size) {
  assertSize(size);
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0);
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0;
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
};
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
};

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8';
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0;
  that = createBuffer(that, length);

  var actual = that.write(string, encoding);

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    that = that.slice(0, actual);
  }

  return that
}

function fromArrayLike (that, array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0;
  that = createBuffer(that, length);
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255;
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength; // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (byteOffset === undefined && length === undefined) {
    array = new Uint8Array(array);
  } else if (length === undefined) {
    array = new Uint8Array(array, byteOffset);
  } else {
    array = new Uint8Array(array, byteOffset, length);
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array;
    that.__proto__ = Buffer.prototype;
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array);
  }
  return that
}

function fromObject (that, obj) {
  if (internalIsBuffer(obj)) {
    var len = checked(obj.length) | 0;
    that = createBuffer(that, len);

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len);
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength()` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}
Buffer.isBuffer = isBuffer;
function internalIsBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!internalIsBuffer(a) || !internalIsBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length;
  var y = b.length;

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
};

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
};

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i;
  if (length === undefined) {
    length = 0;
    for (i = 0; i < list.length; ++i) {
      length += list[i].length;
    }
  }

  var buffer = Buffer.allocUnsafe(length);
  var pos = 0;
  for (i = 0; i < list.length; ++i) {
    var buf = list[i];
    if (!internalIsBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos);
    pos += buf.length;
  }
  return buffer
};

function byteLength (string, encoding) {
  if (internalIsBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string;
  }

  var len = string.length;
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false;
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase();
        loweredCase = true;
    }
  }
}
Buffer.byteLength = byteLength;

function slowToString (encoding, start, end) {
  var loweredCase = false;

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0;
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length;
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0;
  start >>>= 0;

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8';

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase();
        loweredCase = true;
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true;

function swap (b, n, m) {
  var i = b[n];
  b[n] = b[m];
  b[m] = i;
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length;
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1);
  }
  return this
};

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length;
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3);
    swap(this, i + 1, i + 2);
  }
  return this
};

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length;
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7);
    swap(this, i + 1, i + 6);
    swap(this, i + 2, i + 5);
    swap(this, i + 3, i + 4);
  }
  return this
};

Buffer.prototype.toString = function toString () {
  var length = this.length | 0;
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
};

Buffer.prototype.equals = function equals (b) {
  if (!internalIsBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
};

Buffer.prototype.inspect = function inspect () {
  var str = '';
  var max = INSPECT_MAX_BYTES;
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ');
    if (this.length > max) str += ' ... ';
  }
  return '<Buffer ' + str + '>'
};

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!internalIsBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0;
  }
  if (end === undefined) {
    end = target ? target.length : 0;
  }
  if (thisStart === undefined) {
    thisStart = 0;
  }
  if (thisEnd === undefined) {
    thisEnd = this.length;
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0;
  end >>>= 0;
  thisStart >>>= 0;
  thisEnd >>>= 0;

  if (this === target) return 0

  var x = thisEnd - thisStart;
  var y = end - start;
  var len = Math.min(x, y);

  var thisCopy = this.slice(thisStart, thisEnd);
  var targetCopy = target.slice(start, end);

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i];
      y = targetCopy[i];
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
};

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset;
    byteOffset = 0;
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff;
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000;
  }
  byteOffset = +byteOffset;  // Coerce to Number.
  if (isNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1);
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1;
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0;
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding);
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (internalIsBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF; // Search for a byte value [0-255]
    if (Buffer.TYPED_ARRAY_SUPPORT &&
        typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1;
  var arrLength = arr.length;
  var valLength = val.length;

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase();
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2;
      arrLength /= 2;
      valLength /= 2;
      byteOffset /= 2;
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i;
  if (dir) {
    var foundIndex = -1;
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i;
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex;
        foundIndex = -1;
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
    for (i = byteOffset; i >= 0; i--) {
      var found = true;
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false;
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
};

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
};

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
};

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0;
  var remaining = buf.length - offset;
  if (!length) {
    length = remaining;
  } else {
    length = Number(length);
    if (length > remaining) {
      length = remaining;
    }
  }

  // must be an even number of digits
  var strLen = string.length;
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2;
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16);
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed;
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8';
    length = this.length;
    offset = 0;
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset;
    length = this.length;
    offset = 0;
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0;
    if (isFinite(length)) {
      length = length | 0;
      if (encoding === undefined) encoding = 'utf8';
    } else {
      encoding = length;
      length = undefined;
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset;
  if (length === undefined || length > remaining) length = remaining;

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8';

  var loweredCase = false;
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase();
        loweredCase = true;
    }
  }
};

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
};

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return fromByteArray(buf)
  } else {
    return fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end);
  var res = [];

  var i = start;
  while (i < end) {
    var firstByte = buf[i];
    var codePoint = null;
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1;

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint;

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte;
          }
          break
        case 2:
          secondByte = buf[i + 1];
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F);
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint;
            }
          }
          break
        case 3:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F);
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint;
            }
          }
          break
        case 4:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          fourthByte = buf[i + 3];
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F);
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint;
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD;
      bytesPerSequence = 1;
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000;
      res.push(codePoint >>> 10 & 0x3FF | 0xD800);
      codePoint = 0xDC00 | codePoint & 0x3FF;
    }

    res.push(codePoint);
    i += bytesPerSequence;
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000;

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length;
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = '';
  var i = 0;
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    );
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = '';
  end = Math.min(buf.length, end);

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F);
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = '';
  end = Math.min(buf.length, end);

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i]);
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length;

  if (!start || start < 0) start = 0;
  if (!end || end < 0 || end > len) end = len;

  var out = '';
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i]);
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end);
  var res = '';
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length;
  start = ~~start;
  end = end === undefined ? len : ~~end;

  if (start < 0) {
    start += len;
    if (start < 0) start = 0;
  } else if (start > len) {
    start = len;
  }

  if (end < 0) {
    end += len;
    if (end < 0) end = 0;
  } else if (end > len) {
    end = len;
  }

  if (end < start) end = start;

  var newBuf;
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end);
    newBuf.__proto__ = Buffer.prototype;
  } else {
    var sliceLen = end - start;
    newBuf = new Buffer(sliceLen, undefined);
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start];
    }
  }

  return newBuf
};

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);

  var val = this[offset];
  var mul = 1;
  var i = 0;
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul;
  }

  return val
};

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length);
  }

  var val = this[offset + --byteLength];
  var mul = 1;
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul;
  }

  return val
};

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length);
  return this[offset]
};

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  return this[offset] | (this[offset + 1] << 8)
};

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  return (this[offset] << 8) | this[offset + 1]
};

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
};

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
};

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);

  var val = this[offset];
  var mul = 1;
  var i = 0;
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul;
  }
  mul *= 0x80;

  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

  return val
};

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);

  var i = byteLength;
  var mul = 1;
  var val = this[offset + --i];
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul;
  }
  mul *= 0x80;

  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

  return val
};

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length);
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
};

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  var val = this[offset] | (this[offset + 1] << 8);
  return (val & 0x8000) ? val | 0xFFFF0000 : val
};

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  var val = this[offset + 1] | (this[offset] << 8);
  return (val & 0x8000) ? val | 0xFFFF0000 : val
};

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
};

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
};

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);
  return read(this, offset, true, 23, 4)
};

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);
  return read(this, offset, false, 23, 4)
};

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length);
  return read(this, offset, true, 52, 8)
};

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length);
  return read(this, offset, false, 52, 8)
};

function checkInt (buf, value, offset, ext, max, min) {
  if (!internalIsBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1;
    checkInt(this, value, offset, byteLength, maxBytes, 0);
  }

  var mul = 1;
  var i = 0;
  this[offset] = value & 0xFF;
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF;
  }

  return offset + byteLength
};

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1;
    checkInt(this, value, offset, byteLength, maxBytes, 0);
  }

  var i = byteLength - 1;
  var mul = 1;
  this[offset + i] = value & 0xFF;
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF;
  }

  return offset + byteLength
};

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
  this[offset] = (value & 0xff);
  return offset + 1
};

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1;
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8;
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff);
    this[offset + 1] = (value >>> 8);
  } else {
    objectWriteUInt16(this, value, offset, true);
  }
  return offset + 2
};

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8);
    this[offset + 1] = (value & 0xff);
  } else {
    objectWriteUInt16(this, value, offset, false);
  }
  return offset + 2
};

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1;
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff;
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24);
    this[offset + 2] = (value >>> 16);
    this[offset + 1] = (value >>> 8);
    this[offset] = (value & 0xff);
  } else {
    objectWriteUInt32(this, value, offset, true);
  }
  return offset + 4
};

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24);
    this[offset + 1] = (value >>> 16);
    this[offset + 2] = (value >>> 8);
    this[offset + 3] = (value & 0xff);
  } else {
    objectWriteUInt32(this, value, offset, false);
  }
  return offset + 4
};

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1);

    checkInt(this, value, offset, byteLength, limit - 1, -limit);
  }

  var i = 0;
  var mul = 1;
  var sub = 0;
  this[offset] = value & 0xFF;
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1;
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
  }

  return offset + byteLength
};

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1);

    checkInt(this, value, offset, byteLength, limit - 1, -limit);
  }

  var i = byteLength - 1;
  var mul = 1;
  var sub = 0;
  this[offset + i] = value & 0xFF;
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1;
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
  }

  return offset + byteLength
};

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
  if (value < 0) value = 0xff + value + 1;
  this[offset] = (value & 0xff);
  return offset + 1
};

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff);
    this[offset + 1] = (value >>> 8);
  } else {
    objectWriteUInt16(this, value, offset, true);
  }
  return offset + 2
};

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8);
    this[offset + 1] = (value & 0xff);
  } else {
    objectWriteUInt16(this, value, offset, false);
  }
  return offset + 2
};

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff);
    this[offset + 1] = (value >>> 8);
    this[offset + 2] = (value >>> 16);
    this[offset + 3] = (value >>> 24);
  } else {
    objectWriteUInt32(this, value, offset, true);
  }
  return offset + 4
};

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
  if (value < 0) value = 0xffffffff + value + 1;
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24);
    this[offset + 1] = (value >>> 16);
    this[offset + 2] = (value >>> 8);
    this[offset + 3] = (value & 0xff);
  } else {
    objectWriteUInt32(this, value, offset, false);
  }
  return offset + 4
};

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4);
  }
  write(buf, value, offset, littleEndian, 23, 4);
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
};

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
};

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8);
  }
  write(buf, value, offset, littleEndian, 52, 8);
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
};

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
};

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0;
  if (!end && end !== 0) end = this.length;
  if (targetStart >= target.length) targetStart = target.length;
  if (!targetStart) targetStart = 0;
  if (end > 0 && end < start) end = start;

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length;
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start;
  }

  var len = end - start;
  var i;

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start];
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start];
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    );
  }

  return len
};

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start;
      start = 0;
      end = this.length;
    } else if (typeof end === 'string') {
      encoding = end;
      end = this.length;
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0);
      if (code < 256) {
        val = code;
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255;
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0;
  end = end === undefined ? this.length : end >>> 0;

  if (!val) val = 0;

  var i;
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val;
    }
  } else {
    var bytes = internalIsBuffer(val)
      ? val
      : utf8ToBytes(new Buffer(val, encoding).toString());
    var len = bytes.length;
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len];
    }
  }

  return this
};

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g;

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '');
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '=';
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity;
  var codePoint;
  var length = string.length;
  var leadSurrogate = null;
  var bytes = [];

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i);

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
          continue
        }

        // valid lead
        leadSurrogate = codePoint;

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
        leadSurrogate = codePoint;
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
    }

    leadSurrogate = null;

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      );
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      );
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      );
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = [];
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF);
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo;
  var byteArray = [];
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i);
    hi = c >> 8;
    lo = c % 256;
    byteArray.push(lo);
    byteArray.push(hi);
  }

  return byteArray
}


function base64ToBytes (str) {
  return toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i];
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}


// the following is from is-buffer, also by Feross Aboukhadijeh and with same lisence
// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
function isBuffer(obj) {
  return obj != null && (!!obj._isBuffer || isFastBuffer(obj) || isSlowBuffer(obj))
}

function isFastBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isFastBuffer(obj.slice(0, 0))
}

var looper_1 = createCommonjsModule(function (module) {
var looper = module.exports = function (fun) {
  (function next () {
    var loop = true, sync = false;
    do {
      sync = true; loop = false;
      fun.call(this, function () {
        if(sync) loop = true;
        else     next();
      });
      sync = false;
    } while(loop)
  })();
};
});

var pullThrough = function (writer, ender) {
  return function (read) {
    var queue = [], ended, error;

    function enqueue (data) {
      queue.push(data);
    }

    writer = writer || function (data) {
      this.queue(data);
    };

    ender = ender || function () {
      this.queue(null);
    };

    var emitter = {
      emit: function (event, data) {
        if(event == 'data') enqueue(data);
        if(event == 'end')  ended = true, enqueue(null);
        if(event == 'error') error = data;
      },
      queue: enqueue
    };
    var _cb;
    return function (end, cb) {
      ended = ended || end;
      if(end)
        return read(end, function () {
          if(_cb) {
            var t = _cb; _cb = null; t(end);
          }
          cb(end);
        })

      _cb = cb;
      looper_1(function pull (next) {
        //if it's an error
        if(!_cb) return
        cb = _cb;
        if(error) _cb = null, cb(error);
        else if(queue.length) {
          var data = queue.shift();
          _cb = null,cb(data === null, data);
        }
        else {
          read(ended, function (end, data) {
             //null has no special meaning for pull-stream
            if(end && end !== true) {
              error = end; return next()
            }
            if(ended = ended || end)  ender.call(emitter);
            else if(data !== null) {
              writer.call(emitter, data);
              if(error || ended)
                return read(error || ended, function () {
                  _cb = null; cb(error || ended);
                })
            }
            next(pull);
          });
        }
      });
    }
  }
};

var state = function () {

  var buffers = [], length = 0;

  return {
    length: length,
    data: this,
    add: function (data) {
      if(!isBuffer(data))
        throw new Error('data must be a buffer, was: ' + JSON.stringify(data))
      this.length = length = length + data.length;
      buffers.push(data);
      return this
    },
    has: function (n) {
      if(null == n) return length > 0
      return length >= n
    },
    get: function (n) {
      var _length;
      if(n == null || n === length) {
        length = 0;
        var _buffers = buffers;
        buffers = [];
        if(_buffers.length == 1)
          return _buffers[0]
        else
          return Buffer.concat(_buffers)
      } else if (buffers.length > 1 && n <= (_length = buffers[0].length)) {
        var buf = buffers[0].slice(0, n);
        if(n === _length) {
          buffers.shift();
        }
        else {
          buffers[0] = buffers[0].slice(n, _length);
        }
        length -= n;
        return buf
      }  else if(n < length) {
        var out = [], len = 0;

        while((len + buffers[0].length) < n) {
          var b = buffers.shift();
          len += b.length;
          out.push(b);
        }

        if(len < n) {
          out.push(buffers[0].slice(0, n - len));
          buffers[0] = buffers[0].slice(n - len, buffers[0].length);
          this.length = length = length - n;
        }
        return Buffer.concat(out)
      }
      else
        throw new Error('could not get ' + n + ' bytes')
    }
  }

};

function isInteger (i) {
  return Number.isFinite(i)
}

function isFunction (f) {
  return 'function' === typeof f
}

function maxDelay(fn, delay) {
  if(!delay) return fn
  return function (a, cb) {
    var timer = setTimeout(function () {
      fn(new Error('pull-reader: read exceeded timeout'), cb);
    }, delay);
    fn(a, function (err, value) {
      clearTimeout(timer);
      cb(err, value);
    });

  }

}

var pullReader = function (timeout) {

  var queue = [], read, readTimed, reading = false;
  var state$1 = state(), ended, streaming, abort;

  function drain () {
    while (queue.length) {
      if(null == queue[0].length && state$1.has(1)) {
        queue.shift().cb(null, state$1.get());
      }
      else if(state$1.has(queue[0].length)) {
        var next = queue.shift();
        next.cb(null, state$1.get(next.length));
      }
      else if(ended == true && queue[0].length && state$1.length < queue[0].length) {
        var msg = 'stream ended with:'+state$1.length+' but wanted:'+queue[0].length;
        queue.shift().cb(new Error(msg));
      }
      else if(ended)
        queue.shift().cb(ended);
      else
        return !!queue.length
    }
    //always read a little data
    return queue.length || !state$1.has(1) || abort
  }

  function more () {
    var d = drain();
    if(d && !reading)
    if(read && !reading && !streaming) {
      reading = true;
      readTimed (null, function (err, data) {
        reading = false;
        if(err) {
          ended = err;
          return drain()
        }
        state$1.add(data);
        more();
      });
    }
  }

  function reader (_read) {
    if(abort) {
      while(queue.length) queue.shift().cb(abort);
      return cb && cb(abort)
    }
    readTimed = maxDelay(_read, timeout);
    read = _read;
    more();
  }

  reader.abort = function (err, cb) {
    abort = err || true;
    if(read) {
      reading = true;
      read(abort, function () {
        while(queue.length) queue.shift().cb(abort);
        cb && cb(abort);
      });
    }
    else
      cb();
  };

  reader.read = function (len, _timeout, cb) {
    if(isFunction(_timeout))
      cb = _timeout, _timeout = timeout;
    if(isFunction(cb)) {
      queue.push({length: isInteger(len) ? len : null, cb: cb});
      more();
    }
    else {
      //switch into streaming mode for the rest of the stream.
      streaming = true;
      //wait for the current read to complete
      return function (abort, cb) {
        //if there is anything still in the queue,
        if(reading || state$1.has(1)) {
          if(abort) return read(abort, cb)
          queue.push({length: null, cb: cb});
          more();
        }
        else
          maxDelay(read, _timeout)(abort, function (err, data) {
            cb(err, data);
          });
      }
    }
  };

  return reader
};

var packetStreamCodec = createCommonjsModule(function (module, exports) {
var BUFFER = 0, STRING = 1, OBJECT = 2;

var GOODBYE = 'GOODBYE';
var isBuffer$1 = isBuffer;

function isString (s) {
  return 'string' === typeof s
}

function encodePair (msg) {

  var head = Buffer.alloc(9);
  var flags = 0;
  var value = msg.value !== undefined ? msg.value : msg.end;

  //final packet
  if(isString(msg) && msg === GOODBYE) {
    head.fill(0);
    return [head, null]
  }

  if(isString(value)) {
    flags = STRING;
    value = Buffer.from(value, 'utf-8');
  }
  else if(isBuffer$1(value)) {
    flags = BUFFER;
  }
  else {
    flags = OBJECT;
    value = Buffer.from(JSON.stringify(value), 'utf-8');
  }

  // does this frame represent a msg, a req, or a stream?

  //end, stream

  flags = msg.stream << 3 | msg.end << 2 | flags;

  head[0] = flags;

  head.writeUInt32BE(value.length, 1);
  head.writeInt32BE(msg.req || 0, 5);

  return [head, value]
}

function decodeHead (bytes) {
  if(bytes.length != 9)
    throw new Error('expected header to be 9 bytes long')
  var flags = bytes[0];
  var length = bytes.readUInt32BE(1);
  var req = bytes.readInt32BE(5);

  return {
    req    : req,
    stream : !!(flags & 8),
    end    : !!(flags & 4),
    value  : null,
    length : length,
    type   : flags & 3
  }
}

function decodeBody (bytes, msg) {
  if(bytes.length !== msg.length)
    throw new Error('incorrect length, expected:'+msg.length+' found:'+bytes.length)
  if(BUFFER === msg.type) msg.value = bytes;
  else if(STRING === msg.type) msg.value = bytes.toString();
  else if(OBJECT === msg.type) msg.value = JSON.parse(bytes.toString());
  else throw new Error('unknown message type')
  return msg
}

function encode () {
  return pullThrough(function (d) {
    var c = encodePair(d);
    this.queue(c[0]);
    if(c[1] !== null)
      this.queue(c[1]);
  })
}

function decode () {
  var reader = pullReader(), ended = false;

  return function (read) {
    reader(read);

    return function (abort, cb) {
      if(ended) return cb(true)
      if(abort) return reader.abort(abort, cb)
      reader.read(9, function (err, head) {
        if(err) return cb(err)
        var msg = decodeHead(head);
        if(msg.length === 0) { //final packet
          ended = true;
          return cb(null, GOODBYE)
        }
        reader.read(msg.length, function (err, body) {
          if(err) return cb(err)
          try {
            decodeBody(body, msg);
          } catch(e) {
            return cb(e)
          }
          cb(null, msg);
        });
      });
    }
  }
}

exports = module.exports = function (stream) {
  return {
    source: encode()(stream.source),
    sink: function (read) { return stream.sink(decode()(read)) }
  }
};

exports.encodePair = encodePair;
exports.decodeHead = decodeHead;
exports.decodeBody = decodeBody;

exports.encode = encode;
exports.decode = decode;
});

function flat(err) {
  if(!err) return err
  if(err === true) return true
  return {message: err.message, name: err.name, stack: err.stack}
}

var packetStream = function (opts) {
  return new PacketStream(opts)
};

function PacketStream (opts) {
  this.ended = false;
  this.opts  = opts; // must release, may capture `this`

  this._req_counter = 1;
  this._requests    = {}; // must release, may capture `this`
  this._instreams   = {}; // must release, may capture `this`
  this._outstreams  = {}; // must release, may capture `this`
  this._closecbs    = []; // must release, may capture `this`
  this._closing     = false;
  this._closed      = false;
  if (opts.close)
    this._closecbs.push(opts.close);
}

// Sends a single message to the other end
PacketStream.prototype.message = function (obj) {
  this.read({req: 0, stream: false, end: false, value: obj});
};

// Sends a message to the other end, expects an (err, obj) response
PacketStream.prototype.request = function (obj, cb) {
  if (this._closing) return cb(new Error('parent stream is closing'))
  var rid = this._req_counter++;
  var self = this;
  this._requests[rid] = function (err, value) {
    delete self._requests[rid];
    cb(err, value);
    self._maybedone(err);
  };
  this.read({ req:rid, stream: false, end: false, value: obj });
};

// Sends a request to the other end for a stream
PacketStream.prototype.stream = function () {
  if (this._closing) throw new Error('parent stream is closing')
  var rid = this._req_counter++;
  var self = this;
  this._outstreams[rid] = new PacketStreamSubstream(rid, this, function() { delete self._outstreams[rid]; });
  return this._outstreams[rid]
};

// Marks the packetstream to close when all current IO is finished
PacketStream.prototype.close = function (cb) {
  if(!cb) throw new Error('packet-stream.close *must* have callback')
  if (this._closed)
    return cb()
  this._closecbs.push(cb);
  this._closing = true;
  this._maybedone();
};

// Forces immediate close of the PacketStream
// - usually triggered by an `end` packet from the other end
PacketStream.prototype.destroy = function (end) {
  end = end || flat(end);
  this.ended = end;
  this._closing = true;

  var err = (end === true)
    ? new Error('unexpected end of parent stream')
    : end;

  // force-close all requests and substreams
  var numended = 0;
  for (var k in this._requests)   { numended++; this._requests[k](err); }
  for (var k in this._instreams)  {
    numended++;
    // destroy substream without sending it a message
    this._instreams[k].writeEnd = true;
    this._instreams[k].destroy(err);
  }
  for (var k in this._outstreams) {
    numended++;
    // destroy substream without sending it a message
    this._outstreams[k].writeEnd = true;
    this._outstreams[k].destroy(err);
  }

  //from the perspective of the outside stream it's not an error
  //if the stream was in a state that where end was okay. (no open requests/streams)
  if (numended === 0 && end === true)
    err = null;
  this._maybedone(err);
};

PacketStream.prototype._maybedone = function (err) {
  if (this._closed || !this._closing)
    return

  // check if all requests and streams finished
  if (Object.keys(this._requests).length !== 0 ||
      Object.keys(this._instreams).length !== 0 ||
      Object.keys(this._outstreams).length !== 0)
    return // not yet

  // close
  this._closed = true;
  this._closecbs.forEach(function (cb) { cb(err); });
  this.read(null, err || true);

  // deallocate
  this.opts = null;
  this._closecbs.length = 0;
  this.read = closedread;
};

function closedread (msg) {
  console.error('packet-stream asked to read after closed', msg);
}

// Sends data out to the other end
// - to be overridden by the PacketStream consumer
PacketStream.prototype.read = function (msg) {
  console.error('please overwrite read method to do IO', msg);
};

// Accepts data from the other end
PacketStream.prototype.write = function (msg, end) {
  if (this.ended)
    return

  if (end)                         this.destroy(end);
  else if (msg.req && !msg.stream) this._onrequest(msg);
  else if (msg.req && msg.stream)  this._onstream(msg);
  else                             this._onmessage(msg);
};

// Internal handler of incoming message msgs
PacketStream.prototype._onmessage = function (msg) {
  if (this.opts && 'function' === typeof this.opts.message)
    this.opts.message(msg.value);
};

// Internal handler of incoming request msgs
PacketStream.prototype._onrequest = function (msg) {
  var rid = msg.req*-1;
  if(msg.req < 0) {
    // A incoming response
    if (typeof this._requests[rid] == 'function')
      this._requests[rid](
        msg.end ? msg.value: null,
        msg.end ? null : msg.value
      );
  }
  else {
    // An incoming request
    if (this.opts && typeof this.opts.request == 'function') {
      var once = false;
      var self = this;
      this.opts.request(msg.value, function (err, value) {
        if(once) throw new Error('cb called twice from local api')
        once = true;
        if(err) self.read({ value: flat(err), end: true, req: rid });
        else    self.read({ value: value, end: false, req: rid });
        self._maybedone();
      });
    } else {
      if (this.ended) {
        var err = (this.ended === true)
          ? new Error('unexpected end of parent stream')
          : this.ended;
        this.read({ value: flat(err), end: true, stream: false, req: rid });
      }
      else
        this.read({ value: {
            message: 'Unable to handle requests',
            name: 'NO_REQUEST_HANDLER', stack: null
          },
          end: true, stream: false, req: rid
        });
      this._maybedone();
    }
  }
};

// Internal handler of incoming stream msgs
PacketStream.prototype._onstream = function (msg) {
  if(msg.req < 0) {
    // Incoming stream data
    var rid = msg.req*-1;
    var outs = this._outstreams[rid];
    if (!outs)
      return console.error('no stream for incoming msg', msg)

    if (msg.end) {
      if (outs.writeEnd)
        delete this._outstreams[rid];
      outs.readEnd = true;
      outs.read(null, msg.value);
      this._maybedone();
    }
    else
      outs.read(msg.value);
  }
  else {
    // Incoming stream request
    var rid = msg.req;
    var ins = this._instreams[rid];

    if (!ins) {
      // New stream
      var self = this;
      ins = this._instreams[rid] = new PacketStreamSubstream(rid*-1, this, function() { delete self._instreams[rid]; });
      if (this.opts && typeof this.opts.stream == 'function')
        this.opts.stream(ins);
    }

    if(msg.end) {
      if (ins.writeEnd)
        delete this._instreams[rid];
      ins.readEnd = true;
      if(ins.read)
        ins.read(null, msg.value);
      this._maybedone();
    }
    else if(ins.read)
      ins.read(msg.value);
    else
      console.error('no .read for stream:', ins.id, 'dropped:', msg);
  }
};


function PacketStreamSubstream (id, ps, remove) {
  this.id       = id;
  this.read     = null; // must release, may capture `this`
  this.writeEnd = null;
  this.readEnd  = null;

  this._ps          = ps;     // must release, may capture `this`
  this._remove      = remove; // must release, may capture `this`
  this._seq_counter = 1;
}

PacketStreamSubstream.prototype.write = function (data, err) {
  if (err) {
    this.writeEnd = err;
    var ps = this._ps;
    if (ps) {
      ps.read({ req: this.id, stream: true, end: true, value: flat(err) });
      if (this.readEnd)
        this.destroy(err);
      ps._maybedone(err);
    }
  }
  else {
    if (this._ps) this._ps.read({ req: this.id, stream: true, end: false, value: data });
  }
};

// Send the `end` message for the substream
PacketStreamSubstream.prototype.end = function (err) {
  this.write(null, flat(err || true));
};

PacketStreamSubstream.prototype.destroy = function (err) {
  if (!this.writeEnd) {
    this.writeEnd = true;
    if (!this.readEnd) {
      this.readEnd = true;
      try {
        // catch errors to ensure cleanup
        this.read(null, err);
      } catch (e) {
        console.error('Exception thrown by PacketStream substream end handler', e);
        console.error(e.stack);
      }
    }
    this.write(null, err);
  }
  else if (!this.readEnd) {
    this.readEnd = true;
    try {
      // catch errors to ensure cleanup
      // don't assume that a stream has been piped anywhere.
      if(this.read) this.read(null, err);
    } catch (e) {
      console.error('Exception thrown by PacketStream substream end handler', e);
      console.error(e.stack);
    }
  }

  // deallocate
  if (this._ps) {
    this._remove();
    this._remove = null;
    this.read = closedread;
    this._ps = null;
  }
};

var pullWeird = createCommonjsModule(function (module) {

// wrap pull streams around packet-stream's weird streams.

function once (fn) {
  var done = false;
  return function (err, val) {
    if(done) return
    done = true;
    fn(err, val);
  }
}

module.exports = function (weird, _done) {
  var buffer = [], ended = false, waiting, abort;

  var done = once(function (err, v) {
    _done && _done(err, v);
    // deallocate
    weird = null;
    _done = null;    
    waiting = null;

    if(abort) abort(err || true, function () {});
  });

  weird.read = function (data, end) {
    ended = ended || end;

    if(waiting) {
      var cb = waiting;
      waiting = null;
      cb(ended, data);
    }
    else if(!ended) buffer.push(data);

    if(ended) done(ended !== true ? ended : null);
  };

  return {
    source: function (abort, cb) {
      if(abort) {
        weird && weird.write(null, abort);
        cb(abort); done(abort !== true ? abort : null);
      }
      else if(buffer.length) cb(null, buffer.shift());
      else if(ended) cb(ended);
      else waiting = cb;
    },
    sink  : function (read) {
      if(ended) return read(ended, function () {}), abort = null
      abort = read;
      pullStream.drain(function (data) {
        //TODO: make this should only happen on a UNIPLEX stream.
        if(ended) return false
        weird.write(data);
      }, function (err) {
        if(weird && !weird.writeEnd) weird.write(null, err || true);
        done && done(err);
      })(read);
    }
  }
};

function uniplex (s, done) {
  return module.exports(s, function (err) {
    if(!s.writeEnd) s.write(null, err || true);
    if(done) done(err);
  })
}

module.exports.source = function (s) {
  return uniplex(s).source
};
module.exports.sink = function (s, done) {
  return uniplex(s, done).sink
};

module.exports.duplex = module.exports;
});

var endable = function endable (goodbye) {
  var ended, waiting, sentEnd;
  function h (read) {
    return function (abort, cb) {
      read(abort, function (end, data) {
        if(end && !sentEnd) {
          sentEnd = true;
          return cb(null, goodbye)
        }
        //send end message...

        if(end && ended) cb(end);
        else if(end)     waiting = cb;
        else             cb(null, data);
      });
    }
  }
  h.end = function () {
    ended = true;
    if(waiting) waiting(ended);
    return h
  };
  return h
};

var abortCb$1 = function abortCb(cb, abort, onAbort) {
  cb(abort);
  onAbort && onAbort(abort === true ? null: abort);
  return
};

var values$1 = function values (array, onAbort) {
  if(!array)
    return function (abort, cb) {
      if(abort) return abortCb$1(cb, abort, onAbort)
      return cb(true)
    }
  if(!Array.isArray(array))
    array = Object.keys(array).map(function (k) {
      return array[k]
    });
  var i = 0;
  return function (abort, cb) {
    if(abort)
      return abortCb$1(cb, abort, onAbort)
    if(i >= array.length)
      cb(true);
    else
      cb(null, array[i++]);
  }
};

var keys$1 = function (object) {
  return values$1(Object.keys(object))
};

var once$1 = function once (value, onAbort) {
  return function (abort, cb) {
    if(abort)
      return abortCb$1(cb, abort, onAbort)
    if(value != null) {
      var _value = value; value = null;
      cb(null, _value);
    } else
      cb(true);
  }
};

var count$1 = function count (max) {
  var i = 0; max = max || Infinity;
  return function (end, cb) {
    if(end) return cb && cb(end)
    if(i > max)
      return cb(true)
    cb(null, i++);
  }
};

var infinite$1 = function infinite (generate) {
  generate = generate || Math.random;
  return function (end, cb) {
    if(end) return cb && cb(end)
    return cb(null, generate())
  }
};

//a stream that ends immediately.
var empty$1 = function empty () {
  return function (abort, cb) {
    cb(true);
  }
};

//a stream that errors immediately.
var error$1 = function error (err) {
  return function (abort, cb) {
    cb(err);
  }
};

var sources$1 = {
  keys: keys$1,
  once: once$1,
  values: values$1,
  count: count$1,
  infinite: infinite$1,
  empty: empty$1,
  error: error$1
};

var drain$1 = function drain (op, done) {
  var read, abort;

  function sink (_read) {
    read = _read;
    if(abort) return sink.abort()
    //this function is much simpler to write if you
    //just use recursion, but by using a while loop
    //we do not blow the stack if the stream happens to be sync.
    ;(function next() {
        var loop = true, cbed = false;
        while(loop) {
          cbed = false;
          read(null, function (end, data) {
            cbed = true;
            if(end = end || abort) {
              loop = false;
              if(done) done(end === true ? null : end);
              else if(end && end !== true)
                throw end
            }
            else if(op && false === op(data) || abort) {
              loop = false;
              read(abort || true, done || function () {});
            }
            else if(!loop){
              next();
            }
          });
          if(!cbed) {
            loop = false;
            return
          }
        }
      })();
  }

  sink.abort = function (err, cb) {
    if('function' == typeof err)
      cb = err, err = true;
    abort = err || true;
    if(read) return read(abort, cb || function () {})
  };

  return sink
};

var onEnd$1 = function onEnd (done) {
  return drain$1(null, done)
};

var log$1 = function log (done) {
  return drain$1(function (data) {
    console.log(data);
  }, done)
};

var prop$1 = function prop (key) {
  return key && (
    'string' == typeof key
    ? function (data) { return data[key] }
    : 'object' === typeof key && 'function' === typeof key.exec //regexp
    ? function (data) { var v = key.exec(data); return v && v[0] }
    : key
  )
};

function id$5 (e) { return e }



var find$1 = function find (test, cb) {
  var ended = false;
  if(!cb)
    cb = test, test = id$5;
  else
    test = prop$1(test) || id$5;

  return drain$1(function (data) {
    if(test(data)) {
      ended = true;
      cb(null, data);
    return false
    }
  }, function (err) {
    if(ended) return //already called back
    cb(err === true ? null : err, null);
  })
};

var reduce$1 = function reduce (reducer, acc, cb ) {
  if(!cb) cb = acc, acc = null;
  var sink = drain$1(function (data) {
    acc = reducer(acc, data);
  }, function (err) {
    cb(err, acc);
  });
  if (arguments.length === 2)
    return function (source) {
      source(null, function (end, data) {
        //if ended immediately, and no initial...
        if(end) return cb(end === true ? null : end)
        acc = data; sink(source);
      });
    }
  else
    return sink
};

var collect$1 = function collect (cb) {
  return reduce$1(function (arr, item) {
    arr.push(item);
    return arr
  }, [], cb)
};

var concat$1 = function concat (cb) {
  return reduce$1(function (a, b) {
    return a + b
  }, '', cb)
};

var sinks$1 = {
  drain: drain$1,
  onEnd: onEnd$1,
  log: log$1,
  find: find$1,
  reduce: reduce$1,
  collect: collect$1,
  concat: concat$1
};

function id$6 (e) { return e }


var map$1 = function map (mapper) {
  if(!mapper) return id$6
  mapper = prop$1(mapper);
  return function (read) {
    return function (abort, cb) {
      read(abort, function (end, data) {
        try {
        data = !end ? mapper(data) : null;
        } catch (err) {
          return read(err, function () {
            return cb(err)
          })
        }
        cb(end, data);
      });
    }
  }
};

function id$7 (e) { return e }


var asyncMap$1 = function asyncMap (map) {
  if(!map) return id$7
  map = prop$1(map);
  var busy = false, abortCb, aborted;
  return function (read) {
    return function next (abort, cb) {
      if(aborted) return cb(aborted)
      if(abort) {
        aborted = abort;
        if(!busy) read(abort, cb);
        else read(abort, function () {
          //if we are still busy, wait for the mapper to complete.
          if(busy) abortCb = cb;
          else cb(abort);
        });
      }
      else
        read(null, function (end, data) {
          if(end) cb(end);
          else if(aborted) cb(aborted);
          else {
            busy = true;
            map(data, function (err, data) {
              busy = false;
              if(aborted) {
                cb(aborted);
                abortCb(aborted);
              }
              else if(err) next (err, cb);
              else cb(null, data);
            });
          }
        });
    }
  }
};

function id$8 (e) { return e }

var tester$1 = function tester (test) {
  return (
    'object' === typeof test && 'function' === typeof test.test //regexp
    ? function (data) { return test.test(data) }
    : prop$1 (test) || id$8
  )
};

var filter$1 = function filter (test) {
  //regexp
  test = tester$1(test);
  return function (read) {
    return function next (end, cb) {
      var sync, loop = true;
      while(loop) {
        loop = false;
        sync = true;
        read(end, function (end, data) {
          if(!end && !test(data))
            return sync ? loop = true : next(end, cb)
          cb(end, data);
        });
        sync = false;
      }
    }
  }
};

var filterNot$1 = function filterNot (test) {
  test = tester$1(test);
  return filter$1(function (data) { return !test(data) })
};

//a pass through stream that doesn't change the value.
var through$1 = function through (op, onEnd) {
  var a = false;

  function once (abort) {
    if(a || !onEnd) return
    a = true;
    onEnd(abort === true ? null : abort);
  }

  return function (read) {
    return function (end, cb) {
      if(end) once(end);
      return read(end, function (end, data) {
        if(!end) op && op(data);
        else once(end);
        cb(end, data);
      })
    }
  }
};

//read a number of items and then stop.
var take$1 = function take (test, opts) {
  opts = opts || {};
  var last = opts.last || false; // whether the first item for which !test(item) should still pass
  var ended = false;
  if('number' === typeof test) {
    last = true;
    var n = test; test = function () {
      return --n
    };
  }

  return function (read) {

    function terminate (cb) {
      read(true, function (err) {
        last = false; cb(err || true);
      });
    }

    return function (end, cb) {
      if(ended)            last ? terminate(cb) : cb(ended);
      else if(ended = end) read(ended, cb);
      else
        read(null, function (end, data) {
          if(ended = ended || end) {
            //last ? terminate(cb) :
            cb(ended);
          }
          else if(!test(data)) {
            ended = true;
            last ? cb(null, data) : terminate(cb);
          }
          else
            cb(null, data);
        });
    }
  }
};

function id$9 (e) { return e }



//drop items you have already seen.
var unique$1 = function unique (field, invert) {
  field = prop$1(field) || id$9;
  var seen = {};
  return filter$1(function (data) {
    var key = field(data);
    if(seen[key]) return !!invert //false, by default
    else seen[key] = true;
    return !invert //true by default
  })
};

//passes an item through when you see it for the second time.
var nonUnique$1 = function nonUnique (field) {
  return unique$1(field, true)
};

//convert a stream of arrays or streams into just a stream.
var flatten$1 = function flatten () {
  return function (read) {
    var _read;
    return function (abort, cb) {
      if (abort) { //abort the current stream, and then stream of streams.
        _read ? _read(abort, function(err) {
          read(err || abort, cb);
        }) : read(abort, cb);
      }
      else if(_read) nextChunk();
      else nextStream();

      function nextChunk () {
        _read(null, function (err, data) {
          if (err === true) nextStream();
          else if (err) {
            read(true, function(abortErr) {
              // TODO: what do we do with the abortErr?
              cb(err);
            });
          }
          else cb(null, data);
        });
      }
      function nextStream () {
        _read = null;
        read(null, function (end, stream) {
          if(end)
            return cb(end)
          if(Array.isArray(stream) || stream && 'object' === typeof stream)
            stream = values$1(stream);
          else if('function' != typeof stream)
            stream = once$1(stream);
          _read = stream;
          nextChunk();
        });
      }
    }
  }
};

var throughs$1 = {
  map: map$1,
  asyncMap: asyncMap$1,
  filter: filter$1,
  filterNot: filterNot$1,
  through: through$1,
  take: take$1,
  unique: unique$1,
  nonUnique: nonUnique$1,
  flatten: flatten$1
};

var pull$1 = function pull (a) {
  var length = arguments.length;
  if (typeof a === 'function' && a.length === 1) {
    var args = new Array(length);
    for(var i = 0; i < length; i++)
      args[i] = arguments[i];
    return function (read) {
      if (args == null) {
        throw new TypeError("partial sink should only be called once!")
      }

      // Grab the reference after the check, because it's always an array now
      // (engines like that kind of consistency).
      var ref = args;
      args = null;

      // Prioritize common case of small number of pulls.
      switch (length) {
      case 1: return pull(read, ref[0])
      case 2: return pull(read, ref[0], ref[1])
      case 3: return pull(read, ref[0], ref[1], ref[2])
      case 4: return pull(read, ref[0], ref[1], ref[2], ref[3])
      default:
        ref.unshift(read);
        return pull.apply(null, ref)
      }
    }
  }

  var read = a;

  if (read && typeof read.source === 'function') {
    read = read.source;
  }

  for (var i = 1; i < length; i++) {
    var s = arguments[i];
    if (typeof s === 'function') {
      read = s(read);
    } else if (s && typeof s === 'object') {
      s.sink(read);
      read = s.source;
    }
  }

  return read
};

var pullStream$1 = createCommonjsModule(function (module, exports) {





exports = module.exports = pull$1;

for(var k in sources$1)
  exports[k] = sources$1[k];

for(var k in throughs$1)
  exports[k] = throughs$1[k];

for(var k in sinks$1)
  exports[k] = sinks$1[k];
});

var pullGoodbye = function (stream, goodbye) {
  goodbye = goodbye || 'GOODBYE';
  var e = endable(goodbye);

  return {
    // when the source ends,
    // send the goodbye and then wait to recieve
    // the other goodbye.
    source: pullStream$1(stream.source, e),
    sink: pullStream$1(
      //when the goodbye is received, allow the source to end.
      pullStream$1.filter(function (data) {
        if(data !== goodbye) return true
        e.end();
      }),
      stream.sink
    )
  }

};

function isString (s) {
  return 'string' === typeof s
}

function isEmpty (obj) {
  for(var k in obj) return false;
  return true
}

//I wrote set as part of permissions.js
//and then later mount, they do nearly the same thing
//but not quite. this should be refactored sometime.
//what differs is that set updates the last key in the path
//to the new value, but mount merges the last value
//which makes sense if it's an object, and set makes sense if it's
//a string/number/boolean.

var set = function (obj, path, value) {
  var _obj, _k;
  for(var i = 0; i < path.length; i++) {
    var k = path[i];
    obj[k] = obj[k] || {};
    _obj = obj; _k = k;
    obj = obj[k];
  }
  _obj[_k] = value;
};

var get = function (obj, path) {
  if(isString(path)) return obj[path]
  var value;
  for(var i = 0; i < path.length; i++) {
    var k = path[i];
    value = obj = obj[k];
    if(null == obj) return obj
  }
  return value
};

var prefix = function (obj, path) {
  var value;

  for(var i = 0; i < path.length; i++) {
    var k = path[i];
    value = obj = obj[k];
    if('object' !== typeof obj) {
      return obj
    }
  }
  return 'object' !== typeof value ? !!value : false
};

function mkPath(obj, path) {
  for(var i in path) {
    var key = path[i];
    if(!obj[key]) obj[key]={};
    obj = obj[key];
  }

  return obj
}

function rmPath (obj, path) {
  (function r (obj, i) {
    var key = path[i];
    if(!obj) return
    else if(path.length - 1 === i)
      delete obj[key];
    else if(i < path.length) r(obj[key], i+1);
    if(isEmpty(obj[key])) delete obj[key];
  })(obj, 0);
}

function merge (obj, _obj) {
  for(var k in _obj)
    obj[k] = _obj[k];
  return obj
}

var mount = function (obj, path, _obj) {
  if(!Array.isArray(path))
    throw new Error('path must be array of strings')
  return merge(mkPath(obj, path), _obj)
};
var unmount = function (obj, path) {
  return rmPath(obj, path)
};

function isSource    (t) { return 'source' === t }
function isSink      (t) { return 'sink'   === t }
function isDuplex    (t) { return 'duplex' === t }
function isSync      (t) { return 'sync'  === t }
function isAsync     (t) { return 'async'  === t }
function isRequest   (t) { return isSync(t) || isAsync(t) }

function abortSink (err) {
  return function (read) {
    read(err || true, function () {});
  }
}

function abortDuplex (err) {
  return {source: pullStream.error(err), sink: abortSink(err)}
}

var errorAsStream = function (type, err) {
  return (
      isSource(type)  ? pullStream.error(err)
    : isSink(type)    ? abortSink(err)
    :                   abortDuplex(err)
  )
};


var errorAsStreamOrCb = function (type, err, cb) {
  return (
      isRequest(type) ? cb(err)
    : isSource(type)  ? pullStream.error(err)
    : isSink(type)    ? abortSink(err)
    :                   cb(err), abortDuplex(err)
  )
};

var pipeToStream = function (type, _stream, stream) {
  if(isSource(type))
    _stream(stream);
  else if (isSink(type))
    stream(_stream);
  else if (isDuplex(type))
    pullStream(_stream, stream, _stream);
};

var util = {
	set: set,
	get: get,
	prefix: prefix,
	mount: mount,
	unmount: unmount,
	errorAsStream: errorAsStream,
	errorAsStreamOrCb: errorAsStreamOrCb,
	pipeToStream: pipeToStream
};

var explainError = createCommonjsModule(function (module) {
function getStack(err) {
  if(err.stack && err.name && err.message)
    return err.stack.substring(err.name.length + 3 + err.message.length)
      .split('\n')
  else if(err.stack)
    return err.stack.split('\n')
}

function removePrefix (a, b) {
  return a.filter(function (e) {
    return !~b.indexOf(e)
  })
}

var explain = module.exports = function (err, message) {
  if(!(err.stack && err.name && err.message)) {
    console.error(new Error('stackless error'));
    return err
  }

  var _err = new Error(message);
  var stack = removePrefix(getStack(_err).slice(1), getStack(err)).join('\n');

  _err.__proto__ = err;

  _err.stack =
    _err.name + ': ' + _err.message + '\n' +
    stack + '\n  ' + err.stack;

  return _err
};
});

function isFunction$1 (f) {
  return 'function' === typeof f
}

function isSource$1    (t) { return 'source' === t }
function isSink$1      (t) { return 'sink'   === t }
function isDuplex$1    (t) { return 'duplex' === t }
function isSync$1      (t) { return 'sync'  === t }
function isAsync$1     (t) { return 'async'  === t }
function isRequest$1   (t) { return isSync$1(t) || isAsync$1(t) }
function isStream    (t) { return isSource$1(t) || isSink$1(t) || isDuplex$1(t) }

var stream = function initStream (localCall, codec, onClose) {

  var ps = packetStream({
    message: function () {
//      if(isString(msg)) return
//      if(msg.length > 0 && isString(msg[0]))
//        localCall('msg', 'emit', msg)
    },
    request: function (opts, cb) {
      if(!Array.isArray(opts.args))
        return cb(new Error('invalid request, args should be array, was:'+JSON.stringify(opts)))
      var name = opts.name, args = opts.args;
      var inCB = false, called = false;

      args.push(function (err, value) {
        called = true;
        inCB = true; cb(err, value);
      });
      try {
        localCall('async', name, args);
      } catch (err) {
        if(inCB || called) throw explainError(err, 'no callback provided to muxrpc async funtion')
        return cb(err)
      }

    },
    stream: function (stream) {
      stream.read = function (data, end) {
        //how would this actually happen?
        if(end) return stream.write(null, end)

        var name = data.name;
        var type = data.type;
        var err, value;

        stream.read = null;

        if(!isStream(type))
          return stream.write(null, new Error('unsupported stream type:'+type))

        try { value = localCall(type, name, data.args); }
        catch (_err) { err = _err; }

        var _stream = pullWeird[
          {source: 'sink', sink: 'source'}[type] || 'duplex'
        ](stream);

        return util.pipeToStream(
          type, _stream,
          err ? util.errorAsStream(type, err) : value
        )

//        if(isSource(type))
//          _stream(err ? pull.error(err) : value)
//        else if (isSink(type))
//          (err ? abortSink(err) : value)(_stream)
//        else if (isDuplex(type))
//          pull(_stream, err ? abortDuplex(err) : value, _stream)
      };
    },

    close: function (err) {
        ps = null; // deallocate
        ws.ended = true;
        if(ws.closed) return
        ws.closed = true;
        if(onClose) {
          var close = onClose; onClose = null; close(err);
        }
      }
  });

  var ws = pullGoodbye(pullWeird(ps, function () {
    //this error will be handled in PacketStream.close
  }));

  ws = codec ? codec(ws) : ws;

  ws.remoteCall = function (type, name, args, cb) {
    if(name === 'emit') return ps.message(args)

    if(!(isRequest$1(type) || isStream(type)))
      throw new Error('unsupported type:' + JSON.stringify(type))

    if(isRequest$1(type))
      return ps.request({name: name, args: args}, cb)

    var ws = ps.stream(), s = pullWeird[type](ws, cb);
    ws.write({name: name, args: args, type: type});
    return s
  };


  //hack to work around ordering in setting ps.ended.
  //Question: if an object has subobjects, which
  //all have close events, should the subobjects fire close
  //before the parent? or should parents close after?
  //should there be a preclose event on the parent
  //that fires when it's about to close all the children?
  ws.isOpen = function () {
    return !ps.ended
  };

  ws.close = function (err, cb) {
    if(isFunction$1(err))
      cb = err, err = false;
    if(!ps) return (cb && cb())
    if(err) return ps.destroy(err), (cb && cb())

    ps.close(function (err) {
      if(cb) cb(err);
      else if(err) throw explainError(err, 'no callback provided for muxrpc close')
    });

    return this
  };
  ws.closed = false;

  return ws
};

function isFunction$2 (f) {
  return 'function' === typeof f
}

function isObject (o) {
  return o && 'object' === typeof o
}

//add all the api methods to the emitter recursively
function recurse (obj, manifest, path, remoteCall) {
  for(var name in manifest) (function (name, type) {
    var _path = path ? path.concat(name) : [name];
    obj[name] =
        isObject(type)
      ? recurse({}, type, _path, remoteCall)
      : function () {
          return remoteCall(type, _path, [].slice.call(arguments))
        };
  })(name, manifest[name]);
  return obj
}


function noop (err) {
  if (err) {
    throw explainError(err, 'callback not provided')
  }
}

const promiseTypes = [
  'sync',
  'async'
];

var remoteApi = function (obj, manifest, _remoteCall, bootstrap) {
  obj = obj || {};

  function remoteCall(type, name, args) {
    var cb = isFunction$2 (args[args.length - 1])
      ? args.pop()
      : promiseTypes.includes(type)
        ? null
        : noop;
    var value;

    if (typeof cb === 'function') {
      // Callback style
      try { value = _remoteCall(type, name, args, cb); }
      catch(err) { return util.errorAsStreamOrCb(type, err, cb)}

      return value
    } else {
      // Promise style
      return new Promise((resolve, reject) =>
        _remoteCall(type, name, args, (err, val) => {
          if (err) {
            reject(err);
          } else {
            resolve(val);
          }
        })
      )
    }
  }


  if (bootstrap) {
    remoteCall('async', 'manifest', [function (err, remote) {
      if(err)
        return bootstrap(err)
      recurse(obj, remote, null, remoteCall);
      bootstrap(null, remote, obj);
    }]);
  } else {
    recurse(obj, manifest, null, remoteCall);
  }

  return obj
};

var isArray$1 = Array.isArray;

function isFunction$3 (f) {
  return 'function' === typeof f
}

function toArray(str) {
  return isArray$1(str) ? str : str.split('.')
}

function isPerms (p) {
  return (
    p &&
    isFunction$3(p.pre) &&
    isFunction$3(p.test) &&
    isFunction$3(p.post)
  )
}

/*

perms:

a given capability may be permitted to call a particular api.
but only if a perms function returns true for the arguments
it passes.

suppose, an app may be given access, but may only create functions
with it's own properties.

create perms:
  {
    allow: ['add', 'query'], deny: [...],
    rules: {
      add: {
        call: function (value) {
          return (value.type === 'task' || value.type === '_task')
        },
      query: {
        call: function (value) {
          safe.contains(value, {path: ['content', 'type'], eq: 'task'}) ||
          safe.contains(value, {path: ['content', 'type'], eq: '_task'})
        },
        filter: function (value) {
          return (value.type === 'task' || value.type === '_task')
        }
      }
    }
  }
*/

var permissions = function (opts) {
  if(isPerms(opts)) return opts
  if(isFunction$3(opts)) return {pre: opts}
  var allow = null;
  var deny = {};

  function perms (opts) {
    if(opts.allow) {
      allow = {};
      opts.allow.forEach(function (path) {
        util.set(allow, toArray(path), true);
      });
    }
    else allow = null;

    if(opts.deny)
      opts.deny.forEach(function (path) {
        util.set(deny, toArray(path), true);
      });
    else deny = {};

    return this
  }

  if(opts) perms(opts);

  perms.pre = function (name) {
    name = isArray$1(name) ? name : [name];
    if(allow && !util.prefix(allow, name))
      return new Error('method:'+name + ' is not in list of allowed methods')

    if(deny && util.prefix(deny, name))
      return new Error('method:'+name + ' is on list of disallowed methods')
  };

  perms.post = function () {
    //TODO
  };

  //alias for pre, used in tests.
  perms.test = function (name) {
    return perms.pre(name)
  };

  perms.get = function () {
    return {allow: allow, deny: deny}
  };

  return perms
};

var localApi = 

function createLocalCall(api, manifest, perms) {
  perms = permissions(perms);

  function has(type, name) {
    return type === util.get(manifest, name)
  }

  function localCall(type, name, args) {

    if(name === 'emit')
      throw new Error('emit has been removed')

    //is there a way to know whether it's sync or async?
    if(type === 'async')
      if(has('sync', name)) {
        var cb = args.pop(), value;
        try { value = util.get(api, name).apply(this, args); }
        catch (err) { return cb(err) }
        return cb(null, value)
      }

    if (!has(type, name))
      throw new Error('no '+type+':'+name)

    return util.get(api, name).apply(this, args)
  }

  return function (type, name, args) {
    var err = perms.pre(name, args);
    if(err) throw err
    return localCall.call(this, type, name, args)
  }
};

var domain;

// This constructor is used to store event handlers. Instantiating this is
// faster than explicitly calling `Object.create(null)` to get a "clean" empty
// object (tested with v8 v4.9).
function EventHandlers() {}
EventHandlers.prototype = Object.create(null);

function EventEmitter() {
  EventEmitter.init.call(this);
}

// nodejs oddity
// require('events') === require('events').EventEmitter
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.usingDomains = false;

EventEmitter.prototype.domain = undefined;
EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

EventEmitter.init = function() {
  this.domain = null;
  if (EventEmitter.usingDomains) {
    // if there is an active domain, then attach to it.
    if (domain.active ) ;
  }

  if (!this._events || this._events === Object.getPrototypeOf(this)._events) {
    this._events = new EventHandlers();
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
};

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events, domain;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  domain = this.domain;

  // If there is no 'error' event listener then throw.
  if (doError) {
    er = arguments[1];
    if (domain) {
      if (!er)
        er = new Error('Uncaught, unspecified "error" event');
      er.domainEmitter = this;
      er.domain = domain;
      er.domainThrown = false;
      domain.emit('error', er);
    } else if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
    // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
    // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = new EventHandlers();
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
                  listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] = prepend ? [listener, existing] :
                                          [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
                            existing.length + ' ' + type + ' listeners added. ' +
                            'Use emitter.setMaxListeners() to increase limit');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        emitWarning(w);
      }
    }
  }

  return target;
}
function emitWarning(e) {
  typeof console.warn === 'function' ? console.warn(e) : console.log(e);
}
EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function _onceWrap(target, type, listener) {
  var fired = false;
  function g() {
    target.removeListener(type, g);
    if (!fired) {
      fired = true;
      listener.apply(target, arguments);
    }
  }
  g.listener = listener;
  return g;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || (list.listener && list.listener === listener)) {
        if (--this._eventsCount === 0)
          this._events = new EventHandlers();
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length; i-- > 0;) {
          if (list[i] === listener ||
              (list[i].listener && list[i].listener === listener)) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (list.length === 1) {
          list[0] = undefined;
          if (--this._eventsCount === 0) {
            this._events = new EventHandlers();
            return this;
          } else {
            delete events[type];
          }
        } else {
          spliceOne(list, position);
        }

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = new EventHandlers();
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = new EventHandlers();
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = Object.keys(events);
        for (var i = 0, key; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = new EventHandlers();
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        do {
          this.removeListener(type, listeners[listeners.length - 1]);
        } while (listeners[0]);
      }

      return this;
    };

EventEmitter.prototype.listeners = function listeners(type) {
  var evlistener;
  var ret;
  var events = this._events;

  if (!events)
    ret = [];
  else {
    evlistener = events[type];
    if (!evlistener)
      ret = [];
    else if (typeof evlistener === 'function')
      ret = [evlistener.listener || evlistener];
    else
      ret = unwrapListeners(evlistener);
  }

  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, i) {
  var copy = new Array(i);
  while (i--)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

var events = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': EventEmitter,
	EventEmitter: EventEmitter
});

var require$$0 = /*@__PURE__*/getAugmentedNamespace(events);

var EventEmitter$1 = require$$0.EventEmitter;

function createMuxrpc (remoteManifest, localManifest, localApi$1, id, perms, codec, legacy) {
  var bootstrap;
  if ('function' === typeof remoteManifest) {
    bootstrap = remoteManifest;
    remoteManifest = {};
  }

  localManifest = localManifest || {};
  remoteManifest = remoteManifest || {};
  var emitter = new EventEmitter$1();
  if(!codec) codec = packetStreamCodec;

  //pass the manifest to the permissions so that it can know
  //what something should be.
  var _cb;
  var context = {
      _emit: function (event, value) {
        emitter && emitter._emit(event, value);
        return context
      },
      id: id
    };

  var ws = stream(
    localApi(localApi$1, localManifest, perms).bind(context),
    codec, function (err) {
      if(emitter.closed) return
      emitter.closed = true;
      emitter.emit('closed');
      if(_cb) {
        var cb = _cb; _cb = null; cb(err);
      }
    }
  );

  remoteApi(emitter, remoteManifest, function (type, name, args, cb) {
    if(ws.closed) throw new Error('stream is closed')
    return ws.remoteCall(type, name, args, cb)
  }, bootstrap);

  //legacy local emit, from when remote emit was supported.
  emitter._emit = emitter.emit;

  if(legacy) {
    Object.__defineGetter__.call(emitter, 'id', function () {
      return context.id
    });

    Object.__defineSetter__.call(emitter, 'id', function (value) {
      context.id =  value;
    });

    var first = true;

    emitter.createStream = function (cb) {
      _cb = cb;
      if(first) {
        first = false; return ws
      }
      else
        throw new Error('one stream per rpc')
    };
  }
  else
    emitter.stream = ws;

  emitter.closed = false;

  emitter.close = function (err, cb) {
    ws.close(err, cb);
    return this
  };

  return emitter
}

var muxrpc = function (remoteManifest, localManifest, codec) {
  if(arguments.length > 3)
    return createMuxrpc.apply(this, arguments)
  return function (local, perms, id) {
    return createMuxrpc(remoteManifest, localManifest, local, id, perms, codec, true)
  }
};

var global$2 =
  (typeof globalThis !== 'undefined' && globalThis) ||
  (typeof self !== 'undefined' && self) ||
  (typeof global$2 !== 'undefined' && global$2);

var support = {
  searchParams: 'URLSearchParams' in global$2,
  iterable: 'Symbol' in global$2 && 'iterator' in Symbol,
  blob:
    'FileReader' in global$2 &&
    'Blob' in global$2 &&
    (function() {
      try {
        new Blob();
        return true
      } catch (e) {
        return false
      }
    })(),
  formData: 'FormData' in global$2,
  arrayBuffer: 'ArrayBuffer' in global$2
};

function isDataView(obj) {
  return obj && DataView.prototype.isPrototypeOf(obj)
}

if (support.arrayBuffer) {
  var viewClasses = [
    '[object Int8Array]',
    '[object Uint8Array]',
    '[object Uint8ClampedArray]',
    '[object Int16Array]',
    '[object Uint16Array]',
    '[object Int32Array]',
    '[object Uint32Array]',
    '[object Float32Array]',
    '[object Float64Array]'
  ];

  var isArrayBufferView =
    ArrayBuffer.isView ||
    function(obj) {
      return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
    };
}

function normalizeName(name) {
  if (typeof name !== 'string') {
    name = String(name);
  }
  if (/[^a-z0-9\-#$%&'*+.^_`|~!]/i.test(name) || name === '') {
    throw new TypeError('Invalid character in header field name')
  }
  return name.toLowerCase()
}

function normalizeValue(value) {
  if (typeof value !== 'string') {
    value = String(value);
  }
  return value
}

// Build a destructive iterator for the value list
function iteratorFor(items) {
  var iterator = {
    next: function() {
      var value = items.shift();
      return {done: value === undefined, value: value}
    }
  };

  if (support.iterable) {
    iterator[Symbol.iterator] = function() {
      return iterator
    };
  }

  return iterator
}

function Headers(headers) {
  this.map = {};

  if (headers instanceof Headers) {
    headers.forEach(function(value, name) {
      this.append(name, value);
    }, this);
  } else if (Array.isArray(headers)) {
    headers.forEach(function(header) {
      this.append(header[0], header[1]);
    }, this);
  } else if (headers) {
    Object.getOwnPropertyNames(headers).forEach(function(name) {
      this.append(name, headers[name]);
    }, this);
  }
}

Headers.prototype.append = function(name, value) {
  name = normalizeName(name);
  value = normalizeValue(value);
  var oldValue = this.map[name];
  this.map[name] = oldValue ? oldValue + ', ' + value : value;
};

Headers.prototype['delete'] = function(name) {
  delete this.map[normalizeName(name)];
};

Headers.prototype.get = function(name) {
  name = normalizeName(name);
  return this.has(name) ? this.map[name] : null
};

Headers.prototype.has = function(name) {
  return this.map.hasOwnProperty(normalizeName(name))
};

Headers.prototype.set = function(name, value) {
  this.map[normalizeName(name)] = normalizeValue(value);
};

Headers.prototype.forEach = function(callback, thisArg) {
  for (var name in this.map) {
    if (this.map.hasOwnProperty(name)) {
      callback.call(thisArg, this.map[name], name, this);
    }
  }
};

Headers.prototype.keys = function() {
  var items = [];
  this.forEach(function(value, name) {
    items.push(name);
  });
  return iteratorFor(items)
};

Headers.prototype.values = function() {
  var items = [];
  this.forEach(function(value) {
    items.push(value);
  });
  return iteratorFor(items)
};

Headers.prototype.entries = function() {
  var items = [];
  this.forEach(function(value, name) {
    items.push([name, value]);
  });
  return iteratorFor(items)
};

if (support.iterable) {
  Headers.prototype[Symbol.iterator] = Headers.prototype.entries;
}

function consumed(body) {
  if (body.bodyUsed) {
    return Promise.reject(new TypeError('Already read'))
  }
  body.bodyUsed = true;
}

function fileReaderReady(reader) {
  return new Promise(function(resolve, reject) {
    reader.onload = function() {
      resolve(reader.result);
    };
    reader.onerror = function() {
      reject(reader.error);
    };
  })
}

function readBlobAsArrayBuffer(blob) {
  var reader = new FileReader();
  var promise = fileReaderReady(reader);
  reader.readAsArrayBuffer(blob);
  return promise
}

function readBlobAsText(blob) {
  var reader = new FileReader();
  var promise = fileReaderReady(reader);
  reader.readAsText(blob);
  return promise
}

function readArrayBufferAsText(buf) {
  var view = new Uint8Array(buf);
  var chars = new Array(view.length);

  for (var i = 0; i < view.length; i++) {
    chars[i] = String.fromCharCode(view[i]);
  }
  return chars.join('')
}

function bufferClone(buf) {
  if (buf.slice) {
    return buf.slice(0)
  } else {
    var view = new Uint8Array(buf.byteLength);
    view.set(new Uint8Array(buf));
    return view.buffer
  }
}

function Body() {
  this.bodyUsed = false;

  this._initBody = function(body) {
    /*
      fetch-mock wraps the Response object in an ES6 Proxy to
      provide useful test harness features such as flush. However, on
      ES5 browsers without fetch or Proxy support pollyfills must be used;
      the proxy-pollyfill is unable to proxy an attribute unless it exists
      on the object before the Proxy is created. This change ensures
      Response.bodyUsed exists on the instance, while maintaining the
      semantic of setting Request.bodyUsed in the constructor before
      _initBody is called.
    */
    this.bodyUsed = this.bodyUsed;
    this._bodyInit = body;
    if (!body) {
      this._bodyText = '';
    } else if (typeof body === 'string') {
      this._bodyText = body;
    } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
      this._bodyBlob = body;
    } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
      this._bodyFormData = body;
    } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
      this._bodyText = body.toString();
    } else if (support.arrayBuffer && support.blob && isDataView(body)) {
      this._bodyArrayBuffer = bufferClone(body.buffer);
      // IE 10-11 can't handle a DataView body.
      this._bodyInit = new Blob([this._bodyArrayBuffer]);
    } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
      this._bodyArrayBuffer = bufferClone(body);
    } else {
      this._bodyText = body = Object.prototype.toString.call(body);
    }

    if (!this.headers.get('content-type')) {
      if (typeof body === 'string') {
        this.headers.set('content-type', 'text/plain;charset=UTF-8');
      } else if (this._bodyBlob && this._bodyBlob.type) {
        this.headers.set('content-type', this._bodyBlob.type);
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
      }
    }
  };

  if (support.blob) {
    this.blob = function() {
      var rejected = consumed(this);
      if (rejected) {
        return rejected
      }

      if (this._bodyBlob) {
        return Promise.resolve(this._bodyBlob)
      } else if (this._bodyArrayBuffer) {
        return Promise.resolve(new Blob([this._bodyArrayBuffer]))
      } else if (this._bodyFormData) {
        throw new Error('could not read FormData body as blob')
      } else {
        return Promise.resolve(new Blob([this._bodyText]))
      }
    };

    this.arrayBuffer = function() {
      if (this._bodyArrayBuffer) {
        var isConsumed = consumed(this);
        if (isConsumed) {
          return isConsumed
        }
        if (ArrayBuffer.isView(this._bodyArrayBuffer)) {
          return Promise.resolve(
            this._bodyArrayBuffer.buffer.slice(
              this._bodyArrayBuffer.byteOffset,
              this._bodyArrayBuffer.byteOffset + this._bodyArrayBuffer.byteLength
            )
          )
        } else {
          return Promise.resolve(this._bodyArrayBuffer)
        }
      } else {
        return this.blob().then(readBlobAsArrayBuffer)
      }
    };
  }

  this.text = function() {
    var rejected = consumed(this);
    if (rejected) {
      return rejected
    }

    if (this._bodyBlob) {
      return readBlobAsText(this._bodyBlob)
    } else if (this._bodyArrayBuffer) {
      return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
    } else if (this._bodyFormData) {
      throw new Error('could not read FormData body as text')
    } else {
      return Promise.resolve(this._bodyText)
    }
  };

  if (support.formData) {
    this.formData = function() {
      return this.text().then(decode)
    };
  }

  this.json = function() {
    return this.text().then(JSON.parse)
  };

  return this
}

// HTTP methods whose capitalization should be normalized
var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'];

function normalizeMethod(method) {
  var upcased = method.toUpperCase();
  return methods.indexOf(upcased) > -1 ? upcased : method
}

function Request(input, options) {
  if (!(this instanceof Request)) {
    throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.')
  }

  options = options || {};
  var body = options.body;

  if (input instanceof Request) {
    if (input.bodyUsed) {
      throw new TypeError('Already read')
    }
    this.url = input.url;
    this.credentials = input.credentials;
    if (!options.headers) {
      this.headers = new Headers(input.headers);
    }
    this.method = input.method;
    this.mode = input.mode;
    this.signal = input.signal;
    if (!body && input._bodyInit != null) {
      body = input._bodyInit;
      input.bodyUsed = true;
    }
  } else {
    this.url = String(input);
  }

  this.credentials = options.credentials || this.credentials || 'same-origin';
  if (options.headers || !this.headers) {
    this.headers = new Headers(options.headers);
  }
  this.method = normalizeMethod(options.method || this.method || 'GET');
  this.mode = options.mode || this.mode || null;
  this.signal = options.signal || this.signal;
  this.referrer = null;

  if ((this.method === 'GET' || this.method === 'HEAD') && body) {
    throw new TypeError('Body not allowed for GET or HEAD requests')
  }
  this._initBody(body);

  if (this.method === 'GET' || this.method === 'HEAD') {
    if (options.cache === 'no-store' || options.cache === 'no-cache') {
      // Search for a '_' parameter in the query string
      var reParamSearch = /([?&])_=[^&]*/;
      if (reParamSearch.test(this.url)) {
        // If it already exists then set the value with the current time
        this.url = this.url.replace(reParamSearch, '$1_=' + new Date().getTime());
      } else {
        // Otherwise add a new '_' parameter to the end with the current time
        var reQueryString = /\?/;
        this.url += (reQueryString.test(this.url) ? '&' : '?') + '_=' + new Date().getTime();
      }
    }
  }
}

Request.prototype.clone = function() {
  return new Request(this, {body: this._bodyInit})
};

function decode(body) {
  var form = new FormData();
  body
    .trim()
    .split('&')
    .forEach(function(bytes) {
      if (bytes) {
        var split = bytes.split('=');
        var name = split.shift().replace(/\+/g, ' ');
        var value = split.join('=').replace(/\+/g, ' ');
        form.append(decodeURIComponent(name), decodeURIComponent(value));
      }
    });
  return form
}

function parseHeaders(rawHeaders) {
  var headers = new Headers();
  // Replace instances of \r\n and \n followed by at least one space or horizontal tab with a space
  // https://tools.ietf.org/html/rfc7230#section-3.2
  var preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, ' ');
  // Avoiding split via regex to work around a common IE11 bug with the core-js 3.6.0 regex polyfill
  // https://github.com/github/fetch/issues/748
  // https://github.com/zloirock/core-js/issues/751
  preProcessedHeaders
    .split('\r')
    .map(function(header) {
      return header.indexOf('\n') === 0 ? header.substr(1, header.length) : header
    })
    .forEach(function(line) {
      var parts = line.split(':');
      var key = parts.shift().trim();
      if (key) {
        var value = parts.join(':').trim();
        headers.append(key, value);
      }
    });
  return headers
}

Body.call(Request.prototype);

function Response(bodyInit, options) {
  if (!(this instanceof Response)) {
    throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.')
  }
  if (!options) {
    options = {};
  }

  this.type = 'default';
  this.status = options.status === undefined ? 200 : options.status;
  this.ok = this.status >= 200 && this.status < 300;
  this.statusText = 'statusText' in options ? options.statusText : '';
  this.headers = new Headers(options.headers);
  this.url = options.url || '';
  this._initBody(bodyInit);
}

Body.call(Response.prototype);

Response.prototype.clone = function() {
  return new Response(this._bodyInit, {
    status: this.status,
    statusText: this.statusText,
    headers: new Headers(this.headers),
    url: this.url
  })
};

Response.error = function() {
  var response = new Response(null, {status: 0, statusText: ''});
  response.type = 'error';
  return response
};

var redirectStatuses = [301, 302, 303, 307, 308];

Response.redirect = function(url, status) {
  if (redirectStatuses.indexOf(status) === -1) {
    throw new RangeError('Invalid status code')
  }

  return new Response(null, {status: status, headers: {location: url}})
};

var DOMException = global$2.DOMException;
try {
  new DOMException();
} catch (err) {
  DOMException = function(message, name) {
    this.message = message;
    this.name = name;
    var error = Error(message);
    this.stack = error.stack;
  };
  DOMException.prototype = Object.create(Error.prototype);
  DOMException.prototype.constructor = DOMException;
}

function fetch(input, init) {
  return new Promise(function(resolve, reject) {
    var request = new Request(input, init);

    if (request.signal && request.signal.aborted) {
      return reject(new DOMException('Aborted', 'AbortError'))
    }

    var xhr = new XMLHttpRequest();

    function abortXhr() {
      xhr.abort();
    }

    xhr.onload = function() {
      var options = {
        status: xhr.status,
        statusText: xhr.statusText,
        headers: parseHeaders(xhr.getAllResponseHeaders() || '')
      };
      options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL');
      var body = 'response' in xhr ? xhr.response : xhr.responseText;
      setTimeout(function() {
        resolve(new Response(body, options));
      }, 0);
    };

    xhr.onerror = function() {
      setTimeout(function() {
        reject(new TypeError('Network request failed'));
      }, 0);
    };

    xhr.ontimeout = function() {
      setTimeout(function() {
        reject(new TypeError('Network request failed'));
      }, 0);
    };

    xhr.onabort = function() {
      setTimeout(function() {
        reject(new DOMException('Aborted', 'AbortError'));
      }, 0);
    };

    function fixUrl(url) {
      try {
        return url === '' && global$2.location.href ? global$2.location.href : url
      } catch (e) {
        return url
      }
    }

    xhr.open(request.method, fixUrl(request.url), true);

    if (request.credentials === 'include') {
      xhr.withCredentials = true;
    } else if (request.credentials === 'omit') {
      xhr.withCredentials = false;
    }

    if ('responseType' in xhr) {
      if (support.blob) {
        xhr.responseType = 'blob';
      } else if (
        support.arrayBuffer &&
        request.headers.get('Content-Type') &&
        request.headers.get('Content-Type').indexOf('application/octet-stream') !== -1
      ) {
        xhr.responseType = 'arraybuffer';
      }
    }

    if (init && typeof init.headers === 'object' && !(init.headers instanceof Headers)) {
      Object.getOwnPropertyNames(init.headers).forEach(function(name) {
        xhr.setRequestHeader(name, normalizeValue(init.headers[name]));
      });
    } else {
      request.headers.forEach(function(value, name) {
        xhr.setRequestHeader(name, value);
      });
    }

    if (request.signal) {
      request.signal.addEventListener('abort', abortXhr);

      xhr.onreadystatechange = function() {
        // DONE (success or failure)
        if (xhr.readyState === 4) {
          request.signal.removeEventListener('abort', abortXhr);
        }
      };
    }

    xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit);
  })
}

fetch.polyfill = true;

if (!global$2.fetch) {
  global$2.fetch = fetch;
  global$2.Headers = Headers;
  global$2.Request = Request;
  global$2.Response = Response;
}

// the whatwg-fetch polyfill installs the fetch() function
// on the global object (window or self)
//
// Return that as the export for use in Webpack, Browserify etc.

var fetchNpmBrowserify = self.fetch.bind(self);

class Util {

  constructor(sbot) {
    this.sbot = sbot;
  }

  getBlob(blobId) {
    return new Promise((resolve, reject) => {
      this.sbot.blobs.want(blobId).then(() => {
        pullStream(
          this.sbot.blobs.get(blobId),
          pullStream.collect((err, values) => {
            if (err) reject(err);
            const code = values.join('');
            resolve(code);
          })
        );
      });
    })
  }
  
  dereferenceUriOrSigil(uriOrSigil) {
    if (uriOrSigil.startsWith('&')) {
      return this.getBlob(uriOrSigil)
    } else {
      return fetchNpmBrowserify(uriOrSigil).then(response => response.text())
    }
  }
}

class AppRunner extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback() {
    const runnerArea = this.attachShadow({ mode: 'open' });

    const util = new Util(this.sbot);

    const getClassicAppFrameContent = () => {
      const blobId = this.app.link;
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

    };

    const addBaseUrl = (htmlString) => htmlString.replace('<head>',`<head><base href="${this.app.link}">`);

    const getWebappContent = () => {
      const link = this.app.link;
      // because of same originy policy we cab't just use original link
      return util.dereferenceUriOrSigil(link).then(content => {
        content = (link.startsWith('&') || link.startsWith('ssb')) ? content : addBaseUrl(content);
        return content
      })
    };

    const getAppFrameContent = () => {
      if (this.app.type === 'patchboot-app') {
        return getClassicAppFrameContent()
      } else if (this.app.type === 'patchboot-webapp') {
        return getWebappContent()
      } else {
        throw new Error('unsupported: ' + this.app.type)
      }
    };

    const createIFrame = () => {
      const iFrame = document.createElement('iframe');
      runnerArea.appendChild(iFrame); // has to appended before contentWindow is accessed
      iFrame.style = "width: 100%; height: 100%; border: none;";
      return getAppFrameContent().then(iFrameContent => {
        iFrame.contentWindow.document.open();
        iFrame.contentWindow.document.write(iFrameContent);
        iFrame.contentWindow.document.close();
        return iFrame
      })
    };
    
    createIFrame().then(iFrame => {
      console.log(iFrame);
      
      this.dispatchEvent(new Event('loaded'));

      let messageDataCallback = null;
      let messageDataBuffer = [];

      const fromPage = function read(abort, cb) {
        if (messageDataBuffer.length > 0) {
          const data = messageDataBuffer[0];
          messageDataBuffer = messageDataBuffer.splice(1);
          cb(null, data);
        } else {
          messageDataCallback = cb;
        }

      };

      function ping() {
        iFrame.contentWindow.postMessage({
          direction: "from-content-script",
          action: 'ping'
        }, '*');
      }

      iFrame.contentWindow.addEventListener("message", (event) => {
        if (event.data && event.data.direction === "from-page-script") {
          if (event.data.action === "ping") {
            ping();
          } else {
            //new Uint8Array(event.data.message) is not accepted by muxrpc
            const asBuffer = Buffer.from(event.data.message);
            if (messageDataCallback) {
              const _messageDataCallback = messageDataCallback;
              messageDataCallback = null;
              _messageDataCallback(null, asBuffer);
            } else {
              console.log('buffering....');
              messageDataBuffer.push(asBuffer);
            }
          }
        }
      });
      const toPage = function (source) {
        source(null, function more(end, data) {
          iFrame.contentWindow.postMessage({
            direction: "from-content-script",
            message: data
          }, '*');
          source(null, more);
        });
      };
      iFrame.contentWindow.addEventListener('load', () => this.dispatchEvent(new CustomEvent('ready')));
      /*function logger(text) {
        return pull.map((v) => {
          console.log(text,v)
          console.log(new TextDecoder("utf-8").decode(v))
          return v
        })
      }*/
      this.sbot.manifest().then(manifest => {
        //console.log('manifest', JSON.stringify(manifest))
        const asyncManifest = asyncifyManifest(manifest);
        const server = muxrpc(null, asyncManifest)(this.sbot);
        const serverStream = server.createStream(() => { console.log('closed'); });
        pullStream(fromPage, serverStream, toPage);
      });
    });

  }
}

function asyncifyManifest(manifest) {
  if (typeof manifest !== 'object') return manifest
  let asyncified = {};
  for (let k in manifest) {
    var value = manifest[k];
    // Rewrite re-exported sync methods as async,
    if (value === 'sync') {
      value = 'async';
    }
    asyncified[k] = value;
  }
  return asyncified
}

customElements.define("app-runner", AppRunner);

var prism = createCommonjsModule(function (module) {
/* **********************************************
     Begin prism-core.js
********************************************** */

/// <reference lib="WebWorker"/>

var _self = (typeof window !== 'undefined')
	? window   // if in browser
	: (
		(typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope)
		? self // if in worker
		: {}   // if in node js
	);

/**
 * Prism: Lightweight, robust, elegant syntax highlighting
 *
 * @license MIT <https://opensource.org/licenses/MIT>
 * @author Lea Verou <https://lea.verou.me>
 * @namespace
 * @public
 */
var Prism = (function (_self){

// Private helper vars
var lang = /\blang(?:uage)?-([\w-]+)\b/i;
var uniqueId = 0;


var _ = {
	/**
	 * By default, Prism will attempt to highlight all code elements (by calling {@link Prism.highlightAll}) on the
	 * current page after the page finished loading. This might be a problem if e.g. you wanted to asynchronously load
	 * additional languages or plugins yourself.
	 *
	 * By setting this value to `true`, Prism will not automatically highlight all code elements on the page.
	 *
	 * You obviously have to change this value before the automatic highlighting started. To do this, you can add an
	 * empty Prism object into the global scope before loading the Prism script like this:
	 *
	 * ```js
	 * window.Prism = window.Prism || {};
	 * Prism.manual = true;
	 * // add a new <script> to load Prism's script
	 * ```
	 *
	 * @default false
	 * @type {boolean}
	 * @memberof Prism
	 * @public
	 */
	manual: _self.Prism && _self.Prism.manual,
	disableWorkerMessageHandler: _self.Prism && _self.Prism.disableWorkerMessageHandler,

	/**
	 * A namespace for utility methods.
	 *
	 * All function in this namespace that are not explicitly marked as _public_ are for __internal use only__ and may
	 * change or disappear at any time.
	 *
	 * @namespace
	 * @memberof Prism
	 */
	util: {
		encode: function encode(tokens) {
			if (tokens instanceof Token) {
				return new Token(tokens.type, encode(tokens.content), tokens.alias);
			} else if (Array.isArray(tokens)) {
				return tokens.map(encode);
			} else {
				return tokens.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
			}
		},

		/**
		 * Returns the name of the type of the given value.
		 *
		 * @param {any} o
		 * @returns {string}
		 * @example
		 * type(null)      === 'Null'
		 * type(undefined) === 'Undefined'
		 * type(123)       === 'Number'
		 * type('foo')     === 'String'
		 * type(true)      === 'Boolean'
		 * type([1, 2])    === 'Array'
		 * type({})        === 'Object'
		 * type(String)    === 'Function'
		 * type(/abc+/)    === 'RegExp'
		 */
		type: function (o) {
			return Object.prototype.toString.call(o).slice(8, -1);
		},

		/**
		 * Returns a unique number for the given object. Later calls will still return the same number.
		 *
		 * @param {Object} obj
		 * @returns {number}
		 */
		objId: function (obj) {
			if (!obj['__id']) {
				Object.defineProperty(obj, '__id', { value: ++uniqueId });
			}
			return obj['__id'];
		},

		/**
		 * Creates a deep clone of the given object.
		 *
		 * The main intended use of this function is to clone language definitions.
		 *
		 * @param {T} o
		 * @param {Record<number, any>} [visited]
		 * @returns {T}
		 * @template T
		 */
		clone: function deepClone(o, visited) {
			visited = visited || {};

			var clone, id;
			switch (_.util.type(o)) {
				case 'Object':
					id = _.util.objId(o);
					if (visited[id]) {
						return visited[id];
					}
					clone = /** @type {Record<string, any>} */ ({});
					visited[id] = clone;

					for (var key in o) {
						if (o.hasOwnProperty(key)) {
							clone[key] = deepClone(o[key], visited);
						}
					}

					return /** @type {any} */ (clone);

				case 'Array':
					id = _.util.objId(o);
					if (visited[id]) {
						return visited[id];
					}
					clone = [];
					visited[id] = clone;

					(/** @type {Array} */(/** @type {any} */(o))).forEach(function (v, i) {
						clone[i] = deepClone(v, visited);
					});

					return /** @type {any} */ (clone);

				default:
					return o;
			}
		},

		/**
		 * Returns the Prism language of the given element set by a `language-xxxx` or `lang-xxxx` class.
		 *
		 * If no language is set for the element or the element is `null` or `undefined`, `none` will be returned.
		 *
		 * @param {Element} element
		 * @returns {string}
		 */
		getLanguage: function (element) {
			while (element && !lang.test(element.className)) {
				element = element.parentElement;
			}
			if (element) {
				return (element.className.match(lang) || [, 'none'])[1].toLowerCase();
			}
			return 'none';
		},

		/**
		 * Returns the script element that is currently executing.
		 *
		 * This does __not__ work for line script element.
		 *
		 * @returns {HTMLScriptElement | null}
		 */
		currentScript: function () {
			if (typeof document === 'undefined') {
				return null;
			}
			if ('currentScript' in document && 1 < 2 /* hack to trip TS' flow analysis */) {
				return /** @type {any} */ (document.currentScript);
			}

			// IE11 workaround
			// we'll get the src of the current script by parsing IE11's error stack trace
			// this will not work for inline scripts

			try {
				throw new Error();
			} catch (err) {
				// Get file src url from stack. Specifically works with the format of stack traces in IE.
				// A stack will look like this:
				//
				// Error
				//    at _.util.currentScript (http://localhost/components/prism-core.js:119:5)
				//    at Global code (http://localhost/components/prism-core.js:606:1)

				var src = (/at [^(\r\n]*\((.*):.+:.+\)$/i.exec(err.stack) || [])[1];
				if (src) {
					var scripts = document.getElementsByTagName('script');
					for (var i in scripts) {
						if (scripts[i].src == src) {
							return scripts[i];
						}
					}
				}
				return null;
			}
		},

		/**
		 * Returns whether a given class is active for `element`.
		 *
		 * The class can be activated if `element` or one of its ancestors has the given class and it can be deactivated
		 * if `element` or one of its ancestors has the negated version of the given class. The _negated version_ of the
		 * given class is just the given class with a `no-` prefix.
		 *
		 * Whether the class is active is determined by the closest ancestor of `element` (where `element` itself is
		 * closest ancestor) that has the given class or the negated version of it. If neither `element` nor any of its
		 * ancestors have the given class or the negated version of it, then the default activation will be returned.
		 *
		 * In the paradoxical situation where the closest ancestor contains __both__ the given class and the negated
		 * version of it, the class is considered active.
		 *
		 * @param {Element} element
		 * @param {string} className
		 * @param {boolean} [defaultActivation=false]
		 * @returns {boolean}
		 */
		isActive: function (element, className, defaultActivation) {
			var no = 'no-' + className;

			while (element) {
				var classList = element.classList;
				if (classList.contains(className)) {
					return true;
				}
				if (classList.contains(no)) {
					return false;
				}
				element = element.parentElement;
			}
			return !!defaultActivation;
		}
	},

	/**
	 * This namespace contains all currently loaded languages and the some helper functions to create and modify languages.
	 *
	 * @namespace
	 * @memberof Prism
	 * @public
	 */
	languages: {
		/**
		 * Creates a deep copy of the language with the given id and appends the given tokens.
		 *
		 * If a token in `redef` also appears in the copied language, then the existing token in the copied language
		 * will be overwritten at its original position.
		 *
		 * ## Best practices
		 *
		 * Since the position of overwriting tokens (token in `redef` that overwrite tokens in the copied language)
		 * doesn't matter, they can technically be in any order. However, this can be confusing to others that trying to
		 * understand the language definition because, normally, the order of tokens matters in Prism grammars.
		 *
		 * Therefore, it is encouraged to order overwriting tokens according to the positions of the overwritten tokens.
		 * Furthermore, all non-overwriting tokens should be placed after the overwriting ones.
		 *
		 * @param {string} id The id of the language to extend. This has to be a key in `Prism.languages`.
		 * @param {Grammar} redef The new tokens to append.
		 * @returns {Grammar} The new language created.
		 * @public
		 * @example
		 * Prism.languages['css-with-colors'] = Prism.languages.extend('css', {
		 *     // Prism.languages.css already has a 'comment' token, so this token will overwrite CSS' 'comment' token
		 *     // at its original position
		 *     'comment': { ... },
		 *     // CSS doesn't have a 'color' token, so this token will be appended
		 *     'color': /\b(?:red|green|blue)\b/
		 * });
		 */
		extend: function (id, redef) {
			var lang = _.util.clone(_.languages[id]);

			for (var key in redef) {
				lang[key] = redef[key];
			}

			return lang;
		},

		/**
		 * Inserts tokens _before_ another token in a language definition or any other grammar.
		 *
		 * ## Usage
		 *
		 * This helper method makes it easy to modify existing languages. For example, the CSS language definition
		 * not only defines CSS highlighting for CSS documents, but also needs to define highlighting for CSS embedded
		 * in HTML through `<style>` elements. To do this, it needs to modify `Prism.languages.markup` and add the
		 * appropriate tokens. However, `Prism.languages.markup` is a regular JavaScript object literal, so if you do
		 * this:
		 *
		 * ```js
		 * Prism.languages.markup.style = {
		 *     // token
		 * };
		 * ```
		 *
		 * then the `style` token will be added (and processed) at the end. `insertBefore` allows you to insert tokens
		 * before existing tokens. For the CSS example above, you would use it like this:
		 *
		 * ```js
		 * Prism.languages.insertBefore('markup', 'cdata', {
		 *     'style': {
		 *         // token
		 *     }
		 * });
		 * ```
		 *
		 * ## Special cases
		 *
		 * If the grammars of `inside` and `insert` have tokens with the same name, the tokens in `inside`'s grammar
		 * will be ignored.
		 *
		 * This behavior can be used to insert tokens after `before`:
		 *
		 * ```js
		 * Prism.languages.insertBefore('markup', 'comment', {
		 *     'comment': Prism.languages.markup.comment,
		 *     // tokens after 'comment'
		 * });
		 * ```
		 *
		 * ## Limitations
		 *
		 * The main problem `insertBefore` has to solve is iteration order. Since ES2015, the iteration order for object
		 * properties is guaranteed to be the insertion order (except for integer keys) but some browsers behave
		 * differently when keys are deleted and re-inserted. So `insertBefore` can't be implemented by temporarily
		 * deleting properties which is necessary to insert at arbitrary positions.
		 *
		 * To solve this problem, `insertBefore` doesn't actually insert the given tokens into the target object.
		 * Instead, it will create a new object and replace all references to the target object with the new one. This
		 * can be done without temporarily deleting properties, so the iteration order is well-defined.
		 *
		 * However, only references that can be reached from `Prism.languages` or `insert` will be replaced. I.e. if
		 * you hold the target object in a variable, then the value of the variable will not change.
		 *
		 * ```js
		 * var oldMarkup = Prism.languages.markup;
		 * var newMarkup = Prism.languages.insertBefore('markup', 'comment', { ... });
		 *
		 * assert(oldMarkup !== Prism.languages.markup);
		 * assert(newMarkup === Prism.languages.markup);
		 * ```
		 *
		 * @param {string} inside The property of `root` (e.g. a language id in `Prism.languages`) that contains the
		 * object to be modified.
		 * @param {string} before The key to insert before.
		 * @param {Grammar} insert An object containing the key-value pairs to be inserted.
		 * @param {Object<string, any>} [root] The object containing `inside`, i.e. the object that contains the
		 * object to be modified.
		 *
		 * Defaults to `Prism.languages`.
		 * @returns {Grammar} The new grammar object.
		 * @public
		 */
		insertBefore: function (inside, before, insert, root) {
			root = root || /** @type {any} */ (_.languages);
			var grammar = root[inside];
			/** @type {Grammar} */
			var ret = {};

			for (var token in grammar) {
				if (grammar.hasOwnProperty(token)) {

					if (token == before) {
						for (var newToken in insert) {
							if (insert.hasOwnProperty(newToken)) {
								ret[newToken] = insert[newToken];
							}
						}
					}

					// Do not insert token which also occur in insert. See #1525
					if (!insert.hasOwnProperty(token)) {
						ret[token] = grammar[token];
					}
				}
			}

			var old = root[inside];
			root[inside] = ret;

			// Update references in other language definitions
			_.languages.DFS(_.languages, function(key, value) {
				if (value === old && key != inside) {
					this[key] = ret;
				}
			});

			return ret;
		},

		// Traverse a language definition with Depth First Search
		DFS: function DFS(o, callback, type, visited) {
			visited = visited || {};

			var objId = _.util.objId;

			for (var i in o) {
				if (o.hasOwnProperty(i)) {
					callback.call(o, i, o[i], type || i);

					var property = o[i],
					    propertyType = _.util.type(property);

					if (propertyType === 'Object' && !visited[objId(property)]) {
						visited[objId(property)] = true;
						DFS(property, callback, null, visited);
					}
					else if (propertyType === 'Array' && !visited[objId(property)]) {
						visited[objId(property)] = true;
						DFS(property, callback, i, visited);
					}
				}
			}
		}
	},

	plugins: {},

	/**
	 * This is the most high-level function in Prism’s API.
	 * It fetches all the elements that have a `.language-xxxx` class and then calls {@link Prism.highlightElement} on
	 * each one of them.
	 *
	 * This is equivalent to `Prism.highlightAllUnder(document, async, callback)`.
	 *
	 * @param {boolean} [async=false] Same as in {@link Prism.highlightAllUnder}.
	 * @param {HighlightCallback} [callback] Same as in {@link Prism.highlightAllUnder}.
	 * @memberof Prism
	 * @public
	 */
	highlightAll: function(async, callback) {
		_.highlightAllUnder(document, async, callback);
	},

	/**
	 * Fetches all the descendants of `container` that have a `.language-xxxx` class and then calls
	 * {@link Prism.highlightElement} on each one of them.
	 *
	 * The following hooks will be run:
	 * 1. `before-highlightall`
	 * 2. `before-all-elements-highlight`
	 * 3. All hooks of {@link Prism.highlightElement} for each element.
	 *
	 * @param {ParentNode} container The root element, whose descendants that have a `.language-xxxx` class will be highlighted.
	 * @param {boolean} [async=false] Whether each element is to be highlighted asynchronously using Web Workers.
	 * @param {HighlightCallback} [callback] An optional callback to be invoked on each element after its highlighting is done.
	 * @memberof Prism
	 * @public
	 */
	highlightAllUnder: function(container, async, callback) {
		var env = {
			callback: callback,
			container: container,
			selector: 'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'
		};

		_.hooks.run('before-highlightall', env);

		env.elements = Array.prototype.slice.apply(env.container.querySelectorAll(env.selector));

		_.hooks.run('before-all-elements-highlight', env);

		for (var i = 0, element; element = env.elements[i++];) {
			_.highlightElement(element, async === true, env.callback);
		}
	},

	/**
	 * Highlights the code inside a single element.
	 *
	 * The following hooks will be run:
	 * 1. `before-sanity-check`
	 * 2. `before-highlight`
	 * 3. All hooks of {@link Prism.highlight}. These hooks will be run by an asynchronous worker if `async` is `true`.
	 * 4. `before-insert`
	 * 5. `after-highlight`
	 * 6. `complete`
	 *
	 * Some the above hooks will be skipped if the element doesn't contain any text or there is no grammar loaded for
	 * the element's language.
	 *
	 * @param {Element} element The element containing the code.
	 * It must have a class of `language-xxxx` to be processed, where `xxxx` is a valid language identifier.
	 * @param {boolean} [async=false] Whether the element is to be highlighted asynchronously using Web Workers
	 * to improve performance and avoid blocking the UI when highlighting very large chunks of code. This option is
	 * [disabled by default](https://prismjs.com/faq.html#why-is-asynchronous-highlighting-disabled-by-default).
	 *
	 * Note: All language definitions required to highlight the code must be included in the main `prism.js` file for
	 * asynchronous highlighting to work. You can build your own bundle on the
	 * [Download page](https://prismjs.com/download.html).
	 * @param {HighlightCallback} [callback] An optional callback to be invoked after the highlighting is done.
	 * Mostly useful when `async` is `true`, since in that case, the highlighting is done asynchronously.
	 * @memberof Prism
	 * @public
	 */
	highlightElement: function(element, async, callback) {
		// Find language
		var language = _.util.getLanguage(element);
		var grammar = _.languages[language];

		// Set language on the element, if not present
		element.className = element.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;

		// Set language on the parent, for styling
		var parent = element.parentElement;
		if (parent && parent.nodeName.toLowerCase() === 'pre') {
			parent.className = parent.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;
		}

		var code = element.textContent;

		var env = {
			element: element,
			language: language,
			grammar: grammar,
			code: code
		};

		function insertHighlightedCode(highlightedCode) {
			env.highlightedCode = highlightedCode;

			_.hooks.run('before-insert', env);

			env.element.innerHTML = env.highlightedCode;

			_.hooks.run('after-highlight', env);
			_.hooks.run('complete', env);
			callback && callback.call(env.element);
		}

		_.hooks.run('before-sanity-check', env);

		if (!env.code) {
			_.hooks.run('complete', env);
			callback && callback.call(env.element);
			return;
		}

		_.hooks.run('before-highlight', env);

		if (!env.grammar) {
			insertHighlightedCode(_.util.encode(env.code));
			return;
		}

		if (async && _self.Worker) {
			var worker = new Worker(_.filename);

			worker.onmessage = function(evt) {
				insertHighlightedCode(evt.data);
			};

			worker.postMessage(JSON.stringify({
				language: env.language,
				code: env.code,
				immediateClose: true
			}));
		}
		else {
			insertHighlightedCode(_.highlight(env.code, env.grammar, env.language));
		}
	},

	/**
	 * Low-level function, only use if you know what you’re doing. It accepts a string of text as input
	 * and the language definitions to use, and returns a string with the HTML produced.
	 *
	 * The following hooks will be run:
	 * 1. `before-tokenize`
	 * 2. `after-tokenize`
	 * 3. `wrap`: On each {@link Token}.
	 *
	 * @param {string} text A string with the code to be highlighted.
	 * @param {Grammar} grammar An object containing the tokens to use.
	 *
	 * Usually a language definition like `Prism.languages.markup`.
	 * @param {string} language The name of the language definition passed to `grammar`.
	 * @returns {string} The highlighted HTML.
	 * @memberof Prism
	 * @public
	 * @example
	 * Prism.highlight('var foo = true;', Prism.languages.javascript, 'javascript');
	 */
	highlight: function (text, grammar, language) {
		var env = {
			code: text,
			grammar: grammar,
			language: language
		};
		_.hooks.run('before-tokenize', env);
		env.tokens = _.tokenize(env.code, env.grammar);
		_.hooks.run('after-tokenize', env);
		return Token.stringify(_.util.encode(env.tokens), env.language);
	},

	/**
	 * This is the heart of Prism, and the most low-level function you can use. It accepts a string of text as input
	 * and the language definitions to use, and returns an array with the tokenized code.
	 *
	 * When the language definition includes nested tokens, the function is called recursively on each of these tokens.
	 *
	 * This method could be useful in other contexts as well, as a very crude parser.
	 *
	 * @param {string} text A string with the code to be highlighted.
	 * @param {Grammar} grammar An object containing the tokens to use.
	 *
	 * Usually a language definition like `Prism.languages.markup`.
	 * @returns {TokenStream} An array of strings and tokens, a token stream.
	 * @memberof Prism
	 * @public
	 * @example
	 * let code = `var foo = 0;`;
	 * let tokens = Prism.tokenize(code, Prism.languages.javascript);
	 * tokens.forEach(token => {
	 *     if (token instanceof Prism.Token && token.type === 'number') {
	 *         console.log(`Found numeric literal: ${token.content}`);
	 *     }
	 * });
	 */
	tokenize: function(text, grammar) {
		var rest = grammar.rest;
		if (rest) {
			for (var token in rest) {
				grammar[token] = rest[token];
			}

			delete grammar.rest;
		}

		var tokenList = new LinkedList();
		addAfter(tokenList, tokenList.head, text);

		matchGrammar(text, tokenList, grammar, tokenList.head, 0);

		return toArray(tokenList);
	},

	/**
	 * @namespace
	 * @memberof Prism
	 * @public
	 */
	hooks: {
		all: {},

		/**
		 * Adds the given callback to the list of callbacks for the given hook.
		 *
		 * The callback will be invoked when the hook it is registered for is run.
		 * Hooks are usually directly run by a highlight function but you can also run hooks yourself.
		 *
		 * One callback function can be registered to multiple hooks and the same hook multiple times.
		 *
		 * @param {string} name The name of the hook.
		 * @param {HookCallback} callback The callback function which is given environment variables.
		 * @public
		 */
		add: function (name, callback) {
			var hooks = _.hooks.all;

			hooks[name] = hooks[name] || [];

			hooks[name].push(callback);
		},

		/**
		 * Runs a hook invoking all registered callbacks with the given environment variables.
		 *
		 * Callbacks will be invoked synchronously and in the order in which they were registered.
		 *
		 * @param {string} name The name of the hook.
		 * @param {Object<string, any>} env The environment variables of the hook passed to all callbacks registered.
		 * @public
		 */
		run: function (name, env) {
			var callbacks = _.hooks.all[name];

			if (!callbacks || !callbacks.length) {
				return;
			}

			for (var i=0, callback; callback = callbacks[i++];) {
				callback(env);
			}
		}
	},

	Token: Token
};
_self.Prism = _;


// Typescript note:
// The following can be used to import the Token type in JSDoc:
//
//   @typedef {InstanceType<import("./prism-core")["Token"]>} Token

/**
 * Creates a new token.
 *
 * @param {string} type See {@link Token#type type}
 * @param {string | TokenStream} content See {@link Token#content content}
 * @param {string|string[]} [alias] The alias(es) of the token.
 * @param {string} [matchedStr=""] A copy of the full string this token was created from.
 * @class
 * @global
 * @public
 */
function Token(type, content, alias, matchedStr) {
	/**
	 * The type of the token.
	 *
	 * This is usually the key of a pattern in a {@link Grammar}.
	 *
	 * @type {string}
	 * @see GrammarToken
	 * @public
	 */
	this.type = type;
	/**
	 * The strings or tokens contained by this token.
	 *
	 * This will be a token stream if the pattern matched also defined an `inside` grammar.
	 *
	 * @type {string | TokenStream}
	 * @public
	 */
	this.content = content;
	/**
	 * The alias(es) of the token.
	 *
	 * @type {string|string[]}
	 * @see GrammarToken
	 * @public
	 */
	this.alias = alias;
	// Copy of the full string this token was created from
	this.length = (matchedStr || '').length | 0;
}

/**
 * A token stream is an array of strings and {@link Token Token} objects.
 *
 * Token streams have to fulfill a few properties that are assumed by most functions (mostly internal ones) that process
 * them.
 *
 * 1. No adjacent strings.
 * 2. No empty strings.
 *
 *    The only exception here is the token stream that only contains the empty string and nothing else.
 *
 * @typedef {Array<string | Token>} TokenStream
 * @global
 * @public
 */

/**
 * Converts the given token or token stream to an HTML representation.
 *
 * The following hooks will be run:
 * 1. `wrap`: On each {@link Token}.
 *
 * @param {string | Token | TokenStream} o The token or token stream to be converted.
 * @param {string} language The name of current language.
 * @returns {string} The HTML representation of the token or token stream.
 * @memberof Token
 * @static
 */
Token.stringify = function stringify(o, language) {
	if (typeof o == 'string') {
		return o;
	}
	if (Array.isArray(o)) {
		var s = '';
		o.forEach(function (e) {
			s += stringify(e, language);
		});
		return s;
	}

	var env = {
		type: o.type,
		content: stringify(o.content, language),
		tag: 'span',
		classes: ['token', o.type],
		attributes: {},
		language: language
	};

	var aliases = o.alias;
	if (aliases) {
		if (Array.isArray(aliases)) {
			Array.prototype.push.apply(env.classes, aliases);
		} else {
			env.classes.push(aliases);
		}
	}

	_.hooks.run('wrap', env);

	var attributes = '';
	for (var name in env.attributes) {
		attributes += ' ' + name + '="' + (env.attributes[name] || '').replace(/"/g, '&quot;') + '"';
	}

	return '<' + env.tag + ' class="' + env.classes.join(' ') + '"' + attributes + '>' + env.content + '</' + env.tag + '>';
};

/**
 * @param {RegExp} pattern
 * @param {number} pos
 * @param {string} text
 * @param {boolean} lookbehind
 * @returns {RegExpExecArray | null}
 */
function matchPattern(pattern, pos, text, lookbehind) {
	pattern.lastIndex = pos;
	var match = pattern.exec(text);
	if (match && lookbehind && match[1]) {
		// change the match to remove the text matched by the Prism lookbehind group
		var lookbehindLength = match[1].length;
		match.index += lookbehindLength;
		match[0] = match[0].slice(lookbehindLength);
	}
	return match;
}

/**
 * @param {string} text
 * @param {LinkedList<string | Token>} tokenList
 * @param {any} grammar
 * @param {LinkedListNode<string | Token>} startNode
 * @param {number} startPos
 * @param {RematchOptions} [rematch]
 * @returns {void}
 * @private
 *
 * @typedef RematchOptions
 * @property {string} cause
 * @property {number} reach
 */
function matchGrammar(text, tokenList, grammar, startNode, startPos, rematch) {
	for (var token in grammar) {
		if (!grammar.hasOwnProperty(token) || !grammar[token]) {
			continue;
		}

		var patterns = grammar[token];
		patterns = Array.isArray(patterns) ? patterns : [patterns];

		for (var j = 0; j < patterns.length; ++j) {
			if (rematch && rematch.cause == token + ',' + j) {
				return;
			}

			var patternObj = patterns[j],
				inside = patternObj.inside,
				lookbehind = !!patternObj.lookbehind,
				greedy = !!patternObj.greedy,
				alias = patternObj.alias;

			if (greedy && !patternObj.pattern.global) {
				// Without the global flag, lastIndex won't work
				var flags = patternObj.pattern.toString().match(/[imsuy]*$/)[0];
				patternObj.pattern = RegExp(patternObj.pattern.source, flags + 'g');
			}

			/** @type {RegExp} */
			var pattern = patternObj.pattern || patternObj;

			for ( // iterate the token list and keep track of the current token/string position
				var currentNode = startNode.next, pos = startPos;
				currentNode !== tokenList.tail;
				pos += currentNode.value.length, currentNode = currentNode.next
			) {

				if (rematch && pos >= rematch.reach) {
					break;
				}

				var str = currentNode.value;

				if (tokenList.length > text.length) {
					// Something went terribly wrong, ABORT, ABORT!
					return;
				}

				if (str instanceof Token) {
					continue;
				}

				var removeCount = 1; // this is the to parameter of removeBetween
				var match;

				if (greedy) {
					match = matchPattern(pattern, pos, text, lookbehind);
					if (!match) {
						break;
					}

					var from = match.index;
					var to = match.index + match[0].length;
					var p = pos;

					// find the node that contains the match
					p += currentNode.value.length;
					while (from >= p) {
						currentNode = currentNode.next;
						p += currentNode.value.length;
					}
					// adjust pos (and p)
					p -= currentNode.value.length;
					pos = p;

					// the current node is a Token, then the match starts inside another Token, which is invalid
					if (currentNode.value instanceof Token) {
						continue;
					}

					// find the last node which is affected by this match
					for (
						var k = currentNode;
						k !== tokenList.tail && (p < to || typeof k.value === 'string');
						k = k.next
					) {
						removeCount++;
						p += k.value.length;
					}
					removeCount--;

					// replace with the new match
					str = text.slice(pos, p);
					match.index -= pos;
				} else {
					match = matchPattern(pattern, 0, str, lookbehind);
					if (!match) {
						continue;
					}
				}

				var from = match.index,
					matchStr = match[0],
					before = str.slice(0, from),
					after = str.slice(from + matchStr.length);

				var reach = pos + str.length;
				if (rematch && reach > rematch.reach) {
					rematch.reach = reach;
				}

				var removeFrom = currentNode.prev;

				if (before) {
					removeFrom = addAfter(tokenList, removeFrom, before);
					pos += before.length;
				}

				removeRange(tokenList, removeFrom, removeCount);

				var wrapped = new Token(token, inside ? _.tokenize(matchStr, inside) : matchStr, alias, matchStr);
				currentNode = addAfter(tokenList, removeFrom, wrapped);

				if (after) {
					addAfter(tokenList, currentNode, after);
				}

				if (removeCount > 1) {
					// at least one Token object was removed, so we have to do some rematching
					// this can only happen if the current pattern is greedy
					matchGrammar(text, tokenList, grammar, currentNode.prev, pos, {
						cause: token + ',' + j,
						reach: reach
					});
				}
			}
		}
	}
}

/**
 * @typedef LinkedListNode
 * @property {T} value
 * @property {LinkedListNode<T> | null} prev The previous node.
 * @property {LinkedListNode<T> | null} next The next node.
 * @template T
 * @private
 */

/**
 * @template T
 * @private
 */
function LinkedList() {
	/** @type {LinkedListNode<T>} */
	var head = { value: null, prev: null, next: null };
	/** @type {LinkedListNode<T>} */
	var tail = { value: null, prev: head, next: null };
	head.next = tail;

	/** @type {LinkedListNode<T>} */
	this.head = head;
	/** @type {LinkedListNode<T>} */
	this.tail = tail;
	this.length = 0;
}

/**
 * Adds a new node with the given value to the list.
 * @param {LinkedList<T>} list
 * @param {LinkedListNode<T>} node
 * @param {T} value
 * @returns {LinkedListNode<T>} The added node.
 * @template T
 */
function addAfter(list, node, value) {
	// assumes that node != list.tail && values.length >= 0
	var next = node.next;

	var newNode = { value: value, prev: node, next: next };
	node.next = newNode;
	next.prev = newNode;
	list.length++;

	return newNode;
}
/**
 * Removes `count` nodes after the given node. The given node will not be removed.
 * @param {LinkedList<T>} list
 * @param {LinkedListNode<T>} node
 * @param {number} count
 * @template T
 */
function removeRange(list, node, count) {
	var next = node.next;
	for (var i = 0; i < count && next !== list.tail; i++) {
		next = next.next;
	}
	node.next = next;
	next.prev = node;
	list.length -= i;
}
/**
 * @param {LinkedList<T>} list
 * @returns {T[]}
 * @template T
 */
function toArray(list) {
	var array = [];
	var node = list.head.next;
	while (node !== list.tail) {
		array.push(node.value);
		node = node.next;
	}
	return array;
}


if (!_self.document) {
	if (!_self.addEventListener) {
		// in Node.js
		return _;
	}

	if (!_.disableWorkerMessageHandler) {
		// In worker
		_self.addEventListener('message', function (evt) {
			var message = JSON.parse(evt.data),
				lang = message.language,
				code = message.code,
				immediateClose = message.immediateClose;

			_self.postMessage(_.highlight(code, _.languages[lang], lang));
			if (immediateClose) {
				_self.close();
			}
		}, false);
	}

	return _;
}

// Get current script and highlight
var script = _.util.currentScript();

if (script) {
	_.filename = script.src;

	if (script.hasAttribute('data-manual')) {
		_.manual = true;
	}
}

function highlightAutomaticallyCallback() {
	if (!_.manual) {
		_.highlightAll();
	}
}

if (!_.manual) {
	// If the document state is "loading", then we'll use DOMContentLoaded.
	// If the document state is "interactive" and the prism.js script is deferred, then we'll also use the
	// DOMContentLoaded event because there might be some plugins or languages which have also been deferred and they
	// might take longer one animation frame to execute which can create a race condition where only some plugins have
	// been loaded when Prism.highlightAll() is executed, depending on how fast resources are loaded.
	// See https://github.com/PrismJS/prism/issues/2102
	var readyState = document.readyState;
	if (readyState === 'loading' || readyState === 'interactive' && script && script.defer) {
		document.addEventListener('DOMContentLoaded', highlightAutomaticallyCallback);
	} else {
		if (window.requestAnimationFrame) {
			window.requestAnimationFrame(highlightAutomaticallyCallback);
		} else {
			window.setTimeout(highlightAutomaticallyCallback, 16);
		}
	}
}

return _;

})(_self);

if ( module.exports) {
	module.exports = Prism;
}

// hack for components to work correctly in node.js
if (typeof commonjsGlobal !== 'undefined') {
	commonjsGlobal.Prism = Prism;
}

// some additional documentation/types

/**
 * The expansion of a simple `RegExp` literal to support additional properties.
 *
 * @typedef GrammarToken
 * @property {RegExp} pattern The regular expression of the token.
 * @property {boolean} [lookbehind=false] If `true`, then the first capturing group of `pattern` will (effectively)
 * behave as a lookbehind group meaning that the captured text will not be part of the matched text of the new token.
 * @property {boolean} [greedy=false] Whether the token is greedy.
 * @property {string|string[]} [alias] An optional alias or list of aliases.
 * @property {Grammar} [inside] The nested grammar of this token.
 *
 * The `inside` grammar will be used to tokenize the text value of each token of this kind.
 *
 * This can be used to make nested and even recursive language definitions.
 *
 * Note: This can cause infinite recursion. Be careful when you embed different languages or even the same language into
 * each another.
 * @global
 * @public
*/

/**
 * @typedef Grammar
 * @type {Object<string, RegExp | GrammarToken | Array<RegExp | GrammarToken>>}
 * @property {Grammar} [rest] An optional grammar object that will be appended to this grammar.
 * @global
 * @public
 */

/**
 * A function which will invoked after an element was successfully highlighted.
 *
 * @callback HighlightCallback
 * @param {Element} element The element successfully highlighted.
 * @returns {void}
 * @global
 * @public
*/

/**
 * @callback HookCallback
 * @param {Object<string, any>} env The environment variables of the hook.
 * @returns {void}
 * @global
 * @public
 */


/* **********************************************
     Begin prism-markup.js
********************************************** */

Prism.languages.markup = {
	'comment': /<!--[\s\S]*?-->/,
	'prolog': /<\?[\s\S]+?\?>/,
	'doctype': {
		// https://www.w3.org/TR/xml/#NT-doctypedecl
		pattern: /<!DOCTYPE(?:[^>"'[\]]|"[^"]*"|'[^']*')+(?:\[(?:[^<"'\]]|"[^"]*"|'[^']*'|<(?!!--)|<!--(?:[^-]|-(?!->))*-->)*\]\s*)?>/i,
		greedy: true,
		inside: {
			'internal-subset': {
				pattern: /(\[)[\s\S]+(?=\]>$)/,
				lookbehind: true,
				greedy: true,
				inside: null // see below
			},
			'string': {
				pattern: /"[^"]*"|'[^']*'/,
				greedy: true
			},
			'punctuation': /^<!|>$|[[\]]/,
			'doctype-tag': /^DOCTYPE/,
			'name': /[^\s<>'"]+/
		}
	},
	'cdata': /<!\[CDATA\[[\s\S]*?]]>/i,
	'tag': {
		pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/,
		greedy: true,
		inside: {
			'tag': {
				pattern: /^<\/?[^\s>\/]+/,
				inside: {
					'punctuation': /^<\/?/,
					'namespace': /^[^\s>\/:]+:/
				}
			},
			'attr-value': {
				pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/,
				inside: {
					'punctuation': [
						{
							pattern: /^=/,
							alias: 'attr-equals'
						},
						/"|'/
					]
				}
			},
			'punctuation': /\/?>/,
			'attr-name': {
				pattern: /[^\s>\/]+/,
				inside: {
					'namespace': /^[^\s>\/:]+:/
				}
			}

		}
	},
	'entity': [
		{
			pattern: /&[\da-z]{1,8};/i,
			alias: 'named-entity'
		},
		/&#x?[\da-f]{1,8};/i
	]
};

Prism.languages.markup['tag'].inside['attr-value'].inside['entity'] =
	Prism.languages.markup['entity'];
Prism.languages.markup['doctype'].inside['internal-subset'].inside = Prism.languages.markup;

// Plugin to make entity title show the real entity, idea by Roman Komarov
Prism.hooks.add('wrap', function (env) {

	if (env.type === 'entity') {
		env.attributes['title'] = env.content.replace(/&amp;/, '&');
	}
});

Object.defineProperty(Prism.languages.markup.tag, 'addInlined', {
	/**
	 * Adds an inlined language to markup.
	 *
	 * An example of an inlined language is CSS with `<style>` tags.
	 *
	 * @param {string} tagName The name of the tag that contains the inlined language. This name will be treated as
	 * case insensitive.
	 * @param {string} lang The language key.
	 * @example
	 * addInlined('style', 'css');
	 */
	value: function addInlined(tagName, lang) {
		var includedCdataInside = {};
		includedCdataInside['language-' + lang] = {
			pattern: /(^<!\[CDATA\[)[\s\S]+?(?=\]\]>$)/i,
			lookbehind: true,
			inside: Prism.languages[lang]
		};
		includedCdataInside['cdata'] = /^<!\[CDATA\[|\]\]>$/i;

		var inside = {
			'included-cdata': {
				pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
				inside: includedCdataInside
			}
		};
		inside['language-' + lang] = {
			pattern: /[\s\S]+/,
			inside: Prism.languages[lang]
		};

		var def = {};
		def[tagName] = {
			pattern: RegExp(/(<__[^>]*>)(?:<!\[CDATA\[(?:[^\]]|\](?!\]>))*\]\]>|(?!<!\[CDATA\[)[\s\S])*?(?=<\/__>)/.source.replace(/__/g, function () { return tagName; }), 'i'),
			lookbehind: true,
			greedy: true,
			inside: inside
		};

		Prism.languages.insertBefore('markup', 'cdata', def);
	}
});

Prism.languages.html = Prism.languages.markup;
Prism.languages.mathml = Prism.languages.markup;
Prism.languages.svg = Prism.languages.markup;

Prism.languages.xml = Prism.languages.extend('markup', {});
Prism.languages.ssml = Prism.languages.xml;
Prism.languages.atom = Prism.languages.xml;
Prism.languages.rss = Prism.languages.xml;


/* **********************************************
     Begin prism-css.js
********************************************** */

(function (Prism) {

	var string = /("|')(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/;

	Prism.languages.css = {
		'comment': /\/\*[\s\S]*?\*\//,
		'atrule': {
			pattern: /@[\w-](?:[^;{\s]|\s+(?![\s{]))*(?:;|(?=\s*\{))/,
			inside: {
				'rule': /^@[\w-]+/,
				'selector-function-argument': {
					pattern: /(\bselector\s*\(\s*(?![\s)]))(?:[^()\s]|\s+(?![\s)])|\((?:[^()]|\([^()]*\))*\))+(?=\s*\))/,
					lookbehind: true,
					alias: 'selector'
				},
				'keyword': {
					pattern: /(^|[^\w-])(?:and|not|only|or)(?![\w-])/,
					lookbehind: true
				}
				// See rest below
			}
		},
		'url': {
			// https://drafts.csswg.org/css-values-3/#urls
			pattern: RegExp('\\burl\\((?:' + string.source + '|' + /(?:[^\\\r\n()"']|\\[\s\S])*/.source + ')\\)', 'i'),
			greedy: true,
			inside: {
				'function': /^url/i,
				'punctuation': /^\(|\)$/,
				'string': {
					pattern: RegExp('^' + string.source + '$'),
					alias: 'url'
				}
			}
		},
		'selector': RegExp('[^{}\\s](?:[^{};"\'\\s]|\\s+(?![\\s{])|' + string.source + ')*(?=\\s*\\{)'),
		'string': {
			pattern: string,
			greedy: true
		},
		'property': /(?!\s)[-_a-z\xA0-\uFFFF](?:(?!\s)[-\w\xA0-\uFFFF])*(?=\s*:)/i,
		'important': /!important\b/i,
		'function': /[-a-z0-9]+(?=\()/i,
		'punctuation': /[(){};:,]/
	};

	Prism.languages.css['atrule'].inside.rest = Prism.languages.css;

	var markup = Prism.languages.markup;
	if (markup) {
		markup.tag.addInlined('style', 'css');

		Prism.languages.insertBefore('inside', 'attr-value', {
			'style-attr': {
				pattern: /(^|["'\s])style\s*=\s*(?:"[^"]*"|'[^']*')/i,
				lookbehind: true,
				inside: {
					'attr-value': {
						pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/,
						inside: {
							'style': {
								pattern: /(["'])[\s\S]+(?=["']$)/,
								lookbehind: true,
								alias: 'language-css',
								inside: Prism.languages.css
							},
							'punctuation': [
								{
									pattern: /^=/,
									alias: 'attr-equals'
								},
								/"|'/
							]
						}
					},
					'attr-name': /^style/i
				}
			}
		}, markup.tag);
	}

}(Prism));


/* **********************************************
     Begin prism-clike.js
********************************************** */

Prism.languages.clike = {
	'comment': [
		{
			pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
			lookbehind: true,
			greedy: true
		},
		{
			pattern: /(^|[^\\:])\/\/.*/,
			lookbehind: true,
			greedy: true
		}
	],
	'string': {
		pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
		greedy: true
	},
	'class-name': {
		pattern: /(\b(?:class|interface|extends|implements|trait|instanceof|new)\s+|\bcatch\s+\()[\w.\\]+/i,
		lookbehind: true,
		inside: {
			'punctuation': /[.\\]/
		}
	},
	'keyword': /\b(?:if|else|while|do|for|return|in|instanceof|function|new|try|throw|catch|finally|null|break|continue)\b/,
	'boolean': /\b(?:true|false)\b/,
	'function': /\w+(?=\()/,
	'number': /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
	'operator': /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]/,
	'punctuation': /[{}[\];(),.:]/
};


/* **********************************************
     Begin prism-javascript.js
********************************************** */

Prism.languages.javascript = Prism.languages.extend('clike', {
	'class-name': [
		Prism.languages.clike['class-name'],
		{
			pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$A-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\.(?:prototype|constructor))/,
			lookbehind: true
		}
	],
	'keyword': [
		{
			pattern: /((?:^|})\s*)(?:catch|finally)\b/,
			lookbehind: true
		},
		{
			pattern: /(^|[^.]|\.\.\.\s*)\b(?:as|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|for|from|function|(?:get|set)(?=\s*[\[$\w\xA0-\uFFFF])|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
			lookbehind: true
		},
	],
	// Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
	'function': /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
	'number': /\b(?:(?:0[xX](?:[\dA-Fa-f](?:_[\dA-Fa-f])?)+|0[bB](?:[01](?:_[01])?)+|0[oO](?:[0-7](?:_[0-7])?)+)n?|(?:\d(?:_\d)?)+n|NaN|Infinity)\b|(?:\b(?:\d(?:_\d)?)+\.?(?:\d(?:_\d)?)*|\B\.(?:\d(?:_\d)?)+)(?:[Ee][+-]?(?:\d(?:_\d)?)+)?/,
	'operator': /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%&|^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/
});

Prism.languages.javascript['class-name'][0].pattern = /(\b(?:class|interface|extends|implements|instanceof|new)\s+)[\w.\\]+/;

Prism.languages.insertBefore('javascript', 'keyword', {
	'regex': {
		pattern: /((?:^|[^$\w\xA0-\uFFFF."'\])\s]|\b(?:return|yield))\s*)\/(?:\[(?:[^\]\\\r\n]|\\.)*]|\\.|[^/\\\[\r\n])+\/[gimyus]{0,6}(?=(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)*(?:$|[\r\n,.;:})\]]|\/\/))/,
		lookbehind: true,
		greedy: true,
		inside: {
			'regex-source': {
				pattern: /^(\/)[\s\S]+(?=\/[a-z]*$)/,
				lookbehind: true,
				alias: 'language-regex',
				inside: Prism.languages.regex
			},
			'regex-flags': /[a-z]+$/,
			'regex-delimiter': /^\/|\/$/
		}
	},
	// This must be declared before keyword because we use "function" inside the look-forward
	'function-variable': {
		pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)\s*=>))/,
		alias: 'function'
	},
	'parameter': [
		{
			pattern: /(function(?:\s+(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)?\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\))/,
			lookbehind: true,
			inside: Prism.languages.javascript
		},
		{
			pattern: /(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*=>)/i,
			inside: Prism.languages.javascript
		},
		{
			pattern: /(\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*=>)/,
			lookbehind: true,
			inside: Prism.languages.javascript
		},
		{
			pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*)\(\s*|\]\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*\{)/,
			lookbehind: true,
			inside: Prism.languages.javascript
		}
	],
	'constant': /\b[A-Z](?:[A-Z_]|\dx?)*\b/
});

Prism.languages.insertBefore('javascript', 'string', {
	'template-string': {
		pattern: /`(?:\\[\s\S]|\${(?:[^{}]|{(?:[^{}]|{[^}]*})*})+}|(?!\${)[^\\`])*`/,
		greedy: true,
		inside: {
			'template-punctuation': {
				pattern: /^`|`$/,
				alias: 'string'
			},
			'interpolation': {
				pattern: /((?:^|[^\\])(?:\\{2})*)\${(?:[^{}]|{(?:[^{}]|{[^}]*})*})+}/,
				lookbehind: true,
				inside: {
					'interpolation-punctuation': {
						pattern: /^\${|}$/,
						alias: 'punctuation'
					},
					rest: Prism.languages.javascript
				}
			},
			'string': /[\s\S]+/
		}
	}
});

if (Prism.languages.markup) {
	Prism.languages.markup.tag.addInlined('script', 'javascript');
}

Prism.languages.js = Prism.languages.javascript;


/* **********************************************
     Begin prism-file-highlight.js
********************************************** */

(function () {
	if (typeof self === 'undefined' || !self.Prism || !self.document) {
		return;
	}

	// https://developer.mozilla.org/en-US/docs/Web/API/Element/matches#Polyfill
	if (!Element.prototype.matches) {
		Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
	}

	var Prism = window.Prism;

	var LOADING_MESSAGE = 'Loading…';
	var FAILURE_MESSAGE = function (status, message) {
		return '✖ Error ' + status + ' while fetching file: ' + message;
	};
	var FAILURE_EMPTY_MESSAGE = '✖ Error: File does not exist or is empty';

	var EXTENSIONS = {
		'js': 'javascript',
		'py': 'python',
		'rb': 'ruby',
		'ps1': 'powershell',
		'psm1': 'powershell',
		'sh': 'bash',
		'bat': 'batch',
		'h': 'c',
		'tex': 'latex'
	};

	var STATUS_ATTR = 'data-src-status';
	var STATUS_LOADING = 'loading';
	var STATUS_LOADED = 'loaded';
	var STATUS_FAILED = 'failed';

	var SELECTOR = 'pre[data-src]:not([' + STATUS_ATTR + '="' + STATUS_LOADED + '"])'
		+ ':not([' + STATUS_ATTR + '="' + STATUS_LOADING + '"])';

	var lang = /\blang(?:uage)?-([\w-]+)\b/i;

	/**
	 * Sets the Prism `language-xxxx` or `lang-xxxx` class to the given language.
	 *
	 * @param {HTMLElement} element
	 * @param {string} language
	 * @returns {void}
	 */
	function setLanguageClass(element, language) {
		var className = element.className;
		className = className.replace(lang, ' ') + ' language-' + language;
		element.className = className.replace(/\s+/g, ' ').trim();
	}


	Prism.hooks.add('before-highlightall', function (env) {
		env.selector += ', ' + SELECTOR;
	});

	Prism.hooks.add('before-sanity-check', function (env) {
		var pre = /** @type {HTMLPreElement} */ (env.element);
		if (pre.matches(SELECTOR)) {
			env.code = ''; // fast-path the whole thing and go to complete

			pre.setAttribute(STATUS_ATTR, STATUS_LOADING); // mark as loading

			// add code element with loading message
			var code = pre.appendChild(document.createElement('CODE'));
			code.textContent = LOADING_MESSAGE;

			var src = pre.getAttribute('data-src');

			var language = env.language;
			if (language === 'none') {
				// the language might be 'none' because there is no language set;
				// in this case, we want to use the extension as the language
				var extension = (/\.(\w+)$/.exec(src) || [, 'none'])[1];
				language = EXTENSIONS[extension] || extension;
			}

			// set language classes
			setLanguageClass(code, language);
			setLanguageClass(pre, language);

			// preload the language
			var autoloader = Prism.plugins.autoloader;
			if (autoloader) {
				autoloader.loadLanguages(language);
			}

			// load file
			var xhr = new XMLHttpRequest();
			xhr.open('GET', src, true);
			xhr.onreadystatechange = function () {
				if (xhr.readyState == 4) {
					if (xhr.status < 400 && xhr.responseText) {
						// mark as loaded
						pre.setAttribute(STATUS_ATTR, STATUS_LOADED);

						// highlight code
						code.textContent = xhr.responseText;
						Prism.highlightElement(code);

					} else {
						// mark as failed
						pre.setAttribute(STATUS_ATTR, STATUS_FAILED);

						if (xhr.status >= 400) {
							code.textContent = FAILURE_MESSAGE(xhr.status, xhr.statusText);
						} else {
							code.textContent = FAILURE_EMPTY_MESSAGE;
						}
					}
				}
			};
			xhr.send(null);
		}
	});

	Prism.plugins.fileHighlight = {
		/**
		 * Executes the File Highlight plugin for all matching `pre` elements under the given container.
		 *
		 * Note: Elements which are already loaded or currently loading will not be touched by this method.
		 *
		 * @param {ParentNode} [container=document]
		 */
		highlight: function highlight(container) {
			var elements = (container || document).querySelectorAll(SELECTOR);

			for (var i = 0, element; element = elements[i++];) {
				Prism.highlightElement(element);
			}
		}
	};

	var logged = false;
	/** @deprecated Use `Prism.plugins.fileHighlight.highlight` instead. */
	Prism.fileHighlight = function () {
		if (!logged) {
			console.warn('Prism.fileHighlight is deprecated. Use `Prism.plugins.fileHighlight.highlight` instead.');
			logged = true;
		}
		Prism.plugins.fileHighlight.highlight.apply(this, arguments);
	};

})();
});

class SourceViewer extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
<link rel="stylesheet" href="/index.css">
<style>
#source {
  background: white;
  opacity: 1;
  height: 100%;
  width: 100%;
  max-height: 100%;
  max-width: 100%;
  overflow: auto;
  padding: 8px;
}

.id {
  font-family: monospace;
  font-size: 12px;
  margin-bottom: 8px;
  font-style: italic;
  color: gray;
}

.id::after {
  content: ' is';
  color: #000000;
}

#source .code {
  width: min-content;
  padding-right: 8px;
}

pre {
  margin: 0;
}

/**
 * prism.js default theme for JavaScript, CSS and HTML
 * Based on dabblet (http://dabblet.com)
 * @author Lea Verou
 */

code[class*="language-"],
pre[class*="language-"] {
  color: black;
  background: none;
  text-shadow: 0 1px white;
  font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
  font-size: 1em;
  text-align: left;
  white-space: pre;
  word-spacing: normal;
  word-break: normal;
  word-wrap: normal;
  line-height: 1.5;

  -moz-tab-size: 4;
  -o-tab-size: 4;
  tab-size: 4;

  -webkit-hyphens: none;
  -moz-hyphens: none;
  -ms-hyphens: none;
  hyphens: none;
}

pre[class*="language-"]::-moz-selection, pre[class*="language-"] ::-moz-selection,
code[class*="language-"]::-moz-selection, code[class*="language-"] ::-moz-selection {
  text-shadow: none;
  background: #b3d4fc;
}

pre[class*="language-"]::selection, pre[class*="language-"] ::selection,
code[class*="language-"]::selection, code[class*="language-"] ::selection {
  text-shadow: none;
  background: #b3d4fc;
}

@media print {
  code[class*="language-"],
  pre[class*="language-"] {
    text-shadow: none;
  }
}

/* Code blocks */
pre[class*="language-"] {
  padding: 1em;
  margin: .5em 0;
  overflow: auto;
}

:not(pre) > code[class*="language-"],
pre[class*="language-"] {
  background: #f5f2f0;
}

/* Inline code */
:not(pre) > code[class*="language-"] {
  padding: .1em;
  border-radius: .3em;
  white-space: normal;
}

.token.comment,
.token.prolog,
.token.doctype,
.token.cdata {
  color: slategray;
}

.token.punctuation {
  color: #999;
}

.token.namespace {
  opacity: .7;
}

.token.property,
.token.tag,
.token.boolean,
.token.number,
.token.constant,
.token.symbol,
.token.deleted {
  color: #905;
}

.token.selector,
.token.attr-name,
.token.string,
.token.char,
.token.builtin,
.token.inserted {
  color: #690;
}

.token.operator,
.token.entity,
.token.url,
.language-css .token.string,
.style .token.string {
  color: #9a6e3a;
  /* This background color was intended by the author of this theme. */
  /* background: hsla(0, 0%, 100%, .5); */
}

.token.atrule,
.token.attr-value,
.token.keyword {
  color: #07a;
}

.token.function,
.token.class-name {
  color: #DD4A68;
}

.token.regex,
.token.important,
.token.variable {
  color: #e90;
}

.token.important,
.token.bold {
  font-weight: bold;
}
.token.italic {
  font-style: italic;
}

.token.entity {
  cursor: help;
}
</style>
    `;
    shadow.innerHTML += `
<header class="bar">
  <h1>Source of <span id="title-ext">${this.name}</span></h1>
  <div class="icons">
    <button id="close">
      <svg width="24" viewBox="0 0 24 24">
        <path fill="currentColor" d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
      </svg>
    </button>
  </div>
</header>
    `;


    shadow.getElementById('close').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('close'));
    });

    const root = document.createElement('div');
    shadow.appendChild(root);
    root.id = 'source';

    const indicator = document.createElement('div');
    root.appendChild(indicator);
    indicator.classList.add('loading');
    indicator.innerText = 'Loading...';

    const main = document.createElement('div');
    root.appendChild(main);
    main.classList.add('code');
    const pre = document.createElement('pre');
    main.appendChild(pre)
    ;(new Util(this.sbot)).dereferenceUriOrSigil(this.app.link).then(code => {
      pre.innerText = code;
      requestAnimationFrame(() => {
        const html = this.app.type === 'patchboot-app' ?
          prism.highlight(code, prism.languages.javascript, 'javascript') :
          prism.highlight(code, prism.languages.html, 'html');
        pre.innerHTML = html;
      });
    });
  }
}

customElements.define("source-viewer", SourceViewer);

class PatchBoot extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback() {
    const componentArea = this.attachShadow({ mode: 'open' });

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
    `;
    const componentRoot = componentArea.getElementById('component-root');
    const sidebar = componentArea.getElementById('sidebar');
    const sidebarToggle = componentArea.getElementById('toggle-apps');
    const sidebarClose = componentArea.getElementById('close-apps');
    const sidebarCloseBackdrop = componentArea.getElementById('close-apps-backdrop');

    const closeSidebar = () => {
      console.log('closing');
      sidebar.classList.add('gone');
      sidebarCloseBackdrop.classList.add('gone');
      sidebarCloseBackdrop.removeEventListener('click', closeSidebar);
    };

    const openSidebar = () => {
      console.log('opening');
      sidebar.classList.remove('gone');
      sidebarCloseBackdrop.classList.remove('gone');
      sidebarCloseBackdrop.addEventListener('click', closeSidebar);
    };

    sidebarToggle.addEventListener('click', e => {
      console.log('toggling', sidebar.classList, sidebar.classList.contains('gone'));
      if (sidebar.classList.contains('gone')) openSidebar();
      else closeSidebar();
    });
    sidebarClose.addEventListener('click', closeSidebar);
    sidebarCloseBackdrop.addEventListener('click', closeSidebar);

    setTimeout(() => {
      componentRoot.classList.add('waited');
    }, 1000);

    const selectionArea = componentArea.getElementById('sidebar-inner');
    this.ssbConnect().then(sbot => {

      if (componentArea.getElementById('connecting')) componentArea.getElementById('connecting').classList.add('hidden');
      if (componentArea.getElementById('info')) componentArea.getElementById('info').classList.remove('hidden');

      const selector = document.createElement('app-selector');
      selector.sbot = sbot;
      selector.addEventListener('run', run);
      selector.addEventListener('show-source', showSource);
      selectionArea.appendChild(selector);

      const statusBar = componentArea.getElementById('status');

      const view = componentArea.getElementById('view');
      //const shadowView = view.attachShadow({ mode: 'closed' });
      //const shadowHtml = componentArea.createElement('html')
      //shadowView.appendChild(shadowHtml)

      function run(event) {
        const app = event.detail;
        componentArea.getElementById('info').classList.add('hidden');
        componentArea.getElementById('title-ext').innerHTML = app.name;
        statusBar.classList.remove('hidden');
        statusBar.innerText = 'Loading ' + app.name;
        view.innerHTML = '';
        const appRunner = document.createElement('app-runner');
        appRunner.sbot = sbot;
        appRunner.app = app;
        view.appendChild(appRunner);

        appRunner.addEventListener('loaded', e => {
          statusBar.classList.add('hidden');
        });
      }

      function showSource(event) {
        const app = event.detail;
        console.log('showSource', app);
        const outer = document.createElement('div');
        outer.id = 'outer';
        const oldTop = window.scrollY;
        const oldLeft = window.scrollX;
        window.scroll(0, 0);
        componentRoot.classList.add('modal-open');
        componentArea.appendChild(outer);
        //const inner = document.createElement('div')
        const sourceViewer = document.createElement('source-viewer');
        sourceViewer.id = 'inner';
        sourceViewer.app = app;
        sourceViewer.sbot = sbot;
        sourceViewer.name = app.name || app.comment || '';
        outer.appendChild(sourceViewer);
        const close = () => {
          componentArea.removeChild(outer);
          componentRoot.classList.remove('modal-open');
          window.scroll(oldLeft, oldTop);
        };
        outer.addEventListener('click', close);
        sourceViewer.addEventListener('close', close);
        sourceViewer.addEventListener('click', e => e.stopPropagation());
      }
    },
      error => {
        console.log('An error occured', error);
      });

  }


}

customElements.define('patch-boot', PatchBoot);
//# sourceMappingURL=patch-boot.js.map

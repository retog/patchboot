import { highlight, languages } from 'prismjs';
import { default as pull } from 'pull-stream'

class SourceViewer extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
    <style>
    #source {
      background: white;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 2rem;
      opacity: 1;
      height: 100%;
      width: 100%;
      max-height: 100%;
      max-width: 100%;
    }
    
    #source * {
      margin: 0.2rem;
    }
    
    #source .main {
      overflow: auto;
      background: lightgray;
      max-width: 100%;
      flex: 1;
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
      background: hsla(0, 0%, 100%, .5);
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
    `
    const root = document.createElement('div')
    shadow.appendChild(root)
    root.id = 'source'

    const header = document.createElement('div')
    root.appendChild(header)
    header.classList.add('header')


    header.innerText = 'View source: ' + this.name
    const main = document.createElement('div')
    root.appendChild(main)
    main.classList.add('main')
    const pre = document.createElement('pre')
    main.appendChild(pre)
    this.sbot.blobs.want(this.blobId).then(() => {
      pull(
        this.sbot.blobs.get(this.blobId),
        pull.collect(function (err, values) {
          if (err) throw err
          const code = values.join('')
          const html = highlight(code, languages.javascript, 'javascript');
          pre.innerHTML = html
        }))
    })
    const footer = document.createElement('div')
    root.appendChild(footer)
    footer.classList.add('footer')
    const closebtn = document.createElement('button')
    footer.appendChild(closebtn)
    closebtn.innerText = 'Close'
    closebtn.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('close'))
    })
  }
}

customElements.define("source-viewer", SourceViewer);
import { highlight, languages } from 'prismjs';
import { default as pull } from 'pull-stream'
import Util from '../Util.js';

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
    `
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
    `


    shadow.getElementById('close').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('close'))
    })

    const root = document.createElement('div')
    shadow.appendChild(root)
    root.id = 'source'

    const indicator = document.createElement('div')
    root.appendChild(indicator)
    indicator.classList.add('loading')
    indicator.innerText = 'Loading...'

    const main = document.createElement('div')
    root.appendChild(main)
    main.classList.add('code')
    const pre = document.createElement('pre')
    main.appendChild(pre)
    ;(new Util(this.sbot)).dereferenceUriOrSigil(this.app.link).then(code => {
      pre.innerText = code
      requestAnimationFrame(() => {
        const html = this.app.type === 'patchboot-app' ?
          highlight(code, languages.javascript, 'javascript') :
          highlight(code, languages.html, 'html')
        pre.innerHTML = html
      })
    })
  }
}

customElements.define("source-viewer", SourceViewer);
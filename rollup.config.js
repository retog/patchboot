import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import sourcemaps from 'rollup-plugin-sourcemaps'
import globals from 'rollup-plugin-node-globals'
import builtins from 'rollup-plugin-node-builtins'

export default {
  input: 'src/index.js',
  output: {
    file: 'public/bundle.js',
    format: 'es',
    sourcemap: true
  },
  plugins: [
    builtins(),
    nodeResolve({
      browser: true
    }),
    commonjs(),
    globals(),
    sourcemaps()
  ]
}
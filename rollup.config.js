import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import sourcemaps from 'rollup-plugin-sourcemaps'

export default {
  input: 'src/index.js',
  output: {
    file: 'public/bundle.js',
    format: 'es',
    sourcemap: true
  },
  plugins: [
    nodeResolve({
      browser: true
    }),
    commonjs(),
    sourcemaps()
  ]
}
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import sourcemaps from 'rollup-plugin-sourcemaps'
import globals from 'rollup-plugin-node-globals'
import builtins from 'rollup-plugin-node-builtins'
import copy from 'rollup-plugin-copy'

export default [
  {
    input: 'src/components/PatchBoot.js',
    output: [
      {
        file: 'public/patch-boot.js',
        format: 'es',
        sourcemap: true
      }
    ],
    external: ['../scuttle-shell-browser-consumer.js'],
    plugins: [
      builtins(),
      nodeResolve({
        browser: true
      }),
      commonjs(),
      globals(),
      sourcemaps(),
      copy({
        targets: 
          [{ 
            src: 'node_modules/scuttle-shell-browser-consumer/site/ssb-connect.js',
            dest: 'public/', rename: 'scuttle-shell-browser-consumer.js'
          }]
      })
    ]
  }
]
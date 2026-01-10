import { defineConfig } from 'vite'
import pages from '@hono/vite-cloudflare-pages'
import { copyFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    pages(),
    {
      name: 'copy-public',
      closeBundle() {
        const publicFiles = [
          'index.html',
          'pc.js',
          'judge.html',
          'judge.js',
          'suppon-logo.png',
          'ippon.m4a',
          'yo-sound.m4a'
        ]
        publicFiles.forEach(file => {
          try {
            copyFileSync(
              resolve(__dirname, 'public', file),
              resolve(__dirname, 'dist', file)
            )
            console.log(`Copied ${file} to dist/`)
          } catch (err) {
            console.error(`Failed to copy ${file}:`, err)
          }
        })
        
        // Create correct _routes.json
        const routesConfig = {
          version: 1,
          include: ['/api/*'],
          exclude: ['/*']
        }
        try {
          const fs = require('fs')
          fs.writeFileSync(
            resolve(__dirname, 'dist', '_routes.json'),
            JSON.stringify(routesConfig, null, 2)
          )
          console.log('Created _routes.json')
        } catch (err) {
          console.error('Failed to create _routes.json:', err)
        }
      }
    }
  ],
  build: {
    outDir: 'dist'
  }
})

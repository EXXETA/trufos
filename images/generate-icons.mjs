#!/bin/sh
':' //; cd "$(dirname "$0")/.."; exec node_modules/.bin/electron "$0" "$@"
import { app, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync, copyFileSync, rmSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'

const dir = dirname(fileURLToPath(import.meta.url))
const iconTmp = join(tmpdir(), 'icon-source.png')

app.whenReady().then(async () => {
  // SVG → PNG via Chromium (already bundled with Electron)
  const svg = readFileSync(join(dir, 'logo.svg'), 'utf8')
  const html = `<html><body style="margin:0;padding:0;overflow:hidden;background:transparent">
    <img src="data:image/svg+xml,${encodeURIComponent(svg)}" width="1024" height="1024">
  </body></html>`

  const win = new BrowserWindow({ width: 1024, height: 1024, show: false, transparent: true, backgroundColor: '#00000000' })
  await win.loadURL(`data:text/html,${encodeURIComponent(html)}`)
  const image = await win.webContents.capturePage()
  writeFileSync(iconTmp, image.toPNG())
  win.close()

  // PNG → ICO + ICNS + sized PNGs
  execFileSync(
    join(dir, '../node_modules/.bin/electron-icon-builder'),
    [`--input=${iconTmp}`, `--output=${dir}`],
    { stdio: 'inherit' }
  )

  // Move to expected locations
  copyFileSync(join(dir, 'icons/mac/icon.icns'), join(dir, 'icon.icns'))
  copyFileSync(join(dir, 'icons/win/icon.ico'), join(dir, 'icon.ico'))
  copyFileSync(join(dir, 'icons/png/1024x1024.png'), join(dir, 'icon.png'))
  copyFileSync(join(dir, 'icons/png/256x256.png'), join(dir, 'logo-256.png'))

  // Cleanup
  rmSync(iconTmp)
  rmSync(join(dir, 'icons'), { recursive: true })

  app.quit()
})

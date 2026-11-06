const assert = require('node:assert/strict')
const fs = require('node:fs')
const { createRequire } = require('node:module')
const path = require('node:path')
const vm = require('node:vm')

process.env.TZ = 'UTC'
const root = path.resolve(__dirname, '..')

function loadPlugin(directory) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'plugin.json'), 'utf8'))
  for (const field of ['main', 'preload', 'logo']) {
    assert.ok(fs.statSync(path.join(directory, manifest[field])).isFile(), `${field} exists`)
  }
  let request
  let select
  const copied = []
  const utools = {
    onMainPush(callback, onSelect) { request = callback; select = onSelect },
    copyText(value) { copied.push(value); return true },
    showNotification() { assert.fail('Unexpected failure notification') }
  }
  const entry = path.join(directory, manifest.preload)
  vm.runInNewContext(fs.readFileSync(entry, 'utf8'), {
    window: { utools }, require: createRequire(entry)
  }, { filename: entry })
  assert.equal(typeof request, 'function')
  assert.equal(typeof select, 'function')
  return { manifest, request, select, copied }
}

const sourceDirectory = path.join(root, 'public')
// The source index is served by Vite rather than located in public/.
const sourceEntry = path.join(sourceDirectory, 'preload.js')
const source = { copied: [] }
vm.runInNewContext(fs.readFileSync(sourceEntry, 'utf8'), {
  window: { utools: {
    onMainPush(callback, onSelect) { source.request = callback; source.select = onSelect },
    copyText(value) { source.copied.push(value); return true },
    showNotification() { assert.fail('Unexpected failure notification') }
  } },
  require: createRequire(sourceEntry)
}, { filename: sourceEntry })
const production = loadPlugin(path.join(root, 'dist'))
assert.deepEqual(production.manifest, JSON.parse(fs.readFileSync(path.join(sourceDirectory, 'plugin.json'), 'utf8')))

const fixtures = [
  ['1700000000123', ['2023-11-14 22:13:20.123', '2023-11-14 22:13:20.123']],
  ['2023-11-15T06:13:20.123+08:00', ['1700000000.123', '1700000000123']],
  ['2026-02-30', []]
]
for (const [payload, values] of fixtures) {
  const action = { code: 'timestamp', type: 'regex', payload, from: 'main' }
  const results = production.request(action)
  assert.deepEqual(results, source.request(action), `production parity: ${payload}`)
  assert.equal(results.length, values.length)
  results.forEach((result, index) => {
    const selection = { ...action, option: { text: result.text } }
    assert.notEqual(production.select(selection), true)
    assert.notEqual(source.select(selection), true)
    assert.equal(production.copied.at(-1), values[index])
    assert.equal(source.copied.at(-1), values[index])
  })
}
const html = fs.readFileSync(path.join(root, 'dist', production.manifest.main), 'utf8')
for (const match of html.matchAll(/(?:src|href)="(\.\/assets\/[^"?#]+)"/g)) {
  assert.ok(fs.statSync(path.join(root, 'dist', match[1])).isFile(), `built asset ${match[1]} exists`)
}
console.log('Production entry files, preload dependencies, assets, search results and pure-value copying verified.')

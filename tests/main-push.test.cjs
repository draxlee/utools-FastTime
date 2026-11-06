const assert = require('node:assert/strict')
const fs = require('node:fs')
const { createRequire } = require('node:module')
const path = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')

process.env.TZ = 'UTC'

const pluginDirectory = path.resolve(__dirname, '..', process.env.FAST_TIMESTAMP_PLUGIN_DIR || 'public')

function readConfiguration () {
  return JSON.parse(fs.readFileSync(path.join(pluginDirectory, 'plugin.json'), 'utf8'))
}

function timestampFeature () {
  const feature = readConfiguration().features.find(({ code }) => code === 'timestamp')
  assert.ok(feature, 'timestamp feature is declared')
  return feature
}

function matcher () {
  const command = timestampFeature().cmds.find(({ type }) => type === 'regex')
  assert.ok(command, 'timestamp has a regex command')
  const [, source, flags] = command.match.match(/^\/(.*)\/([a-z]*)$/)
  const expression = new RegExp(source, flags)
  return (input) => expression.test(input)
}

function loadPreload ({ copyResult = true, copyError } = {}) {
  const registered = {}
  const copied = []
  const notifications = []
  const utools = {
    onMainPush (callback, onSelect) {
      registered.request = callback
      registered.select = onSelect
    },
    copyText (value) {
      copied.push(value)
      if (copyError) throw copyError
      return copyResult
    },
    showNotification (...args) {
      notifications.push(args)
    }
  }
  const window = { utools }
  const preloadPath = path.join(pluginDirectory, readConfiguration().preload)
  vm.runInNewContext(fs.readFileSync(preloadPath, 'utf8'), {
    window,
    utools,
    require: createRequire(preloadPath)
  }, { filename: preloadPath })
  assert.equal(typeof registered.request, 'function', 'preload registers main push before UI entry')
  assert.equal(typeof registered.select, 'function', 'preload registers selection handling')
  return { ...registered, copied, notifications, window }
}

function action (payload) {
  return { code: 'timestamp', type: 'regex', payload }
}

function selection (payload, text) {
  return { ...action(payload), from: 'main', option: { text } }
}

test('keeps the help command outside the main-push feature so empty push results cannot hide it', () => {
  const configuration = readConfiguration()
  assert.deepEqual(configuration.features.map(({ code }) => code), ['help', 'timestamp'])
  const help = configuration.features.find(({ code }) => code === 'help')
  assert.deepEqual(help.cmds, ['FastTime'])
  assert.notEqual(help.mainPush, true, 'a text command returning no push results disappears in the host')
  const feature = timestampFeature()
  assert.equal(feature.mainPush, true)
  assert.equal(typeof feature.description, 'string')
  assert.ok(feature.description.length > 0)
  assert.deepEqual(feature.cmds.filter((command) => typeof command === 'string'), [])
  assert.equal(feature.cmds.filter((command) => typeof command === 'object').length, 1)
  assert.equal(configuration.main, 'index.html')
  assert.equal(configuration.preload, 'preload.js')
  assert.equal(configuration.logo, 'logo-fasttime.png')
  assert.deepEqual(configuration.development, { main: 'http://localhost:5173' })
})

test('matches all supported input syntaxes including surrounding whitespace', () => {
  const matches = matcher()
  const supported = [
    '1700000000',
    '1700000000123',
    '0000000000',
    '2023-11-14',
    '2023/11/14',
    '2023-11-14 22:13',
    '2023/11/14 22:13',
    '2023-11-14 22:13:20',
    '2023/11/14 22:13:20',
    '2023/11/14 22:13:20.1',
    '2023/11/14 22:13:20.12',
    '2023/11/14 22:13:20.123',
    '2023-11-14T22:13',
    '2023-11-14T22:13Z',
    '2023-11-14T22:13:20Z',
    '2023-11-14T22:13:20.123Z',
    '2023-11-15T06:13:20.123+08:00',
    '2023-11-14T17:13:20-05:00',
    '2023-11-14 22:13:20.123Z',
    '2023-11-15 06:13:20.123+08:00',
    '2023-11-14 17:13-05:00',
    '0001-01-01T00:00:00Z',
    '9999/12/31 23:59:59.999'
  ]
  for (const input of supported) {
    assert.equal(matches(input), true, input)
    assert.equal(matches(` \t${input}\n `), true, `whitespace around ${input}`)
  }
})

test('does not match ordinary text or unsupported input syntax', () => {
  const matches = matcher()
  for (const input of [
    '', 'hello', 'FastTime', '时间戳', '123456789', '17000000000',
    '1700000000.123', '-1700000000', '1.7e12',
    '01/02/2026', '2026-11-', '2023-11/14', '2023/11-14',
    '2023-1-14', '2023-11-4', '2023-11-14 2:13',
    '2023-11-14 22:3', '2023-11-14 22:13:2',
    '2023-11-14T22:13:20.1234Z', '2023-11-14Z',
    '2023/11/14T22:13:20', '2023/11/14 22:13:20Z',
    '2023-11-14 22:13:20+0800', '2023-11-14 tomorrow'
  ]) {
    assert.equal(matches(input), false, input)
  }
})

test('loads actual preload and keeps copy hints in hover titles for local and UTC rows', () => {
  const host = loadPreload()
  const input = ' 1700000000123 '
  assert.equal(matcher()(input), true)
  const results = host.request(action(input))
  assert.deepEqual(results, [
    {
      text: '本地时间（UTC+0）：2023-11-14 22:13:20.123',
      title: '点击复制，或选中后按回车'
    },
    {
      text: 'UTC时间：2023-11-14 22:13:20.123',
      title: '点击复制，或选中后按回车'
    }
  ])
  assert.deepEqual(host.copied, [])
  assert.deepEqual(host.notifications, [])
  assert.equal(host.window.services, undefined, 'the demo file-reading bridge is removed')
})

test('labels local timezone separately from the UTC result and copies each pure value', () => {
  const originalTimezone = process.env.TZ
  process.env.TZ = 'Asia/Shanghai'
  try {
    const host = loadPreload()
    const results = host.request(action('1700000000123'))
    assert.deepEqual(results.map(({ text }) => text), [
      '本地时间（UTC+8）：2023-11-15 06:13:20.123',
      'UTC时间：2023-11-14 22:13:20.123'
    ])
    assert.notEqual(host.select(selection('1700000000123', results[0].text)), true)
    assert.notEqual(host.select(selection('1700000000123', results[1].text)), true)
    assert.deepEqual(host.copied, ['2023-11-15 06:13:20.123', '2023-11-14 22:13:20.123'])
  } finally {
    process.env.TZ = originalTimezone
  }
})

test('pushes seconds before milliseconds for a matching date input', () => {
  const host = loadPreload()
  const input = '2023-11-14T22:13:20.123Z'
  assert.equal(matcher()(input), true)
  const results = host.request(action(input))
  assert.deepEqual(results.map(({ text }) => text), [
    '秒级时间戳：1700000000.123',
    '毫秒级时间戳：1700000000123'
  ])
  assert.deepEqual(results.map(({ title }) => title), [
    '点击复制，或选中后按回车',
    '点击复制，或选中后按回车'
  ])
})

test('recomputes changed input and never retains answers for an invalid date', () => {
  const host = loadPreload()
  assert.equal(host.request(action('1700000000')).length, 2)
  assert.deepEqual(host.request(action('2026-02-30')), [])
  assert.deepEqual(host.request(action('2023-11-14T22:13:21Z')).map(({ text }) => text), [
    '秒级时间戳：1700000001',
    '毫秒级时间戳：1700000001000'
  ])
})

test('ignores the instruction command, unrelated features and malformed requests', () => {
  const host = loadPreload()
  for (const invalid of [
    undefined, null, {},
    { code: 'hello', type: 'regex', payload: '1700000000' },
    { code: 'timestamp', type: 'text', payload: 'FastTime' },
    { code: 'timestamp', type: 'text', payload: '1700000000' },
    { code: 'timestamp', type: 'files', payload: [] },
    { code: 'timestamp', type: 'regex', payload: 1700000000 },
    action(null), action([]), action('not a date'), action('')
  ]) {
    assert.deepEqual(host.request(invalid), [])
  }
  assert.deepEqual(host.copied, [])
})

for (const fixture of [
  {
    name: 'local time',
    input: '1700000000123',
    text: '本地时间（UTC+0）：2023-11-14 22:13:20.123',
    value: '2023-11-14 22:13:20.123'
  },
  {
    name: 'UTC time',
    input: '1700000000123',
    text: 'UTC时间：2023-11-14 22:13:20.123',
    value: '2023-11-14 22:13:20.123'
  },
  {
    name: 'seconds',
    input: '2023-11-14T22:13:20.123Z',
    text: '秒级时间戳：1700000000.123',
    value: '1700000000.123'
  },
  {
    name: 'milliseconds',
    input: '2023-11-14T22:13:20.123Z',
    text: '毫秒级时间戳：1700000000123',
    value: '1700000000123'
  }
]) {
  test(`selecting ${fixture.name} copies only its value without entering the interface`, () => {
    const host = loadPreload()
    const result = host.select(selection(fixture.input, fixture.text))
    assert.deepEqual(host.copied, [fixture.value])
    assert.deepEqual(host.notifications, [])
    assert.notEqual(result, true, 'copyText success must not cause interface entry')
  })
}

test('selection derives its answer from the event payload after unrelated requests', () => {
  const host = loadPreload()
  host.request(action('2023-11-14T22:13:21Z'))
  const selected = selection('2023-11-14T22:13:20.123Z', '毫秒级时间戳：1700000000123')
  selected.option.value = 'forged clipboard value'
  assert.notEqual(host.select(selected), true)
  assert.deepEqual(host.copied, ['1700000000123'])
})

test('rejects stale, forged, partial and malformed selections without touching the clipboard', () => {
  const host = loadPreload()
  host.request(action('2023-11-14T22:13:20.123Z'))
  for (const invalid of [
    undefined, null, {},
    { ...action('1700000000'), from: 'main' },
    { ...action('1700000000'), from: 'main', option: null },
    { ...action('1700000000'), from: 'main', option: {} },
    { ...action('1700000000'), from: 'main', option: { text: 1700000000 } },
    selection('2023-11-14T22:13:21Z', '毫秒级时间戳：1700000000123'),
    selection('2026-02-30', '毫秒级时间戳：1700000000123'),
    selection('2023-11-14T22:13:20.123Z', '1700000000123'),
    selection('2023-11-14T22:13:20.123Z', '秒级时间戳：1700000000123'),
    selection('2023-11-14T22:13:20.123Z', '毫秒级时间戳：1700000000123 extra'),
    selection('2023-11-14T22:13:20.123Z', ' 毫秒级时间戳：1700000000123'),
    selection('1700000000', '本地时间（UTC+8）：2023-11-14 22:13:20'),
    selection('1700000000123', '本地时间（UTC+0）：2023-11-14 22:13:20.123 · 点击即可复制'),
    selection('1700000000123', 'UTC时间（UTC+0）：2023-11-14 22:13:20.123 · 点击即可复制'),
    selection('1700000000123', 'UTC时间（UTC+0）：2023-11-14 22:13:20.123'),
    selection('2023-11-14T22:13:20.123Z', '秒级时间戳：1700000000.123 · 点击即可复制'),
    selection('2023-11-14T22:13:20.123Z', '毫秒级时间戳：1700000000123 · 点击即可复制'),
    selection([], '毫秒级时间戳：1700000000123'),
    { ...selection('1700000000', '本地时间（UTC+0）：2023-11-14 22:13:20'), code: 'hello' },
    { ...selection('1700000000', '本地时间（UTC+0）：2023-11-14 22:13:20'), type: 'text' }
  ]) {
    assert.notEqual(host.select(invalid), true)
  }
  assert.deepEqual(host.copied, [])
  assert.deepEqual(host.notifications, [])
})

for (const failure of [
  { name: 'returns false', options: { copyResult: false } },
  { name: 'throws', options: { copyError: new Error('clipboard unavailable') } }
]) {
  test(`notifies about copy failure when copyText ${failure.name} without entering the interface`, () => {
    const host = loadPreload(failure.options)
    const result = host.select(selection('2023-11-14T22:13:20.123Z', '毫秒级时间戳：1700000000123'))
    assert.deepEqual(host.copied, ['1700000000123'])
    assert.equal(host.notifications.length, 1)
    const notification = host.notifications[0]
    assert.equal(notification.length, 1, 'no clickFeatureCode that could enter the interface')
    assert.match(notification[0], /复制失败/)
    assert.doesNotMatch(notification[0], /成功/)
    assert.notEqual(result, true)
  })
}

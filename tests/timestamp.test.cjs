const { test } = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const path = require('node:path')

// Each process uses a fixed timezone, independently of the developer's computer.
function convertIn(timezone, inputs) {
  const modulePath = path.resolve(__dirname, '../public/lib/timestamp.js')
  const script = `
    const { convertTimestamp } = require(process.argv[1]);
    console.log(JSON.stringify(JSON.parse(process.argv[2]).map(convertTimestamp)));
  `
  const child = spawnSync(process.execPath, ['-e', script, modulePath, JSON.stringify(inputs)], {
    env: { ...process.env, TZ: timezone },
    encoding: 'utf8'
  })
  assert.equal(child.status, 0, child.stderr)
  return JSON.parse(child.stdout)
}

test('second and millisecond inputs render in the computer local timezone', () => {
  assert.deepEqual(convertIn('Asia/Shanghai', ['1700000000', '1700000000123']), [
    [{ kind: 'datetime', value: '2023-11-15 06:13:20', timezone: 'UTC+8' },
      { kind: 'utc', value: '2023-11-14 22:13:20', timezone: 'UTC+0' }],
    [{ kind: 'datetime', value: '2023-11-15 06:13:20.123', timezone: 'UTC+8' },
      { kind: 'utc', value: '2023-11-14 22:13:20.123', timezone: 'UTC+0' }]
  ])
  assert.deepEqual(convertIn('UTC', ['1700000000', '1700000000000', ' 1700000000123 ']), [
    [{ kind: 'datetime', value: '2023-11-14 22:13:20', timezone: 'UTC+0' },
      { kind: 'utc', value: '2023-11-14 22:13:20', timezone: 'UTC+0' }],
    [{ kind: 'datetime', value: '2023-11-14 22:13:20.000', timezone: 'UTC+0' },
      { kind: 'utc', value: '2023-11-14 22:13:20.000', timezone: 'UTC+0' }],
    [{ kind: 'datetime', value: '2023-11-14 22:13:20.123', timezone: 'UTC+0' },
      { kind: 'utc', value: '2023-11-14 22:13:20.123', timezone: 'UTC+0' }]
  ])
})

test('local timezone labels retain fractional-hour offsets and use DST at the converted instant', () => {
  for (const [zone, value, timezone] of [
    ['Asia/Kolkata', '2023-11-15 03:43:20.123', 'UTC+5:30'],
    ['Asia/Kathmandu', '2023-11-15 03:58:20.123', 'UTC+5:45'],
    ['America/St_Johns', '2023-11-14 18:43:20.123', 'UTC-3:30'],
    ['America/New_York', '2023-11-14 17:13:20.123', 'UTC-5']
  ]) {
    assert.deepEqual(convertIn(zone, ['1700000000123']), [[
      { kind: 'datetime', value, timezone },
      { kind: 'utc', value: '2023-11-14 22:13:20.123', timezone: 'UTC+0' }
    ]])
  }
  assert.deepEqual(convertIn('America/New_York', ['1689422400']), [[
    { kind: 'datetime', value: '2023-07-15 08:00:00', timezone: 'UTC-4' },
    { kind: 'utc', value: '2023-07-15 12:00:00', timezone: 'UTC+0' }
  ]])
})

test('local date formats default missing time fields and preserve fractional seconds', () => {
  const inputs = [
    '2023-11-14', '2023/11/14', '2023-11-14 22:13',
    '2023/11/14 22:13:20', ' 2023-11-14 22:13:20.1 ',
    '2023/11/14 22:13:20.12', '2023-11-14 22:13:20.123'
  ]
  const pairs = [
    ['1699920000', '1699920000000'], ['1699920000', '1699920000000'],
    ['1699999980', '1699999980000'], ['1700000000', '1700000000000'],
    ['1700000000.1', '1700000000100'], ['1700000000.12', '1700000000120'],
    ['1700000000.123', '1700000000123']
  ]
  assert.deepEqual(convertIn('UTC', inputs), pairs.map(([seconds, milliseconds]) => [
    { kind: 'seconds', value: seconds }, { kind: 'milliseconds', value: milliseconds }
  ]))
  assert.deepEqual(convertIn('Asia/Shanghai', ['2023-11-15 06:13:20.123']), [[
    { kind: 'seconds', value: '1700000000.123' },
    { kind: 'milliseconds', value: '1700000000123' }
  ]])
})

test('ISO dates and explicit offsets describe the same instant in any local timezone', () => {
  const inputs = [
    '2023-11-14T22:13:20.123Z', '2023-11-15T06:13:20.123+08:00',
    '2023-11-14 17:13:20.123-05:00', '2023-11-14T22:13:20.123',
    '2023-11-14T22:13Z'
  ]
  assert.deepEqual(convertIn('UTC', inputs), [
    ...Array.from({ length: 4 }, () => [
      { kind: 'seconds', value: '1700000000.123' },
      { kind: 'milliseconds', value: '1700000000123' }
    ]),
    [{ kind: 'seconds', value: '1699999980' }, { kind: 'milliseconds', value: '1699999980000' }]
  ])
  assert.deepEqual(convertIn('Asia/Shanghai', inputs.slice(0, 3)), Array.from({ length: 3 }, () => [
    { kind: 'seconds', value: '1700000000.123' },
    { kind: 'milliseconds', value: '1700000000123' }
  ]))
})

test('offsets cross calendar boundaries and negative subsecond values retain their sign', () => {
  assert.deepEqual(convertIn('UTC', [
    '1970-01-01T00:00:00.001+01:00', '1969-12-31T23:59:59.999Z',
    '1970-01-01T00:00:00Z', '1970-01-01T00:00:00.010Z'
  ]), [
    [{ kind: 'seconds', value: '-3599.999' }, { kind: 'milliseconds', value: '-3599999' }],
    [{ kind: 'seconds', value: '-0.001' }, { kind: 'milliseconds', value: '-1' }],
    [{ kind: 'seconds', value: '0' }, { kind: 'milliseconds', value: '0' }],
    [{ kind: 'seconds', value: '0.01' }, { kind: 'milliseconds', value: '10' }]
  ])
})

test('invalid dates, ambiguous text, unsupported numeric forms and non-text yield no results', () => {
  const inputs = [
    '2023-02-29', '2026-04-31', '1900-02-29', '2026-00-01', '2026-13-01', '2026-11-00',
    '2026-11-06 24:00:00', '2026-11-06 12:60:00', '2026-11-06 12:00:60',
    '2026-11-06T12:00:00+24:00', '2026-11-06T12:00:00+08:60',
    '2026-11-06 12:00:00.1234', '2026-11-06 12:00.1', '2026-11-06Z',
    '0000-01-01', '10000-01-01', '2026/11-06', '2026/11/06T12:00:00',
    '2026/11/06 12:00:00Z', '01/02/2026', '2026-1-01', '2026-11-',
    '2026-11-06 1:00', '2026-11-06 12:00 text', 'text 2026-11-06',
    '1700000000.123', '-1700000000', '123456789', '1.7e12', '', '  ',
    null, 1700000000, {}, [], '2026-11-06\n12:00'
  ]
  const actual = convertIn('UTC', inputs)
  inputs.forEach((input, index) => assert.deepEqual(actual[index], [], `must reject ${JSON.stringify(input)}`))
})

test('calendar validation accepts leap years and preserves years below 100', () => {
  const inputs = ['2024-02-29', '2000-02-29', '0001-01-01', '0099-01-01', '9999-12-31']
  const pairs = [
    ['1709164800', '1709164800000'], ['951782400', '951782400000'],
    ['-62135596800', '-62135596800000'], ['-59042995200', '-59042995200000'],
    ['253402214400', '253402214400000']
  ]
  const expected = pairs.map(([seconds, milliseconds]) => [
    { kind: 'seconds', value: seconds }, { kind: 'milliseconds', value: milliseconds }
  ])
  assert.deepEqual(convertIn('UTC', inputs), expected)
  assert.deepEqual(convertIn('Asia/Shanghai', inputs.map(input => `${input}T00:00:00Z`)), expected)
})

test('local daylight saving gaps are rejected and repeated times pick the earlier instant', () => {
  assert.deepEqual(convertIn('America/New_York', [
    '2026-03-08 02:30:00', '2026-11-01 01:30:00', '2026-11-01T01:30:00-04:00',
    '2026-11-01T01:30:00-05:00'
  ]), [
    [],
    [{ kind: 'seconds', value: '1793511000' }, { kind: 'milliseconds', value: '1793511000000' }],
    [{ kind: 'seconds', value: '1793511000' }, { kind: 'milliseconds', value: '1793511000000' }],
    [{ kind: 'seconds', value: '1793514600' }, { kind: 'milliseconds', value: '1793514600000' }]
  ])
})

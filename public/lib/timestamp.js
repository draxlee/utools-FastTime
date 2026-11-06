function pad(value, length = 2) {
  return String(value).padStart(length, '0')
}

function formatLocal(date, withMilliseconds) {
  const day = `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  return `${day} ${time}${withMilliseconds ? `.${pad(date.getMilliseconds(), 3)}` : ''}`
}

function timezoneLabel(date) {
  const offset = -date.getTimezoneOffset()
  const absolute = Math.abs(offset)
  const minutes = absolute % 60
  return `UTC${offset >= 0 ? '+' : '-'}${Math.floor(absolute / 60)}${minutes ? `:${pad(minutes)}` : ''}`
}

function timestampResults(milliseconds) {
  const absolute = Math.abs(milliseconds)
  const fraction = pad(absolute % 1000, 3).replace(/0+$/, '')
  const seconds = `${milliseconds < 0 ? '-' : ''}${Math.floor(absolute / 1000)}${fraction ? `.${fraction}` : ''}`
  return [
    { kind: 'seconds', value: seconds },
    { kind: 'milliseconds', value: String(milliseconds) }
  ]
}

function validFields([year, month, day, hour, minute, second]) {
  if (year < 1 || year > 9999 || month < 0 || month > 11) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day >= 1 && day <= days[month] && hour <= 23 && minute <= 59 && second <= 59
}

function dateFromFields(fields, utc) {
  const [year, month, day, hour, minute, second, millisecond] = fields
  const date = new Date(0)
  // Full-year setters avoid the Date constructor's special handling of years 00–99.
  if (utc) {
    date.setUTCFullYear(year, month, day)
    date.setUTCHours(hour, minute, second, millisecond)
  } else {
    date.setFullYear(year, month, day)
    date.setHours(hour, minute, second, millisecond)
  }
  return date
}

function convertTimestamp(input) {
  if (typeof input !== 'string') return []
  const text = input.trim()
  if (/^(?:\d{10}|\d{13})$/.test(text)) {
    const withMilliseconds = text.length === 13
    const date = new Date(Number(text) * (withMilliseconds ? 1 : 1000))
    const utcValue = date.toISOString().slice(0, withMilliseconds ? -1 : 19).replace('T', ' ')
    return [
      { kind: 'datetime', value: formatLocal(date, withMilliseconds), timezone: timezoneLabel(date) },
      { kind: 'utc', value: utcValue, timezone: 'UTC+0' }
    ]
  }
  const match = /^(\d{4})([-/])(\d{2})\2(\d{2})(?:([ T])(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(text)
  if (!match) return []
  const [, year, separator, month, day, timeSeparator, hour = '0', minute = '0', second = '0', fraction = '0', zone] = match
  if (separator === '/' && (timeSeparator === 'T' || zone)) return []
  const fields = [Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second), Number(fraction.padEnd(3, '0'))]
  if (!validFields(fields)) return []
  const date = dateFromFields(fields, Boolean(zone))
  if (!zone) {
    const actual = [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()]
    // Local clocks can skip otherwise valid wall times during daylight-saving transitions.
    if (actual.some((value, index) => value !== fields[index])) return []
    return timestampResults(date.getTime())
  }
  if (zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59)) return []
  const offset = zone === 'Z' ? 0 : (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4))) * (zone[0] === '+' ? 1 : -1)
  return timestampResults(date.getTime() - offset * 60000)
}

module.exports = { convertTimestamp }

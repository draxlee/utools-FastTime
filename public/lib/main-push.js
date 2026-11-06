const { convertTimestamp } = require('./timestamp.js')

const labels = {
  datetime: '本地时间',
  utc: 'UTC时间',
  seconds: '秒级时间戳',
  milliseconds: '毫秒级时间戳'
}

function convertedResults (action) {
  if (!action || action.code !== 'timestamp' || action.type !== 'regex' || typeof action.payload !== 'string') {
    return []
  }
  return convertTimestamp(action.payload).map(({ kind, value, timezone }) => ({
    text: `${labels[kind]}${kind === 'datetime' && timezone ? `（${timezone}）` : ''}：${value}`,
    title: '点击复制，或选中后按回车',
    value
  }))
}

function registerMainPush (utools) {
  utools.onMainPush(
    (action) => convertedResults(action).map(({ text, title }) => ({ text, title })),
    (action) => {
      if (typeof action?.option?.text !== 'string') return
      const selected = convertedResults(action).find(({ text }) => text === action.option.text)
      if (!selected) return

      let copied
      try {
        copied = utools.copyText(selected.value)
      } catch {
        copied = false
      }
      if (!copied) utools.showNotification('复制失败，请重试。')
      // onMainPush only enters the interface when this callback returns true.
    }
  )
}

module.exports = { registerMainPush }

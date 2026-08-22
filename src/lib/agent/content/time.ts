const DEFAULT_CONTENT_TIMEZONE = "Asia/Shanghai"

export function getContentTimezone() {
  return process.env.CONTENT_TIMEZONE?.trim() || DEFAULT_CONTENT_TIMEZONE
}

export function getContentDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: getContentTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

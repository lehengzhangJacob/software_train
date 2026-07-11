/**
 * Converts a Date to the application's local calendar-date representation.
 * Date-only database fields must never be derived from UTC serialization.
 */
export function toLocalDateString(date: Date = new Date()): string {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Cannot format an invalid date")
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Parses a YYYY-MM-DD key as a local calendar date without UTC conversion.
 */
export function parseLocalDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    throw new RangeError("Date must use YYYY-MM-DD format")
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const result = new Date(year, month - 1, day)

  if (result.getFullYear() !== year || result.getMonth() !== month - 1 || result.getDate() !== day) {
    throw new RangeError("Date must be a valid local calendar day")
  }

  return result
}

/**
 * Adds whole calendar days in local time. Rebuilding at local midnight keeps
 * DST changes from shifting the YYYY-MM-DD value.
 */
export function addLocalDays(date: Date, days: number): Date {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Cannot shift an invalid date")
  }

  if (!Number.isInteger(days)) {
    throw new RangeError("Day offset must be an integer")
  }

  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Returns an ascending, inclusive sequence ending on the provided local day.
 */
export function getLocalDateRange(dayCount: number, endDate: Date = new Date()): string[] {
  if (!Number.isInteger(dayCount) || dayCount < 1) {
    throw new RangeError("Day count must be a positive integer")
  }

  const startDate = addLocalDays(endDate, -(dayCount - 1))
  return Array.from({ length: dayCount }, (_, index) => toLocalDateString(addLocalDays(startDate, index)))
}

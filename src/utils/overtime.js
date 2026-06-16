const MS_IN_MINUTE = 60 * 1000;
const NIGHT_BONUS_MULTIPLIER = 0.3; // +30%

export function ensureEndDate(start, end) {
  if (!start || !end) return { start, end };
  if (end > start) return { start, end };

  const adjustedEnd = new Date(end);
  adjustedEnd.setDate(adjustedEnd.getDate() + 1);
  return { start, end: adjustedEnd };
}

export function calculateNightMinutes(start, end) {
  if (!start || !end) return 0;

  let total = 0;
  let cursor = new Date(start);

  while (cursor < end) {
    const dayStart = new Date(cursor);
    dayStart.setHours(0, 0, 0, 0);

    const nightStart = new Date(dayStart);
    nightStart.setHours(22, 0, 0, 0);

    const nightEnd = new Date(dayStart);
    nightEnd.setDate(nightEnd.getDate() + 1);
    nightEnd.setHours(6, 0, 0, 0);

    const intervalStart = new Date(Math.max(cursor.getTime(), nightStart.getTime()));
    const intervalEnd = new Date(Math.min(end.getTime(), nightEnd.getTime()));

    if (intervalEnd > intervalStart) {
      total += (intervalEnd - intervalStart) / MS_IN_MINUTE;
    }

    const nextDay = new Date(dayStart);
    nextDay.setDate(nextDay.getDate() + 1);
    cursor = nextDay;
  }

  return total;
}

export function minutesToHours(minutes) {
  if (!Number.isFinite(minutes)) return "0h 00m";
  const totalMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

export function calculateOvertimeValue({ start, end, hourlyRate, overtimePercentage }) {
  if (!start || !end || !hourlyRate || overtimePercentage === undefined || overtimePercentage === null) {
    return {
      totalMinutes: 0,
      nightMinutes: 0,
      totalValue: 0,
      baseValue: 0,
      nightExtra: 0,
    };
  }

  const { start: safeStart, end: safeEnd } = ensureEndDate(start, end);
  const totalMinutes = (safeEnd - safeStart) / MS_IN_MINUTE;
  const nightMinutes = calculateNightMinutes(safeStart, safeEnd);

  const numericRate = Number(hourlyRate);
  const numericOvertime = Number(overtimePercentage);
  const hours = totalMinutes / 60;
  const nightHours = nightMinutes / 60;

  const baseMultiplier = 1 + numericOvertime;
  const baseValue = hours * numericRate * baseMultiplier;
  const nightExtra = nightHours * numericRate * NIGHT_BONUS_MULTIPLIER;

  return {
    totalMinutes,
    nightMinutes,
    baseValue,
    nightExtra,
    totalValue: baseValue + nightExtra,
  };
}

export const DEFAULT_TIMEZONE = "America/Campo_Grande";

export interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  hour: number;
  minute: number;
  second: number;
  dateString: string; // YYYY-MM-DD
}

export interface DaySchedule {
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
}

export const getZonedParts = (date: Date, tz: string = DEFAULT_TIMEZONE): ZonedDateParts => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    dayOfWeek: weekdayMap[parts.weekday] ?? 0,
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
    second: parseInt(parts.second, 10),
    dateString: `${parts.year}-${parts.month}-${parts.day}`
  };
};

export const getDaySchedule = (
  parts: ZonedDateParts,
  holidays: string[] = []
): DaySchedule | null => {
  // Se for feriado ou exceção de calendário cadastrada, não há expediente
  if (holidays.includes(parts.dateString)) {
    return null;
  }

  const dow = parts.dayOfWeek;
  // Segunda a Sexta: 08:00 às 17:00 (D-08)
  if (dow >= 1 && dow <= 5) {
    return { startHour: 8, startMin: 0, endHour: 17, endMin: 0 };
  }
  // Sábado: 08:00 às 12:00 (D-08)
  if (dow === 6) {
    return { startHour: 8, startMin: 0, endHour: 12, endMin: 0 };
  }
  // Domingo: Sem expediente regular
  return null;
};

export const isBusinessTime = (
  date: Date,
  holidays: string[] = [],
  tz: string = DEFAULT_TIMEZONE
): boolean => {
  const parts = getZonedParts(date, tz);
  const sched = getDaySchedule(parts, holidays);
  if (!sched) return false;

  const currentMinuteOfDay = parts.hour * 60 + parts.minute;
  const startMinuteOfDay = sched.startHour * 60 + sched.startMin;
  const endMinuteOfDay = sched.endHour * 60 + sched.endMin;

  return currentMinuteOfDay >= startMinuteOfDay && currentMinuteOfDay < endMinuteOfDay;
};

export const calculateBusinessSecondsBetween = (
  startDate: Date,
  endDate: Date,
  holidays: string[] = [],
  tz: string = DEFAULT_TIMEZONE
): number => {
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  if (startMs >= endMs) return 0;

  let currentMs = startMs;
  let totalSeconds = 0;

  while (currentMs < endMs) {
    const d = new Date(currentMs);
    const parts = getZonedParts(d, tz);
    const sched = getDaySchedule(parts, holidays);

    if (!sched) {
      const minsToNextHour = 60 - parts.minute;
      currentMs += minsToNextHour * 60 * 1000 - parts.second * 1000;
      continue;
    }

    const currentMinuteOfDay = parts.hour * 60 + parts.minute;
    const startMinuteOfDay = sched.startHour * 60 + sched.startMin;
    const endMinuteOfDay = sched.endHour * 60 + sched.endMin;

    if (currentMinuteOfDay < startMinuteOfDay) {
      const minsToOpen = startMinuteOfDay - currentMinuteOfDay;
      currentMs += minsToOpen * 60 * 1000 - parts.second * 1000;
      continue;
    }

    if (currentMinuteOfDay >= endMinuteOfDay) {
      const minsToMidnight = 1440 - currentMinuteOfDay;
      currentMs += minsToMidnight * 60 * 1000 - parts.second * 1000;
      continue;
    }

    const windowEndMs = currentMs + (endMinuteOfDay - currentMinuteOfDay) * 60 * 1000 - parts.second * 1000;
    const stepEndMs = Math.min(windowEndMs, endMs);
    totalSeconds += (stepEndMs - currentMs) / 1000;
    currentMs = stepEndMs;
  }

  return totalSeconds;
};

export const calculateBusinessMinutesBetween = (
  startDate: Date,
  endDate: Date,
  holidays: string[] = [],
  tz: string = DEFAULT_TIMEZONE
): number => {
  const seconds = calculateBusinessSecondsBetween(startDate, endDate, holidays, tz);
  return Math.floor(seconds / 60);
};

export const addBusinessMinutes = (
  startDate: Date,
  minutesToAdd: number,
  holidays: string[] = [],
  tz: string = DEFAULT_TIMEZONE
): Date => {
  let remainingSeconds = minutesToAdd * 60;
  let currentMs = startDate.getTime();

  while (remainingSeconds > 0) {
    const d = new Date(currentMs);
    const parts = getZonedParts(d, tz);
    const sched = getDaySchedule(parts, holidays);

    if (!sched) {
      const minsToNextHour = 60 - parts.minute;
      currentMs += minsToNextHour * 60 * 1000 - parts.second * 1000;
      continue;
    }

    const currentMinuteOfDay = parts.hour * 60 + parts.minute;
    const startMinuteOfDay = sched.startHour * 60 + sched.startMin;
    const endMinuteOfDay = sched.endHour * 60 + sched.endMin;

    if (currentMinuteOfDay < startMinuteOfDay) {
      const minsToOpen = startMinuteOfDay - currentMinuteOfDay;
      currentMs += minsToOpen * 60 * 1000 - parts.second * 1000;
      continue;
    }

    if (currentMinuteOfDay >= endMinuteOfDay) {
      const minsToMidnight = 1440 - currentMinuteOfDay;
      currentMs += minsToMidnight * 60 * 1000 - parts.second * 1000;
      continue;
    }

    const secondsAvailable = (endMinuteOfDay - currentMinuteOfDay) * 60 - parts.second;
    if (remainingSeconds <= secondsAvailable) {
      currentMs += remainingSeconds * 1000;
      remainingSeconds = 0;
    } else {
      remainingSeconds -= secondsAvailable;
      currentMs += secondsAvailable * 1000;
    }
  }

  return new Date(currentMs);
};

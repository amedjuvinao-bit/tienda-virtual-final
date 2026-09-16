export const WEEK_DAYS = Object.freeze([
  { id: 'monday', label: 'Lunes', short: 'Lun' },
  { id: 'tuesday', label: 'Martes', short: 'Mar' },
  { id: 'wednesday', label: 'Miércoles', short: 'Mié' },
  { id: 'thursday', label: 'Jueves', short: 'Jue' },
  { id: 'friday', label: 'Viernes', short: 'Vie' },
  { id: 'saturday', label: 'Sábado', short: 'Sáb' },
  { id: 'sunday', label: 'Domingo', short: 'Dom' },
]);

export function createEmptyWeeklySchedule() {
  return {
    version: 1,
    days: WEEK_DAYS.map(({ id }) => ({
      day: id,
      enabled: false,
      intervals: [],
    })),
  };
}

export function normalizeWeeklySchedule(value) {
  if (!value || !Array.isArray(value.days)) return null;
  const source = new Map(value.days.map((entry) => [entry?.day, entry]));
  return {
    version: 1,
    days: WEEK_DAYS.map(({ id }) => {
      const day = source.get(id) || {};
      const enabled = day.enabled === true;
      return {
        day: id,
        enabled,
        intervals: enabled && Array.isArray(day.intervals)
          ? day.intervals.slice(0, 2).map((interval) => ({
              open: String(interval?.open || ''),
              close: String(interval?.close || ''),
            }))
          : [],
      };
    }),
  };
}

export function buildSchedulePreset(openDayIds, open = '08:00', close = '18:00') {
  const openDays = new Set(openDayIds);
  return {
    version: 1,
    days: WEEK_DAYS.map(({ id }) => ({
      day: id,
      enabled: openDays.has(id),
      intervals: openDays.has(id) ? [{ open, close }] : [],
    })),
  };
}

function timeLabel(value) {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return '';
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'p. m.' : 'a. m.'}`;
}

function intervalsKey(intervals = []) {
  return intervals.map(({ open, close }) => `${open}-${close}`).join('|');
}

function rangeLabel(group) {
  const first = WEEK_DAYS.find(({ id }) => id === group[0].day)?.label || group[0].day;
  const last = WEEK_DAYS.find(({ id }) => id === group.at(-1).day)?.label || group.at(-1).day;
  return group.length === 1 ? first : `${first} a ${last.toLowerCase()}`;
}

export function formatWeeklySchedule(value) {
  const schedule = normalizeWeeklySchedule(value);
  if (!schedule) return '';
  const openDays = schedule.days.filter((entry) => entry.enabled && entry.intervals.length);
  if (!openDays.length) return 'Cerrado todos los días';

  const groups = [];
  openDays.forEach((entry) => {
    const previous = groups.at(-1);
    const previousIndex = previous
      ? WEEK_DAYS.findIndex(({ id }) => id === previous.at(-1).day)
      : -2;
    const currentIndex = WEEK_DAYS.findIndex(({ id }) => id === entry.day);
    if (
      previous &&
      previousIndex + 1 === currentIndex &&
      intervalsKey(previous[0].intervals) === intervalsKey(entry.intervals)
    ) {
      previous.push(entry);
    } else {
      groups.push([entry]);
    }
  });

  return groups.map((group) => {
    const hours = group[0].intervals
      .map(({ open, close }) => `${timeLabel(open)} – ${timeLabel(close)}`)
      .join(' y ');
    return `${rangeLabel(group)}: ${hours}`;
  }).join('; ');
}

export function validateWeeklySchedule(value) {
  const schedule = normalizeWeeklySchedule(value);
  if (!schedule) return '';
  for (const day of schedule.days) {
    if (!day.enabled) continue;
    if (!day.intervals.length) return 'Cada día activo debe tener al menos un horario.';
    for (const interval of day.intervals) {
      if (!interval.open || !interval.close || interval.open >= interval.close) {
        return 'La hora de cierre debe ser posterior a la hora de apertura.';
      }
    }
    if (day.intervals.length === 2 && day.intervals[0].close > day.intervals[1].open) {
      return 'Los turnos de un mismo día no pueden superponerse.';
    }
  }
  return '';
}

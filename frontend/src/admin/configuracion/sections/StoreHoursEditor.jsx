import React, { useMemo } from 'react';
import { Clock3, Plus, Trash2, WandSparkles } from 'lucide-react';

import {
  WEEK_DAYS,
  buildSchedulePreset,
  createEmptyWeeklySchedule,
  formatWeeklySchedule,
  normalizeWeeklySchedule,
} from './storeHours';

const WEEKDAYS = WEEK_DAYS.slice(0, 5).map(({ id }) => id);
const MONDAY_TO_SATURDAY = WEEK_DAYS.slice(0, 6).map(({ id }) => id);
const EVERY_DAY = WEEK_DAYS.map(({ id }) => id);

export default function StoreHoursEditor({ value, legacySummary = '', error, onChange }) {
  const schedule = useMemo(
    () => normalizeWeeklySchedule(value) || createEmptyWeeklySchedule(),
    [value]
  );
  const summary = formatWeeklySchedule(value) || legacySummary;

  const updateDay = (dayId, updater) => {
    onChange({
      ...schedule,
      days: schedule.days.map((entry) =>
        entry.day === dayId ? updater(entry) : entry
      ),
    });
  };

  const toggleDay = (dayId, enabled) => {
    updateDay(dayId, (entry) => ({
      ...entry,
      enabled,
      intervals: enabled && !entry.intervals.length
        ? [{ open: '08:00', close: '18:00' }]
        : enabled ? entry.intervals : [],
    }));
  };

  const updateInterval = (dayId, index, field, fieldValue) => {
    updateDay(dayId, (entry) => ({
      ...entry,
      intervals: entry.intervals.map((interval, intervalIndex) =>
        intervalIndex === index ? { ...interval, [field]: fieldValue } : interval
      ),
    }));
  };

  const addInterval = (dayId) => {
    updateDay(dayId, (entry) => ({
      ...entry,
      intervals: entry.intervals.length === 1
        ? [
            { ...entry.intervals[0], close: entry.intervals[0].close === '18:00' ? '12:00' : entry.intervals[0].close },
            { open: entry.intervals[0].close === '18:00' ? '14:00' : entry.intervals[0].close, close: '23:00' },
          ]
        : entry.intervals,
    }));
  };

  const removeInterval = (dayId, index) => {
    updateDay(dayId, (entry) => ({
      ...entry,
      intervals: entry.intervals.filter((_, intervalIndex) => intervalIndex !== index),
    }));
  };

  return (
    <section className="store-hours" aria-labelledby="store-hours-title">
      <header className="store-hours__header">
        <div>
          <span className="store-hours__title" id="store-hours-title"><Clock3 size={17} /> Horario de atención</span>
          <small>Activa los días y selecciona las horas. Puedes añadir un segundo turno.</small>
        </div>
        <div className="store-hours__presets" aria-label="Horarios rápidos">
          <WandSparkles size={15} aria-hidden="true" />
          <button type="button" onClick={() => onChange(buildSchedulePreset(WEEKDAYS))}>Lun–Vie</button>
          <button type="button" onClick={() => onChange(buildSchedulePreset(MONDAY_TO_SATURDAY))}>Lun–Sáb</button>
          <button type="button" onClick={() => onChange(buildSchedulePreset(EVERY_DAY))}>Todos los días</button>
          <button type="button" onClick={() => onChange(createEmptyWeeklySchedule())}>Cerrar todos</button>
        </div>
      </header>

      {legacySummary && !value ? (
        <div className="store-hours__legacy">
          Horario anterior: <strong>{legacySummary}</strong>. Selecciona un horario para actualizarlo.
        </div>
      ) : null}

      <div className="store-hours__days">
        {WEEK_DAYS.map(({ id, label, short }) => {
          const day = schedule.days.find((entry) => entry.day === id);
          return (
            <div className="store-hours__day" data-open={day.enabled} key={id}>
              <label className="store-hours__day-toggle">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={(event) => toggleDay(id, event.target.checked)}
                />
                <span aria-hidden="true" />
                <b className="store-hours__day-full">{label}</b>
                <b className="store-hours__day-short">{short}</b>
              </label>
              {day.enabled ? (
                <div className="store-hours__intervals">
                  {day.intervals.map((interval, index) => (
                    <div className="store-hours__interval" key={`${id}-${index}`}>
                      <input
                        type="time"
                        aria-label={`Hora de apertura del ${label.toLowerCase()}, turno ${index + 1}`}
                        value={interval.open}
                        onChange={(event) => updateInterval(id, index, 'open', event.target.value)}
                      />
                      <span>a</span>
                      <input
                        type="time"
                        aria-label={`Hora de cierre del ${label.toLowerCase()}, turno ${index + 1}`}
                        value={interval.close}
                        onChange={(event) => updateInterval(id, index, 'close', event.target.value)}
                      />
                      {day.intervals.length > 1 ? (
                        <button
                          type="button"
                          className="store-hours__icon-button"
                          aria-label={`Eliminar turno ${index + 1} del ${label.toLowerCase()}`}
                          onClick={() => removeInterval(id, index)}
                        >
                          <Trash2 size={15} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {day.intervals.length < 2 ? (
                    <button type="button" className="store-hours__add" onClick={() => addInterval(id)}>
                      <Plus size={14} /> Segundo turno
                    </button>
                  ) : null}
                </div>
              ) : <span className="store-hours__closed">Cerrado</span>}
            </div>
          );
        })}
      </div>

      {error ? <span className="store-field__error" role="alert">{error}</span> : null}
      <div className="store-hours__summary" aria-live="polite">
        <strong>Así lo verá el cliente</strong>
        <span>{summary || 'Aún no has publicado un horario.'}</span>
      </div>
    </section>
  );
}

'use strict';

const FOLLOW_UP_RESULT_OUTCOMES = Object.freeze({
  resolved: 'Gestión resuelta',
  payment_confirmed: 'Pago confirmado por el cliente',
  promise_to_pay: 'Promesa de pago',
  no_answer: 'Cliente no respondió',
  customer_declined: 'Cliente rechazó la gestión',
  rescheduled: 'Contacto reprogramado',
  requires_follow_up: 'Requiere nuevo seguimiento',
  other: 'Otro resultado',
});

const FOLLOW_UP_CONTINUATION_OUTCOMES = Object.freeze([
  'promise_to_pay',
  'no_answer',
  'rescheduled',
  'requires_follow_up',
]);

function cleanText(value, max = 2000) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanLower(value) {
  return cleanText(value, 80).toLowerCase();
}

function resultError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  error.details = details;
  return error;
}

function normalizeCustomerFollowUpResult(body = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const outcome = cleanLower(body.outcome || body.result);

  if (!Object.prototype.hasOwnProperty.call(FOLLOW_UP_RESULT_OUTCOMES, outcome)) {
    throw resultError(
      'Debes seleccionar qué ocurrió en la gestión.',
      'FOLLOW_UP_RESULT_OUTCOME_REQUIRED'
    );
  }

  const note = cleanText(body.outcomeNote || body.resultNote || body.note);
  if (note.length < 5) {
    throw resultError(
      'Describe el resultado de la gestión con al menos 5 caracteres.',
      'FOLLOW_UP_RESULT_NOTE_REQUIRED'
    );
  }

  const continuesPending = FOLLOW_UP_CONTINUATION_OUTCOMES.includes(outcome);
  const nextAction = cleanText(body.nextAction, 500);
  const dueAt = body.dueAt ? new Date(body.dueAt) : null;

  if (continuesPending && nextAction.length < 3) {
    throw resultError(
      'Indica la siguiente acción porque la gestión continuará pendiente.',
      'FOLLOW_UP_RESULT_NEXT_ACTION_REQUIRED'
    );
  }

  if (
    continuesPending &&
    (!dueAt || Number.isNaN(dueAt.getTime()) || dueAt.getTime() <= now.getTime())
  ) {
    throw resultError(
      'Programa una fecha futura para continuar la gestión.',
      'FOLLOW_UP_RESULT_FUTURE_DUE_AT_REQUIRED'
    );
  }

  return {
    outcome,
    outcomeLabel: FOLLOW_UP_RESULT_OUTCOMES[outcome],
    note,
    continuesPending,
    statusAfter: continuesPending ? 'pending' : 'done',
    nextAction: continuesPending ? nextAction : '',
    dueAt: continuesPending ? dueAt : null,
    recordedAt: now,
  };
}

module.exports = {
  FOLLOW_UP_CONTINUATION_OUTCOMES,
  FOLLOW_UP_RESULT_OUTCOMES,
  normalizeCustomerFollowUpResult,
};

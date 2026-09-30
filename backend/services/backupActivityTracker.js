'use strict';

// A backup must wait for writes started after an HTTP response has finished.
let pending = 0;

function pendingBackgroundOperations() {
  return pending;
}

function scheduleTrackedBackground(scheduler, task, onError) {
  pending += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    pending -= 1;
  };

  try {
    scheduler(() => Promise.resolve()
      .then(task)
      .catch((error) => {
        try { onError(error); }
        catch (loggingError) {
          console.error('[background-operation] No se pudo registrar el error:', loggingError);
        }
      })
      .finally(release));
  } catch (error) {
    release();
    throw error;
  }
}

module.exports = { pendingBackgroundOperations, scheduleTrackedBackground };

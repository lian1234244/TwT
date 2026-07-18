async function waitForObsRecordStart(client, waitFn, options) {
  const settings = options || {};
  const attempts = Math.max(1, Number(settings.attempts) || 20);
  const intervalMs = Math.max(0, Number(settings.intervalMs) || 200);
  let lastStatus = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      lastStatus = await client.request('GetRecordStatus', {});
    } catch (error) {}
    if (lastStatus && lastStatus.outputActive === true) {
      return { ok: true, status: lastStatus };
    }
    if (attempt + 1 < attempts) await waitFn(intervalMs);
  }
  return { ok: false, status: lastStatus };
}

function nextObsCaptureProfile(currentProfileName) {
  return currentProfileName === 'Mineradio Capture A'
    ? 'Mineradio Capture B'
    : 'Mineradio Capture A';
}

module.exports = {
  waitForObsRecordStart,
  nextObsCaptureProfile,
};

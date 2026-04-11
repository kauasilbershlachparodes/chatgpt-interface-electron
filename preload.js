const { contextBridge, ipcRenderer } = require('electron');

const authConfig = Object.freeze(ipcRenderer.sendSync('matrix:security:get-auth-config') || {});
const securityStatus = Object.freeze(ipcRenderer.sendSync('matrix:security:get-status') || {});
const SERIALIZATION_MAGIC = 'matrix.serialized';
const SERIALIZATION_VERSION = 2;

const normalizeEnvelopeType = (value, fallback = 'matrix.generic') => {
  const normalized = String(value || '').trim().toLowerCase();
  return /^[a-z0-9._:-]{1,80}$/.test(normalized) ? normalized : fallback;
};

const securityBridge = Object.freeze({
  encryptedAtRest: Boolean(securityStatus && securityStatus.encryptedAtRest),
  sealString: (value) => ipcRenderer.sendSync('matrix:security:seal-string', String(value ?? '')),
  openString: (value) => ipcRenderer.sendSync('matrix:security:open-string', String(value ?? '')),
  signString: (value) => ipcRenderer.sendSync('matrix:security:sign-string', String(value ?? '')),
  verifySignedString: (value, signature) => ipcRenderer.sendSync('matrix:security:verify-signed-string', String(value ?? ''), String(signature ?? '')),
  serializeEnvelope: (type, payload, seal = true) => {
    const normalizedType = normalizeEnvelopeType(type);
    const payloadJson = JSON.stringify(payload ?? null);
    const signatureInput = `${normalizedType}:${payloadJson}`;
    const signature = ipcRenderer.sendSync('matrix:security:sign-string', signatureInput) || '';
    const envelopeJson = JSON.stringify({
      __format: SERIALIZATION_MAGIC,
      __type: normalizedType,
      __v: SERIALIZATION_VERSION,
      issuedAt: Date.now(),
      payload: payloadJson,
      signature,
      integrity: signature ? 'hmac-sha256' : 'none'
    });

    return seal ? ipcRenderer.sendSync('matrix:security:seal-string', envelopeJson) : envelopeJson;
  },
  deserializeEnvelope: (value, expectedType = '') => {
    const opened = ipcRenderer.sendSync('matrix:security:open-string', String(value ?? ''));
    if (!opened || typeof opened !== 'string') {
      return null;
    }

    try {
      const parsed = JSON.parse(opened);
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      if (parsed.__format !== SERIALIZATION_MAGIC || Number(parsed.__v || 0) !== SERIALIZATION_VERSION) {
        return null;
      }

      const actualType = normalizeEnvelopeType(parsed.__type, '');
      const normalizedExpectedType = expectedType ? normalizeEnvelopeType(expectedType, '') : '';
      const payloadJson = typeof parsed.payload === 'string' ? parsed.payload : '';
      const signature = typeof parsed.signature === 'string' ? parsed.signature : '';

      if (!actualType || !payloadJson || (normalizedExpectedType && actualType !== normalizedExpectedType)) {
        return null;
      }

      if (!signature || !ipcRenderer.sendSync('matrix:security:verify-signed-string', `${actualType}:${payloadJson}`, signature)) {
        return null;
      }

      return JSON.parse(payloadJson);
    } catch (_error) {
      return null;
    }
  }
});

contextBridge.exposeInMainWorld('electronAPI', Object.freeze({
  version: process.versions.electron,
  authConfig,
  authStatus: Object.freeze({
    isConfigured: Boolean(authConfig && authConfig.isConfigured),
    loadedFrom: authConfig && typeof authConfig.loadedFrom === 'string' ? authConfig.loadedFrom : ''
  }),
  security: securityBridge
}));

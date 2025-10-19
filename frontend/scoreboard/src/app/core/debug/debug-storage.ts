// ⚠️ SOLO PARA DEPURAR. Quita esto cuando encontremos al culpable.
export function installStorageDebugging() {
  const origSet   = Storage.prototype.setItem;
  const origRem   = Storage.prototype.removeItem;
  const origClear = Storage.prototype.clear;

  function where() {
    try { throw new Error(); } catch (e: any) {
      return (e.stack || '').split('\n').slice(2, 8).join('\n');
    }
  }

  Storage.prototype.setItem = function (k: string, v: string) {
    if (k === 'token' || k === 'user') {
      console.warn('[storage:setItem]', k, { len: v?.length }, '\n', where());
    }
    return origSet.apply(this, arguments as any);
  };

  Storage.prototype.removeItem = function (k: string) {
    if (k === 'token' || k === 'user') {
      console.error('[storage:removeItem]', k, '\n', where());
    }
    return origRem.apply(this, arguments as any);
  };

  Storage.prototype.clear = function () {
    console.error('[storage:clear]', '\n', where());
    return origClear.apply(this, arguments as any);
  };

  window.addEventListener('storage', (e) => {
    if (e.key === 'token' || e.key === 'user' || e.key === null) {
      console.log('[storage:event]', e.key, 'new=', e.newValue, 'old=', e.oldValue);
    }
  });
}

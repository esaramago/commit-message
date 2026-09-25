const Module = require('module')
const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'vscode') {
    return {
      version: '1.80.0',
      env: { isTelemetryEnabled: true, language: 'en' },
      workspace: {
        getConfiguration: () => ({
          get: (key, defaultValue) => defaultValue,
        }),
      },
    }
  }
  return originalLoad.apply(this, arguments)
}

// /js/mappers/registrations.js
(function (global) {
  'use strict';
  const root = global.Mappers || (global.Mappers = {});
  const fields =
    global.Schema && global.Schema.Forms && global.Schema.Forms.Registrations
      ? global.Schema.Forms.Registrations()
      : null;

  const factory = root && root.makeRegistrationMappersFromSchema;
  const generated = factory && fields ? factory(fields) : { toUi: (x) => x || {}, toApi: (x) => x || {} };

  root.Registrations = generated;
})(typeof window !== 'undefined' ? window : globalThis);

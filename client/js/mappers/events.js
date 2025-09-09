// /js/mappers/events.js
(function (global) {
  'use strict';
  const root = global.Mappers || (global.Mappers = {});
  const fields =
    global.Schema && global.Schema.Forms && global.Schema.Forms.Events
      ? global.Schema.Forms.Events() // no ctx needed for mapping; we only read col/default/api
      : null;

  const factory = global.Util && global.Util.Helpers && global.Util.Helpers.makeEventMappersFromSchema;
  const generated = factory && fields ? factory(fields) : { toUi: (x) => x || {}, toApi: (x) => x || {} };

  root.Events = generated;
})(typeof window !== 'undefined' ? window : globalThis);

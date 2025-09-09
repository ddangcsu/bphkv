// /js/mappers/families.js
(function (global) {
  'use strict';
  const root = global.Mappers || (global.Mappers = {});
  const fields =
    global.Schema && global.Schema.Forms && global.Schema.Forms.Families
      ? global.Schema.Forms.Families() // no ctx needed for mapping; we only read col/default/api
      : null;

  const factory = global.Util && global.Util.Helpers && global.Util.Helpers.makeFamilyMappersFromSchema;
  const generated = factory && fields ? factory(fields) : { toUi: (x) => x || {}, toApi: (x) => x || {} };

  root.Families = generated;
})(typeof window !== 'undefined' ? window : globalThis);

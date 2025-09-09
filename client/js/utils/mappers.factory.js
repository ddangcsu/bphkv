// /js/utils/mappers.factory.js
(function (global) {
  'use strict';
  const U = global.Util || (global.Util = {});
  const Helpers = U.Helpers || (U.Helpers = {});

  // add near the top
  function isMissing(v) {
    return v === undefined || v === null || (typeof v === 'number' && Number.isNaN(v));
  }

  function getWithDefault(rawValue, defaultValue) {
    if (isMissing(rawValue)) {
      return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
    }
    return rawValue;
  }

  function getApiKey(fieldMeta) {
    return (fieldMeta.api && fieldMeta.api.key) || fieldMeta.col;
  }

  function readFieldValueFromApi(sourceObject, fieldMeta) {
    const apiKey = getApiKey(fieldMeta);
    const apiValue = sourceObject ? sourceObject[apiKey] : undefined;
    return fieldMeta.api && typeof fieldMeta.api.fromApi === 'function'
      ? fieldMeta.api.fromApi(apiValue, sourceObject)
      : apiValue;
  }

  function writeFieldValueToApi(sourceObject, fieldMeta) {
    const apiKey = getApiKey(fieldMeta);
    const uiValue = sourceObject ? sourceObject[fieldMeta.col] : undefined;
    const apiValue =
      fieldMeta.api && typeof fieldMeta.api.toApi === 'function' ? fieldMeta.api.toApi(uiValue, sourceObject) : uiValue;
    return [apiKey, apiValue];
  }

  Helpers.makeFamilyMappersFromSchema = function makeFamilyMappersFromSchema(familySchema) {
    const mainFields = familySchema.household?.main || [];
    const addressFields = familySchema.household?.address || [];
    const contactFields = familySchema.contacts || [];
    const childFields = familySchema.children || [];
    const noteFields = familySchema.notes || [];

    function toUi(apiFamily = {}) {
      const uiFamily = {};

      mainFields.forEach((fieldMeta) => {
        uiFamily[fieldMeta.col] = getWithDefault(readFieldValueFromApi(apiFamily, fieldMeta), fieldMeta.default);
      });

      const apiAddress = apiFamily.address || {};
      uiFamily.address = {};
      addressFields.forEach((fieldMeta) => {
        uiFamily.address[fieldMeta.col] = getWithDefault(
          readFieldValueFromApi(apiAddress, fieldMeta),
          fieldMeta.default,
        );
      });

      uiFamily.contacts = Array.isArray(apiFamily.contacts)
        ? apiFamily.contacts.map((apiRow) => {
            const uiRow = {};
            contactFields.forEach((fieldMeta) => {
              uiRow[fieldMeta.col] = getWithDefault(readFieldValueFromApi(apiRow, fieldMeta), fieldMeta.default);
            });
            return uiRow;
          })
        : [];

      uiFamily.children = Array.isArray(apiFamily.children)
        ? apiFamily.children.map((apiRow) => {
            const uiRow = {};
            childFields.forEach((fieldMeta) => {
              uiRow[fieldMeta.col] = getWithDefault(readFieldValueFromApi(apiRow, fieldMeta), fieldMeta.default);
            });
            return uiRow;
          })
        : [];

      uiFamily.notes = Array.isArray(apiFamily.notes)
        ? apiFamily.notes.map((apiRow) => {
            const uiRow = {};
            noteFields.forEach((fieldMeta) => {
              uiRow[fieldMeta.col] = getWithDefault(readFieldValueFromApi(apiRow, fieldMeta), fieldMeta.default);
            });
            return uiRow;
          })
        : [];

      return uiFamily;
    }

    function toApi(uiFamily = {}) {
      const apiFamily = {};

      mainFields.forEach((fieldMeta) => {
        const [apiKey, apiValue] = writeFieldValueToApi(uiFamily, fieldMeta);
        if (apiValue !== undefined) apiFamily[apiKey] = apiValue;
      });

      apiFamily.address = {};
      const uiAddress = uiFamily.address || {};
      addressFields.forEach((fieldMeta) => {
        const [apiKey, apiValue] = writeFieldValueToApi(uiAddress, fieldMeta);
        if (apiValue !== undefined) apiFamily.address[apiKey] = apiValue;
      });

      apiFamily.contacts = Array.isArray(uiFamily.contacts)
        ? uiFamily.contacts.map((uiRow) => {
            const apiRow = {};
            contactFields.forEach((fieldMeta) => {
              const [apiKey, apiValue] = writeFieldValueToApi(uiRow, fieldMeta);
              if (apiValue !== undefined) apiRow[apiKey] = apiValue;
            });
            return apiRow;
          })
        : [];

      apiFamily.children = Array.isArray(uiFamily.children)
        ? uiFamily.children.map((uiRow) => {
            const apiRow = {};
            childFields.forEach((fieldMeta) => {
              const [apiKey, apiValue] = writeFieldValueToApi(uiRow, fieldMeta);
              if (apiValue !== undefined) apiRow[apiKey] = apiValue;
            });
            return apiRow;
          })
        : [];

      apiFamily.notes = Array.isArray(uiFamily.notes)
        ? uiFamily.notes.map((uiRow) => {
            const apiRow = {};
            noteFields.forEach((fieldMeta) => {
              const [apiKey, apiValue] = writeFieldValueToApi(uiRow, fieldMeta);
              if (apiValue !== undefined) apiRow[apiKey] = apiValue;
            });
            return apiRow;
          })
        : [];

      return apiFamily;
    }

    return { toUi, toApi };
  };

  Helpers.makeEventMappersFromSchema = function makeEventMappersFromSchema(eventSchema) {
    const mainFields = Array.isArray(eventSchema.main) ? eventSchema.main : [];
    const feeFields = Array.isArray(eventSchema.feeRow) ? eventSchema.feeRow : [];
    const prereqFields = Array.isArray(eventSchema.prerequisiteRow) ? eventSchema.prerequisiteRow : [];

    function toUi(apiEvent = {}) {
      const uiEvent = {};

      mainFields.forEach((fieldMeta) => {
        uiEvent[fieldMeta.col] = getWithDefault(readFieldValueFromApi(apiEvent, fieldMeta), fieldMeta.default);
      });

      uiEvent.fees = Array.isArray(apiEvent.fees)
        ? apiEvent.fees.map((apiRow) => {
            const uiRow = {};
            feeFields.forEach((fieldMeta) => {
              uiRow[fieldMeta.col] = getWithDefault(readFieldValueFromApi(apiRow, fieldMeta), fieldMeta.default);
            });
            return uiRow;
          })
        : [];

      uiEvent.prerequisites = Array.isArray(apiEvent.prerequisites)
        ? apiEvent.prerequisites.map((apiRow) => {
            const uiRow = {};
            prereqFields.forEach((fieldMeta) => {
              uiRow[fieldMeta.col] = getWithDefault(readFieldValueFromApi(apiRow, fieldMeta), fieldMeta.default);
            });
            return uiRow;
          })
        : [];

      return uiEvent;
    }

    function toApi(uiEvent = {}) {
      const apiEvent = {};

      mainFields.forEach((fieldMeta) => {
        const [apiKey, apiValue] = writeFieldValueToApi(uiEvent, fieldMeta);
        if (apiValue !== undefined) apiEvent[apiKey] = apiValue;
      });

      apiEvent.fees = Array.isArray(uiEvent.fees)
        ? uiEvent.fees.map((uiRow) => {
            const apiRow = {};
            feeFields.forEach((fieldMeta) => {
              const [apiKey, apiValue] = writeFieldValueToApi(uiRow, fieldMeta);
              if (apiValue !== undefined) apiRow[apiKey] = apiValue;
            });
            return apiRow;
          })
        : [];

      apiEvent.prerequisites = Array.isArray(uiEvent.prerequisites)
        ? uiEvent.prerequisites.map((uiRow) => {
            const apiRow = {};
            prereqFields.forEach((fieldMeta) => {
              const [apiKey, apiValue] = writeFieldValueToApi(uiRow, fieldMeta);
              if (apiValue !== undefined) apiRow[apiKey] = apiValue;
            });
            return apiRow;
          })
        : [];
      return apiEvent;
    }

    return { toUi, toApi };
  };
})(typeof window !== 'undefined' ? window : globalThis);

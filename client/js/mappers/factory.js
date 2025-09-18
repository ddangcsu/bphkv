// /js/utils/mappers.factory.js
(function (global) {
  'use strict';
  const Mappers = (window.Mappers ||= {});

  function cloneIfObject(valueToClone) {
    const isObjectLike = valueToClone && typeof valueToClone === 'object';
    return isObjectLike ? JSON.parse(JSON.stringify(valueToClone)) : valueToClone;
  }

  function getWithDefault(rawValue, defaultValue) {
    const isMissing = rawValue === undefined || rawValue === null;
    if (!isMissing) return rawValue;

    const resolvedDefault = typeof defaultValue === 'function' ? defaultValue() : defaultValue;

    return cloneIfObject(resolvedDefault);
  }

  /**
   * compute a minimal deep diff between two values.
   * - If arrays differ at all, returns the entire new array.
   * - If objects differ, returns an object with only changed keys.
   * - For primitives (and mismatched types), returns the new value.
   * - Returns `undefined` if there is no difference.
   */
  function diffDeep(previousValue, nextValue) {
    if (previousValue === nextValue) return undefined;

    const prevTag = Object.prototype.toString.call(previousValue);
    const nextTag = Object.prototype.toString.call(nextValue);

    // Different types → replace wholesale
    if (prevTag !== nextTag) return cloneIfObject(nextValue);

    // Arrays: replace if any element differs (simple + predictable)
    if (nextTag === '[object Array]') {
      const prevArray = previousValue || [];
      const nextArray = nextValue || [];

      if (prevArray.length !== nextArray.length) return cloneIfObject(nextArray);

      for (let index = 0; index < nextArray.length; index++) {
        const elementDiff = diffDeep(prevArray[index], nextArray[index]);
        if (elementDiff !== undefined) return cloneIfObject(nextArray);
      }
      return undefined;
    }

    // Objects: recurse by keys
    if (nextTag === '[object Object]') {
      const diffResult = {};
      const allKeys = new Set([...Object.keys(previousValue || {}), ...Object.keys(nextValue || {})]);

      let hasChanges = false;
      for (const key of allKeys) {
        const valueDiff = diffDeep(
          previousValue ? previousValue[key] : undefined,
          nextValue ? nextValue[key] : undefined,
        );
        if (valueDiff !== undefined) {
          hasChanges = true;
          diffResult[key] = valueDiff;
        }
      }
      return hasChanges ? diffResult : undefined;
    }

    // Primitive or anything else → replace
    return cloneIfObject(nextValue);
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

  /* ===========================
   Field/Row mappers (UI <-> API)
   =========================== */

  /**
   * API -> UI (single object)
   * mapFieldsToUi(apiSourceObject, fieldMetas) -> { [col]: value }
   */
  function mapFieldsToUi(apiSourceObject, fieldMetas) {
    const uiObject = {};
    if (!apiSourceObject || !Array.isArray(fieldMetas)) return uiObject;

    for (const fieldMeta of fieldMetas) {
      const valueFromApi = readFieldValueFromApi(apiSourceObject, fieldMeta);
      uiObject[fieldMeta.col] = getWithDefault(valueFromApi, fieldMeta.default);
    }
    return uiObject;
  }

  /**
   * API -> UI (array of objects)
   * mapRowsToUi(apiArraySource, fieldMetas) -> Array<{ [col]: value }>
   */
  function mapRowsToUi(apiArraySource, fieldMetas) {
    if (!Array.isArray(apiArraySource)) return [];
    return apiArraySource.map((rowObject) => mapFieldsToUi(rowObject, fieldMetas));
  }

  /**
   * UI -> API (single object)
   * mapFieldsToApi(uiSourceObject, fieldMetas) -> { ...api shaped... }
   */
  function mapFieldsToApi(uiSourceObject, fieldMetas) {
    const apiObject = {};
    if (!uiSourceObject || !Array.isArray(fieldMetas)) return apiObject;

    for (const fieldMeta of fieldMetas) {
      const [apiKey, apiValue] = writeFieldValueToApi(uiSourceObject, fieldMeta);
      if (apiValue !== undefined) apiObject[apiKey] = apiValue;
    }
    return apiObject;
  }

  /**
   * UI -> API (array of objects)
   * mapRowsToApi(uiArraySource, fieldMetas) -> Array<{...api shaped...}>
   */
  function mapRowsToApi(uiArraySource, fieldMetas) {
    if (!Array.isArray(uiArraySource)) return [];
    return uiArraySource.map((rowObject) => mapFieldsToApi(rowObject, fieldMetas));
  }

  Mappers.makeFamilyMappersFromSchema = function makeFamilyMappersFromSchema(familySchema) {
    const mainFields = familySchema.household?.main || [];
    const addressFields = familySchema.household?.address || [];
    const contactFields = familySchema.contacts || [];
    const childFields = familySchema.children || [];
    const noteFields = familySchema.notes || [];

    function toUi(apiFamily = {}) {
      const ui = {
        ...mapFieldsToUi(apiFamily, mainFields),
        address: mapFieldsToUi(apiFamily?.address, addressFields),
        contacts: mapRowsToUi(apiFamily?.contacts, contactFields),
        children: mapRowsToUi(apiFamily?.children, childFields),
        notes: mapRowsToUi(apiFamily?.notes, noteFields),
      };
      return ui;
    }

    function toApi(uiFamily = {}) {
      const api = {
        ...mapFieldsToApi(uiFamily, mainFields),
        address: mapFieldsToApi(uiFamily?.address, addressFields),
        contacts: mapRowsToApi(uiFamily?.contacts, contactFields),
        children: mapRowsToApi(uiFamily?.children, childFields),
        notes: mapRowsToApi(uiFamily?.notes, noteFields),
      };
      return api;
    }

    return { toUi, toApi };
  };

  Mappers.makeEventMappersFromSchema = function makeEventMappersFromSchema(eventSchema) {
    const mainFields = Array.isArray(eventSchema.main) ? eventSchema.main : [];
    const feeFields = Array.isArray(eventSchema.feeRow) ? eventSchema.feeRow : [];
    const prereqFields = Array.isArray(eventSchema.prerequisiteRow) ? eventSchema.prerequisiteRow : [];

    function toUi(apiEvent = {}) {
      const ui = {
        ...mapFieldsToUi(apiEvent, mainFields),
        fees: mapRowsToUi(apiEvent?.fees, feeFields),
        prerequisites: mapRowsToUi(apiEvent?.prerequisites, prereqFields),
      };
      return ui;
    }

    function toApi(uiEvent = {}) {
      const api = {
        ...mapFieldsToApi(uiEvent, mainFields),
        fees: mapRowsToApi(uiEvent?.fees, feeFields),
        prerequisites: mapRowsToApi(uiEvent?.prerequisites, prereqFields),
      };
      return api;
    }

    return { toUi, toApi };
  };

  Mappers.makeRegistrationMappersFromSchema = function makeRegistrationMappersFromSchema(regSchema) {
    const mainFields = Array.isArray(regSchema.main) ? regSchema.main : [];
    const metaFields = Array.isArray(regSchema.meta) ? regSchema.meta : [];
    const eventSnapFields = Array.isArray(regSchema.eventSnapshot) ? regSchema.eventSnapshot : [];
    const contactSnapFields = Array.isArray(regSchema.contactSnapshot) ? regSchema.contactSnapshot : [];
    const childFields = Array.isArray(regSchema.childrenRow) ? regSchema.childrenRow : [];
    const paymentFields = Array.isArray(regSchema.paymentsRow) ? regSchema.paymentsRow : [];
    const noteFields = Array.isArray(regSchema.notes) ? regSchema.notes : [];

    function toUi(apiReg = {}) {
      const ui = {
        ...mapFieldsToUi(apiReg, mainFields),
        ...mapFieldsToUi(apiReg, metaFields),
        event: mapFieldsToUi(apiReg?.event, eventSnapFields),
        contacts: mapRowsToUi(apiReg?.contacts, contactSnapFields),
        children: mapRowsToUi(apiReg?.children, childFields),
        payments: mapRowsToUi(apiReg?.payments, paymentFields),
        notes: mapRowsToUi(apiReg?.notes, noteFields),
        createdAt: apiReg.createdAt !== undefined ? apiReg.createdAt : null,
        updatedAt: apiReg.updatedAt !== undefined ? apiReg.updatedAt : null,
      };

      return ui;
    }

    function toApi(uiReg = {}) {
      const api = {
        ...mapFieldsToApi(uiReg, mainFields),
        ...mapFieldsToApi(uiReg, metaFields),
        event: mapFieldsToApi(uiReg?.event, eventSnapFields),
        contacts: mapRowsToApi(uiReg?.contacts, contactSnapFields),
        children: mapRowsToApi(uiReg?.children, childFields),
        payments: mapRowsToApi(uiReg?.payments, paymentFields),
        notes: mapRowsToApi(uiReg?.notes, noteFields),
      };

      return api;
    }

    return { toUi, toApi };
  };

  Mappers.makeFamilyPatchFromSchema = function makeFamilyPatchFromSchema(
    familySchema,
    originalApiObject,
    updatedUiObject,
  ) {
    const mapperFactory = Helpers.makeFamilyMappersFromSchema;
    if (typeof mapperFactory !== 'function') return {};
    const { toApi } = mapperFactory(familySchema);

    const previousApi = originalApiObject || {};
    const nextApi = toApi(updatedUiObject || {});
    const delta = diffDeep(previousApi, nextApi);
    return delta || {};
  };

  Mappers.makeEventPatchFromSchema = function makeEventPatchFromSchema(
    eventSchema,
    originalApiObject,
    updatedUiObject,
  ) {
    const mapperFactory = Helpers.makeEventMappersFromSchema;
    if (typeof mapperFactory !== 'function') return {};
    const { toApi } = mapperFactory(eventSchema);

    const previousApi = originalApiObject || {};
    const nextApi = toApi(updatedUiObject || {});
    const delta = diffDeep(previousApi, nextApi);
    return delta || {};
  };

  Mappers.makeRegistrationPatchFromSchema = function makeRegistrationPatchFromSchema(
    regSchema,
    originalApiObject,
    updatedUiObject,
  ) {
    const mapperFactory = Helpers.makeRegistrationMappersFromSchema;
    if (typeof mapperFactory !== 'function') return {};
    const { toApi } = mapperFactory(regSchema);

    const previousApi = originalApiObject || {};
    const nextApi = toApi(updatedUiObject || {});
    const delta = diffDeep(previousApi, nextApi);
    return delta || {};
  };
})(typeof window !== 'undefined' ? window : globalThis);

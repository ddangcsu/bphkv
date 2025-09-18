/* eslint-env browser, es2021 */
/* global Schema */
(function attachDomainEligibility(global) {
  'use strict';

  const Domain = global.Domain || (global.Domain = {});
  const Eligibility = {};

  /**
   * Which event type is required as a prerequisite for the given eventType?
   * - REGISTRATION requires ADMIN
   * - EVENT requires REGISTRATION
   * - ADMIN requires none
   */
  Eligibility.requiredPrereqType = function requiredPrereqType(eventType) {
    const E = ENUMS.EVENT;
    if (eventType === E.REGISTRATION) return E.ADMIN;
    if (eventType === E.EVENT) return E.REGISTRATION;
    return null;
  };

  Eligibility.canHavePrereqs = function canHavePrereqs(eventType) {
    return Eligibility.requiredPrereqType(eventType) !== null;
  };

  /**
   * Is a candidate event valid as a prerequisite for the current form?
   * Rules: same school year, not the same event, and the eventType must match
   * the required type for this form's eventType and the open date of the event must
   * be greater or equal to the pre-req event open date
   */
  Eligibility.isValidPrereqSelection = function isValidPrereqSelection(candidateEvent, form) {
    if (!candidateEvent || !form) return false;
    const neededType = Eligibility.requiredPrereqType(form.eventType);
    if (!neededType) return false;
    if (String(candidateEvent.id) === String(form.id)) return false;
    if (Number(candidateEvent.year) !== Number(form.year)) return false;
    if (Util.Date.dateStringToIso(form.openDate) < Util.Date.dateStringToIso(candidateEvent.openDate)) return false;
    return (candidateEvent.eventType || '') === neededType;
  };

  /**
   * Given all events + the current form, return the list of selectable prerequisite events
   * for a particular row (exclude the one already picked in other rows to avoid duplicates).
   */
  Eligibility.filterAvailablePrereqEvents = function filterAvailablePrereqEvents(
    allEvents,
    form,
    currentRowIndex = -1,
  ) {
    const selectedElsewhere = new Set(
      (form?.prerequisites || []).map((p, i) => (i === currentRowIndex ? null : p?.eventId)).filter(Boolean),
    );
    return (allEvents || []).filter(
      (ev) => Eligibility.isValidPrereqSelection(ev, form) && !selectedElsewhere.has(ev.id),
    );
  };

  Domain.Eligibility = Eligibility;
})(typeof window !== 'undefined' ? window : globalThis);

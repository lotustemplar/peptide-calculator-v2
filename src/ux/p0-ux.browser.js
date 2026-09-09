/* Generated from src/occ + src/ux. Do not edit by hand. */
(function (root) {
  var modules = Object.create(null);
  function createRequire(fromDir) {
    return function (spec) {
      if (typeof spec !== "string") {
        throw new Error("P0.UX bundle: invalid require");
      }
      var cleaned = spec.replace(/\\/g, "/").replace(/\.js$/, "");
      var resolved;
      if (cleaned.charAt(0) === ".") {
        var base = fromDir ? fromDir + "/" + cleaned : cleaned;
        resolved = base.split("/").reduce(function (acc, part) {
          if (part === "." || part === "") {
            return acc;
          }
          if (part === "..") {
            acc.pop();
            return acc;
          }
          acc.push(part);
          return acc;
        }, []).join("/");
      } else {
        resolved = cleaned;
      }
      if (!modules[resolved]) {
        throw new Error("P0.UX bundle: missing module " + resolved);
      }
      return modules[resolved].exports;
    };
  }
  modules["occ/identity"] = { exports: {}, dirname: "occ" };
  modules["occ/index"] = { exports: {}, dirname: "occ" };
  modules["occ/legacy"] = { exports: {}, dirname: "occ" };
  modules["occ/types"] = { exports: {}, dirname: "occ" };
  modules["occ/validate"] = { exports: {}, dirname: "occ" };
  modules["occ/writer"] = { exports: {}, dirname: "occ" };
  modules["persist/classify"] = { exports: {}, dirname: "persist" };
  modules["persist/copy"] = { exports: {}, dirname: "persist" };
  modules["persist/export"] = { exports: {}, dirname: "persist" };
  modules["persist/fields"] = { exports: {}, dirname: "persist" };
  modules["persist/import"] = { exports: {}, dirname: "persist" };
  modules["persist/index"] = { exports: {}, dirname: "persist" };
  modules["persist/keys"] = { exports: {}, dirname: "persist" };
  modules["persist/map-baseline"] = { exports: {}, dirname: "persist" };
  modules["persist/map-github"] = { exports: {}, dirname: "persist" };
  modules["persist/map"] = { exports: {}, dirname: "persist" };
  modules["persist/policy"] = { exports: {}, dirname: "persist" };
  modules["persist/preview"] = { exports: {}, dirname: "persist" };
  modules["persist/recovery"] = { exports: {}, dirname: "persist" };
  modules["persist/types"] = { exports: {}, dirname: "persist" };
  modules["persist/writer"] = { exports: {}, dirname: "persist" };
  modules["ux/adapter"] = { exports: {}, dirname: "ux" };
  modules["ux/cabinet-cascade"] = { exports: {}, dirname: "ux" };
  modules["ux/copy"] = { exports: {}, dirname: "ux" };
  modules["ux/dialog"] = { exports: {}, dirname: "ux" };
  modules["ux/index"] = { exports: {}, dirname: "ux" };
  modules["ux/persist"] = { exports: {}, dirname: "ux" };
  modules["ux/save-summary"] = { exports: {}, dirname: "ux" };
  modules["ux/wizard"] = { exports: {}, dirname: "ux" };

  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeScheduleId = exports.normalizeLocalCivilDate = exports.normalizeIsoInstant = exports.normalizeIanaTimeZone = void 0;
exports.occurrenceIdentityKey = occurrenceIdentityKey;
exports.deterministicOccurrenceId = deterministicOccurrenceId;
exports.findDuplicateIdentity = findDuplicateIdentity;
exports.lookupOccurrence = lookupOccurrence;
exports.countIdentityMatches = countIdentityMatches;
exports.materializeOccurrence = materializeOccurrence;
exports.replaceOccurrence = replaceOccurrence;
const types_1 = require("./types");
const validate_1 = require("./validate");
Object.defineProperty(exports, "normalizeIanaTimeZone", { enumerable: true, get: function () { return validate_1.normalizeIanaTimeZone; } });
Object.defineProperty(exports, "normalizeIsoInstant", { enumerable: true, get: function () { return validate_1.normalizeIsoInstant; } });
Object.defineProperty(exports, "normalizeLocalCivilDate", { enumerable: true, get: function () { return validate_1.normalizeLocalCivilDate; } });
Object.defineProperty(exports, "normalizeScheduleId", { enumerable: true, get: function () { return validate_1.normalizeScheduleId; } });
function occurrenceIdentityKey(scheduleId, localCivilDate) {
    return `${scheduleId}\u001f${localCivilDate}`;
}
function deterministicOccurrenceId(scheduleId, localCivilDate) {
    return `occ:${scheduleId}:${localCivilDate}`;
}
function findDuplicateIdentity(records) {
    const seen = new Set();
    for (const row of records) {
        const key = occurrenceIdentityKey(row.scheduleId, row.localCivilDate);
        if (seen.has(key)) {
            return { scheduleId: row.scheduleId, localCivilDate: row.localCivilDate };
        }
        seen.add(key);
    }
    return null;
}
function lookupOccurrence(records, scheduleId, localCivilDate) {
    const sid = (0, validate_1.normalizeScheduleId)(scheduleId);
    const date = (0, validate_1.normalizeLocalCivilDate)(localCivilDate);
    if (!sid || !date) {
        return null;
    }
    return (records.find((row) => row.scheduleId === sid && row.localCivilDate === date) ?? null);
}
function countIdentityMatches(records, scheduleId, localCivilDate) {
    const key = occurrenceIdentityKey(scheduleId, localCivilDate);
    return records.filter((row) => occurrenceIdentityKey(row.scheduleId, row.localCivilDate) === key).length;
}
function materializeOccurrence(records, input) {
    const unchanged = (0, types_1.cloneOccurrences)(records);
    const duplicate = findDuplicateIdentity(records);
    if (duplicate) {
        return {
            ok: false,
            code: "DUPLICATE_IDENTITY",
            message: `duplicate occurrence identity (${duplicate.scheduleId}, ${duplicate.localCivilDate})`,
            records: unchanged,
        };
    }
    const scheduleId = (0, validate_1.normalizeScheduleId)(input.scheduleId);
    const localCivilDate = (0, validate_1.normalizeLocalCivilDate)(input.localCivilDate);
    if (!scheduleId || !localCivilDate) {
        return {
            ok: false,
            code: "INVALID_IDENTITY",
            message: "scheduleId/localCivilDate is not a real identity pair",
            records: unchanged,
        };
    }
    const timeZone = (0, validate_1.normalizeIanaTimeZone)(input.timeZone);
    if (!timeZone) {
        return {
            ok: false,
            code: "INVALID_TIMEZONE",
            message: "timeZone is not a valid IANA identifier",
            records: unchanged,
        };
    }
    const nowIso = (0, validate_1.normalizeIsoInstant)(input.nowIso);
    if (!nowIso) {
        return {
            ok: false,
            code: "INVALID_INSTANT",
            message: "nowIso is not a valid ISO-8601 instant",
            records: unchanged,
        };
    }
    const existing = lookupOccurrence(records, scheduleId, localCivilDate);
    if (existing) {
        return {
            ok: true,
            record: { ...existing },
            records: unchanged,
            created: false,
        };
    }
    const id = input.createId ? input.createId() : deterministicOccurrenceId(scheduleId, localCivilDate);
    const record = {
        id,
        scheduleId,
        localCivilDate,
        timeZone,
        status: "pending",
        takenAt: null,
        appliedDepletionAmount: null,
        appliedDepletionUnit: null,
        appliedFillId: null,
        updatedAt: nowIso,
    };
    return {
        ok: true,
        record: { ...record },
        records: [...unchanged, { ...record }],
        created: true,
    };
}
function replaceOccurrence(records, next) {
    const key = occurrenceIdentityKey(next.scheduleId, next.localCivilDate);
    let replaced = false;
    const out = records.map((row) => {
        if (occurrenceIdentityKey(row.scheduleId, row.localCivilDate) === key) {
            replaced = true;
            return { ...next };
        }
        return { ...row };
    });
    if (!replaced) {
        out.push({ ...next });
    }
    return out;
}

  })(
    modules["occ/identity"].exports,
    createRequire(modules["occ/identity"].dirname),
    modules["occ/identity"],
    "occ"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.undoTaken = exports.reloadSnapshot = exports.markTaken = exports.assertExactDepletionUnits = exports.materializeLegacyTakenDates = exports.explicitLegacyTakenDates = exports.replaceOccurrence = exports.occurrenceIdentityKey = exports.normalizeScheduleId = exports.normalizeLocalCivilDate = exports.normalizeIsoInstant = exports.normalizeIanaTimeZone = exports.materializeOccurrence = exports.lookupOccurrence = exports.findDuplicateIdentity = exports.deterministicOccurrenceId = exports.countIdentityMatches = exports.SUPPORTED_DEPLETION_UNITS = exports.P0_OCCURRENCE_STATUSES = exports.LOCAL_CIVIL_DATE_RE = exports.isSupportedDepletionUnit = exports.depletionApplied = exports.cloneSnapshot = exports.cloneOccurrences = exports.cloneOccurrence = void 0;
var types_1 = require("./types");
Object.defineProperty(exports, "cloneOccurrence", { enumerable: true, get: function () { return types_1.cloneOccurrence; } });
Object.defineProperty(exports, "cloneOccurrences", { enumerable: true, get: function () { return types_1.cloneOccurrences; } });
Object.defineProperty(exports, "cloneSnapshot", { enumerable: true, get: function () { return types_1.cloneSnapshot; } });
Object.defineProperty(exports, "depletionApplied", { enumerable: true, get: function () { return types_1.depletionApplied; } });
Object.defineProperty(exports, "isSupportedDepletionUnit", { enumerable: true, get: function () { return types_1.isSupportedDepletionUnit; } });
Object.defineProperty(exports, "LOCAL_CIVIL_DATE_RE", { enumerable: true, get: function () { return types_1.LOCAL_CIVIL_DATE_RE; } });
Object.defineProperty(exports, "P0_OCCURRENCE_STATUSES", { enumerable: true, get: function () { return types_1.P0_OCCURRENCE_STATUSES; } });
Object.defineProperty(exports, "SUPPORTED_DEPLETION_UNITS", { enumerable: true, get: function () { return types_1.SUPPORTED_DEPLETION_UNITS; } });
var identity_1 = require("./identity");
Object.defineProperty(exports, "countIdentityMatches", { enumerable: true, get: function () { return identity_1.countIdentityMatches; } });
Object.defineProperty(exports, "deterministicOccurrenceId", { enumerable: true, get: function () { return identity_1.deterministicOccurrenceId; } });
Object.defineProperty(exports, "findDuplicateIdentity", { enumerable: true, get: function () { return identity_1.findDuplicateIdentity; } });
Object.defineProperty(exports, "lookupOccurrence", { enumerable: true, get: function () { return identity_1.lookupOccurrence; } });
Object.defineProperty(exports, "materializeOccurrence", { enumerable: true, get: function () { return identity_1.materializeOccurrence; } });
Object.defineProperty(exports, "normalizeIanaTimeZone", { enumerable: true, get: function () { return identity_1.normalizeIanaTimeZone; } });
Object.defineProperty(exports, "normalizeIsoInstant", { enumerable: true, get: function () { return identity_1.normalizeIsoInstant; } });
Object.defineProperty(exports, "normalizeLocalCivilDate", { enumerable: true, get: function () { return identity_1.normalizeLocalCivilDate; } });
Object.defineProperty(exports, "normalizeScheduleId", { enumerable: true, get: function () { return identity_1.normalizeScheduleId; } });
Object.defineProperty(exports, "occurrenceIdentityKey", { enumerable: true, get: function () { return identity_1.occurrenceIdentityKey; } });
Object.defineProperty(exports, "replaceOccurrence", { enumerable: true, get: function () { return identity_1.replaceOccurrence; } });
var legacy_1 = require("./legacy");
Object.defineProperty(exports, "explicitLegacyTakenDates", { enumerable: true, get: function () { return legacy_1.explicitLegacyTakenDates; } });
Object.defineProperty(exports, "materializeLegacyTakenDates", { enumerable: true, get: function () { return legacy_1.materializeLegacyTakenDates; } });
var writer_1 = require("./writer");
Object.defineProperty(exports, "assertExactDepletionUnits", { enumerable: true, get: function () { return writer_1.assertExactDepletionUnits; } });
Object.defineProperty(exports, "markTaken", { enumerable: true, get: function () { return writer_1.markTaken; } });
Object.defineProperty(exports, "reloadSnapshot", { enumerable: true, get: function () { return writer_1.reloadSnapshot; } });
Object.defineProperty(exports, "undoTaken", { enumerable: true, get: function () { return writer_1.undoTaken; } });

  })(
    modules["occ/index"].exports,
    createRequire(modules["occ/index"].dirname),
    modules["occ/index"],
    "occ"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.explicitLegacyTakenDates = explicitLegacyTakenDates;
exports.materializeLegacyTakenDates = materializeLegacyTakenDates;
const identity_1 = require("./identity");
const types_1 = require("./types");
function explicitLegacyTakenDates(takenDates) {
    if (!Array.isArray(takenDates)) {
        return [];
    }
    const seen = new Set();
    const dates = [];
    for (const value of takenDates) {
        const date = (0, identity_1.normalizeLocalCivilDate)(value);
        if (!date || seen.has(date)) {
            continue;
        }
        seen.add(date);
        dates.push(date);
    }
    return dates;
}
function materializeLegacyTakenDates(records, schedule, nowIso) {
    const sourceTakenDates = schedule.takenDates;
    const unchanged = (0, types_1.cloneOccurrences)(records);
    const dates = explicitLegacyTakenDates(sourceTakenDates);
    let next = (0, types_1.cloneOccurrences)(records);
    const materializedDates = [];
    for (const localCivilDate of dates) {
        const result = (0, identity_1.materializeOccurrence)(next, {
            scheduleId: schedule.id,
            localCivilDate,
            timeZone: schedule.timeZone,
            nowIso,
        });
        if (!result.ok) {
            return {
                ok: false,
                records: unchanged,
                sourceTakenDates,
                materializedDates: [],
                code: result.code,
            };
        }
        next = result.records;
        if (result.created) {
            next = (0, identity_1.replaceOccurrence)(next, {
                ...result.record,
                status: "taken",
            });
        }
        materializedDates.push(localCivilDate);
    }
    return {
        ok: true,
        records: next,
        sourceTakenDates,
        materializedDates,
    };
}

  })(
    modules["occ/legacy"].exports,
    createRequire(modules["occ/legacy"].dirname),
    modules["occ/legacy"],
    "occ"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOCAL_CIVIL_DATE_RE = exports.P0_OCCURRENCE_STATUSES = exports.SUPPORTED_DEPLETION_UNITS = void 0;
exports.isSupportedDepletionUnit = isSupportedDepletionUnit;
exports.depletionApplied = depletionApplied;
exports.cloneSnapshot = cloneSnapshot;
exports.cloneOccurrence = cloneOccurrence;
exports.cloneOccurrences = cloneOccurrences;
exports.SUPPORTED_DEPLETION_UNITS = ["mg", "mcg", "IU"];
exports.P0_OCCURRENCE_STATUSES = ["pending", "taken"];
exports.LOCAL_CIVIL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isSupportedDepletionUnit(value) {
    return (typeof value === "string" &&
        exports.SUPPORTED_DEPLETION_UNITS.includes(value));
}
function depletionApplied(record) {
    return Number.isFinite(record.appliedDepletionAmount) && Number(record.appliedDepletionAmount) > 0;
}
function cloneSnapshot(snapshot) {
    return {
        occurrences: snapshot.occurrences.map((row) => ({ ...row })),
        fills: snapshot.fills.map((row) => ({ ...row })),
    };
}
function cloneOccurrence(record) {
    return { ...record };
}
function cloneOccurrences(records) {
    return records.map((row) => ({ ...row }));
}

  })(
    modules["occ/types"].exports,
    createRequire(modules["occ/types"].dirname),
    modules["occ/types"],
    "occ"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeScheduleId = normalizeScheduleId;
exports.normalizeLocalCivilDate = normalizeLocalCivilDate;
exports.normalizeIanaTimeZone = normalizeIanaTimeZone;
exports.normalizeIsoInstant = normalizeIsoInstant;
const types_1 = require("./types");
const ISO_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
function normalizeScheduleId(value) {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
function normalizeLocalCivilDate(value) {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    if (!types_1.LOCAL_CIVIL_DATE_RE.test(trimmed)) {
        return null;
    }
    const [yearText, monthText, dayText] = trimmed.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
        return null;
    }
    const utc = new Date(Date.UTC(year, month - 1, day));
    if (utc.getUTCFullYear() !== year ||
        utc.getUTCMonth() !== month - 1 ||
        utc.getUTCDate() !== day) {
        return null;
    }
    const roundTrip = `${String(utc.getUTCFullYear()).padStart(4, "0")}-${String(utc.getUTCMonth() + 1).padStart(2, "0")}-${String(utc.getUTCDate()).padStart(2, "0")}`;
    return roundTrip === trimmed ? trimmed : null;
}
function normalizeIanaTimeZone(value) {
    if (typeof value !== "string" || value.trim().length === 0) {
        return null;
    }
    const zone = value.trim();
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date("2026-09-08T15:00:00.000Z"));
        return zone;
    }
    catch {
        return null;
    }
}
function normalizeIsoInstant(value) {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    if (!ISO_INSTANT_RE.test(trimmed)) {
        return null;
    }
    const ms = Date.parse(trimmed);
    if (!Number.isFinite(ms)) {
        return null;
    }
    return trimmed;
}

  })(
    modules["occ/validate"].exports,
    createRequire(modules["occ/validate"].dirname),
    modules["occ/validate"],
    "occ"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertExactDepletionUnits = assertExactDepletionUnits;
exports.markTaken = markTaken;
exports.undoTaken = undoTaken;
exports.reloadSnapshot = reloadSnapshot;
const identity_1 = require("./identity");
const types_1 = require("./types");
const validate_1 = require("./validate");
function fail(snapshot, code, message) {
    return {
        ok: false,
        code,
        message,
        snapshot: (0, types_1.cloneSnapshot)(snapshot),
    };
}
function findFill(fills, fillId) {
    return fills.find((row) => row.id === fillId) ?? null;
}
function replaceFill(fills, next) {
    return fills.map((row) => (row.id === next.id ? { ...next } : { ...row }));
}
function rejectIfDuplicate(snapshot) {
    const duplicate = (0, identity_1.findDuplicateIdentity)(snapshot.occurrences);
    if (!duplicate) {
        return null;
    }
    return fail(snapshot, "DUPLICATE_IDENTITY", `duplicate occurrence identity (${duplicate.scheduleId}, ${duplicate.localCivilDate})`);
}
function assertExactDepletionUnits(snapshotUnit, fillDepletionUnit) {
    if (!(0, types_1.isSupportedDepletionUnit)(snapshotUnit) || !(0, types_1.isSupportedDepletionUnit)(fillDepletionUnit)) {
        return { ok: false, code: "UNSUPPORTED_UNIT" };
    }
    if (snapshotUnit !== fillDepletionUnit) {
        return { ok: false, code: "UNIT_MISMATCH" };
    }
    return { ok: true, unit: snapshotUnit };
}
function finishSuccess(before, candidate, occurrence, fill, persist, noop) {
    if (noop) {
        return {
            ok: true,
            noop: true,
            snapshot: (0, types_1.cloneSnapshot)(before),
            occurrence: { ...occurrence },
            fill: { ...fill },
        };
    }
    try {
        const serialized = JSON.stringify(candidate);
        persist(JSON.parse(serialized));
    }
    catch {
        return fail(before, "PERSIST_FAILED", "persistence failed; pre-operation state retained");
    }
    return {
        ok: true,
        noop: false,
        snapshot: (0, types_1.cloneSnapshot)(candidate),
        occurrence: { ...occurrence },
        fill: { ...fill },
    };
}
function markTaken(snapshot, input, persist) {
    const before = (0, types_1.cloneSnapshot)(snapshot);
    const duplicate = rejectIfDuplicate(before);
    if (duplicate) {
        return duplicate;
    }
    const materialized = (0, identity_1.materializeOccurrence)(before.occurrences, {
        scheduleId: input.scheduleId,
        localCivilDate: input.localCivilDate,
        timeZone: input.timeZone,
        nowIso: input.nowIso,
        createId: input.createId,
    });
    if (!materialized.ok) {
        return fail(before, materialized.code, materialized.message);
    }
    const fill = findFill(before.fills, input.fillId);
    if (!fill) {
        return fail(before, "NOT_FOUND", "fill not found");
    }
    if (materialized.record.status === "taken") {
        const bound = (materialized.record.appliedFillId
            ? findFill(before.fills, materialized.record.appliedFillId)
            : null) ?? fill;
        return finishSuccess(before, before, materialized.record, bound, persist, true);
    }
    if (!Number.isFinite(fill.desiredDose) || fill.desiredDose <= 0) {
        return fail(before, "INVALID_DOSE", "desiredDose must be a finite number > 0");
    }
    if (!Number.isFinite(fill.depletionRemaining)) {
        return fail(before, "INVALID_DOSE", "depletionRemaining must be a finite number");
    }
    const unitCheck = assertExactDepletionUnits(fill.unit, fill.depletionUnit);
    if (!unitCheck.ok) {
        return fail(before, unitCheck.code, unitCheck.code === "UNIT_MISMATCH"
            ? "occurrence snapshot unit and fill depletion unit do not match"
            : "unsupported depletion unit; no conversion is applied");
    }
    const taken = {
        ...materialized.record,
        status: "taken",
        takenAt: input.nowIso,
        appliedDepletionAmount: fill.desiredDose,
        appliedDepletionUnit: unitCheck.unit,
        appliedFillId: fill.id,
        updatedAt: input.nowIso,
    };
    const nextFill = {
        ...fill,
        depletionRemaining: Number(fill.depletionRemaining) - fill.desiredDose,
    };
    const candidate = {
        occurrences: (0, identity_1.replaceOccurrence)(materialized.records, taken),
        fills: replaceFill(before.fills, nextFill),
    };
    return finishSuccess(before, candidate, taken, nextFill, persist, false);
}
function undoTaken(snapshot, input, persist) {
    const before = (0, types_1.cloneSnapshot)(snapshot);
    const duplicate = rejectIfDuplicate(before);
    if (duplicate) {
        return duplicate;
    }
    if (!(0, validate_1.normalizeIsoInstant)(input.nowIso)) {
        return fail(before, "INVALID_INSTANT", "nowIso is not a valid ISO-8601 instant");
    }
    const existing = (0, identity_1.lookupOccurrence)(before.occurrences, input.scheduleId, input.localCivilDate);
    if (!existing) {
        return fail(before, "NOT_FOUND", "occurrence not found");
    }
    if (existing.status !== "taken") {
        const pendingFill = input.fillId ? findFill(before.fills, input.fillId) : null;
        if (!pendingFill) {
            return fail(before, "NOT_FOUND", "fill not found");
        }
        return finishSuccess(before, before, existing, pendingFill, persist, true);
    }
    const snapshotAmount = existing.appliedDepletionAmount;
    const snapshotUnit = existing.appliedDepletionUnit;
    const appliedFillId = existing.appliedFillId;
    if (!(0, types_1.depletionApplied)(existing) ||
        snapshotAmount === null ||
        snapshotUnit === null ||
        !appliedFillId) {
        return fail(before, "INVALID_SNAPSHOT", "taken occurrence has no restorable depletion snapshot");
    }
    if (input.fillId && input.fillId !== appliedFillId) {
        return fail(before, "FILL_MISMATCH", "Undo fillId does not match stored appliedFillId");
    }
    const fill = findFill(before.fills, appliedFillId);
    if (!fill) {
        return fail(before, "NOT_FOUND", "applied fill not found");
    }
    const unitCheck = assertExactDepletionUnits(snapshotUnit, fill.depletionUnit);
    if (!unitCheck.ok) {
        return fail(before, unitCheck.code, unitCheck.code === "UNIT_MISMATCH"
            ? "stored snapshot unit and fill depletion unit do not match"
            : "unsupported depletion unit; no conversion is applied");
    }
    if (!Number.isFinite(fill.depletionRemaining)) {
        return fail(before, "INVALID_DOSE", "depletionRemaining must be a finite number");
    }
    const pending = {
        ...existing,
        status: "pending",
        takenAt: null,
        appliedDepletionAmount: null,
        appliedDepletionUnit: null,
        appliedFillId: null,
        updatedAt: input.nowIso,
    };
    const nextFill = {
        ...fill,
        depletionRemaining: Number(fill.depletionRemaining) + snapshotAmount,
    };
    const candidate = {
        occurrences: (0, identity_1.replaceOccurrence)(before.occurrences, pending),
        fills: replaceFill(before.fills, nextFill),
    };
    return finishSuccess(before, candidate, pending, nextFill, persist, false);
}
function reloadSnapshot(snapshot) {
    return JSON.parse(JSON.stringify(snapshot));
}

  })(
    modules["occ/writer"].exports,
    createRequire(modules["occ/writer"].dirname),
    modules["occ/writer"],
    "occ"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectGeneration = detectGeneration;
exports.classifyBackup = classifyBackup;
exports.schemaClassFromVersion = schemaClassFromVersion;
const copy_1 = require("./copy");
const fields_1 = require("./fields");
function readSchemaVersion(raw) {
    const record = (0, fields_1.asRecord)(raw);
    if (!record) {
        return null;
    }
    const version = record.schemaVersion;
    if (typeof version === "number" && Number.isInteger(version) && Number.isFinite(version) && version >= 1) {
        return version;
    }
    return null;
}
function detectGeneration(raw) {
    const record = (0, fields_1.asRecord)(raw);
    if (!record) {
        return "unknown";
    }
    const version = readSchemaVersion(record);
    const entities = (0, fields_1.asRecord)(record.entities);
    if (version === 3) {
        return "backup-v3";
    }
    const hasHistories = record.histories != null;
    const hasSchedules = Array.isArray(record.schedules);
    const hasOccurrences = Array.isArray(record.occurrences);
    const hasFills = Array.isArray(record.fills);
    const hasMedications = Array.isArray(record.medications);
    const hasEntities = Boolean(entities && (entities.fills || entities.schedules || entities.occurrences));
    if (hasHistories && !hasSchedules && !hasOccurrences && !hasEntities) {
        return "baseline-rebuild";
    }
    if (hasSchedules || hasOccurrences || hasFills || hasMedications || hasEntities) {
        return "github-main";
    }
    if (hasHistories) {
        return "baseline-rebuild";
    }
    return "unknown";
}
function classifyBackup(raw) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        return {
            class: "corrupt",
            generation: "unknown",
            schemaVersion: null,
            applyBlocked: true,
            applyBlockedReason: copy_1.IMPORT_BLOCKED_CORRUPT,
        };
    }
    const schemaVersion = readSchemaVersion(raw);
    const generation = detectGeneration(raw);
    if (schemaVersion === null) {
        return {
            class: "legacy-unversioned",
            generation,
            schemaVersion: null,
            applyBlocked: false,
            applyBlockedReason: null,
        };
    }
    if (schemaVersion === 3) {
        return {
            class: "current",
            generation: "backup-v3",
            schemaVersion: 3,
            applyBlocked: false,
            applyBlockedReason: null,
        };
    }
    if (schemaVersion === 1 || schemaVersion === 2) {
        return {
            class: "legacy-versioned",
            generation: generation === "unknown" ? "github-main" : generation,
            schemaVersion,
            applyBlocked: false,
            applyBlockedReason: null,
        };
    }
    if (schemaVersion >= 4) {
        return {
            class: "unknown-newer",
            generation: "unknown",
            schemaVersion,
            applyBlocked: true,
            applyBlockedReason: copy_1.IMPORT_BLOCKED_NEWER,
        };
    }
    return {
        class: "legacy-unversioned",
        generation,
        schemaVersion,
        applyBlocked: true,
        applyBlockedReason: copy_1.IMPORT_BLOCKED_CORRUPT,
    };
}
function schemaClassFromVersion(schemaVersion) {
    if (schemaVersion === null) {
        return "legacy-unversioned";
    }
    if (schemaVersion === 3) {
        return "current";
    }
    if (schemaVersion === 1 || schemaVersion === 2) {
        return "legacy-versioned";
    }
    if (schemaVersion >= 4) {
        return "unknown-newer";
    }
    return "legacy-unversioned";
}

  })(
    modules["persist/classify"].exports,
    createRequire(modules["persist/classify"].dirname),
    modules["persist/classify"],
    "persist"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASELINE_COEXIST_NOTE = exports.RESTORE_UNAVAILABLE = exports.RESTORE_CORRUPT = exports.RESTORE_EXPIRED = exports.IMPORT_APPLY_ERROR = exports.IMPORT_QUOTA_ERROR = exports.IMPORT_BLOCKED_EMPTY = exports.IMPORT_BLOCKED_CORRUPT = exports.IMPORT_BLOCKED_NEWER = exports.RESTORE_BUTTON_LABEL = exports.RESTORE_CANCEL = exports.RESTORE_PRIMARY = exports.RESTORE_TITLE = exports.IMPORT_CLOSE = exports.IMPORT_REPLACE_BACK = exports.IMPORT_REPLACE_PRIMARY = exports.IMPORT_REPLACE_TITLE = exports.IMPORT_REPLACE_LINK = exports.IMPORT_CANCEL = exports.IMPORT_SKIP_PRIMARY = exports.IMPORT_PREVIEW_TITLE = exports.EXPORT_CONFIRM_CANCEL = exports.EXPORT_CONFIRM_PRIMARY = exports.EXPORT_CONFIRM_TITLE = exports.EXPORT_PLAINTEXT_WARNING = void 0;
exports.importClassLabel = importClassLabel;
exports.EXPORT_PLAINTEXT_WARNING = "This JSON file is plaintext. It can include peptide names, amounts, and schedules saved on this device. FitGen does not send this file over the network. Continue only if you chose a place you trust.";
exports.EXPORT_CONFIRM_TITLE = "Export plaintext backup?";
exports.EXPORT_CONFIRM_PRIMARY = "Export JSON";
exports.EXPORT_CONFIRM_CANCEL = "Cancel";
exports.IMPORT_PREVIEW_TITLE = "Import preview";
exports.IMPORT_SKIP_PRIMARY = "Import (keep existing)";
exports.IMPORT_CANCEL = "Cancel";
exports.IMPORT_REPLACE_LINK = "Replace all…";
exports.IMPORT_REPLACE_TITLE = "Replace all saved data?";
exports.IMPORT_REPLACE_PRIMARY = "Replace all";
exports.IMPORT_REPLACE_BACK = "Back";
exports.IMPORT_CLOSE = "Close";
exports.RESTORE_TITLE = "Restore previous backup?";
exports.RESTORE_PRIMARY = "Restore";
exports.RESTORE_CANCEL = "Cancel";
exports.RESTORE_BUTTON_LABEL = "Restore previous backup";
exports.IMPORT_BLOCKED_NEWER = "This file uses a newer backup format that this version cannot apply.";
exports.IMPORT_BLOCKED_CORRUPT = "This file could not be read as FitGen backup JSON.";
exports.IMPORT_BLOCKED_EMPTY = "No valid fills, schedules, or medications were found.";
exports.IMPORT_QUOTA_ERROR = "Could not save a recovery snapshot (storage is full). Nothing was imported.";
exports.IMPORT_APPLY_ERROR = "Import could not finish. Previous data was kept.";
exports.RESTORE_EXPIRED = "The recovery snapshot has expired. Restore is unavailable.";
exports.RESTORE_CORRUPT = "The recovery snapshot is unreadable. Nothing was changed.";
exports.RESTORE_UNAVAILABLE = "No recovery snapshot is available.";
exports.BASELINE_COEXIST_NOTE = "A rebuild envelope is also present on this device. Import will not change or delete it.";
function importClassLabel(schemaClass, generation) {
    switch (schemaClass) {
        case "legacy-unversioned":
            return generation === "baseline-rebuild"
                ? "Legacy unversioned (rebuild envelope) — mapped to backup schema 3"
                : "Legacy unversioned — mapped to backup schema 3";
        case "legacy-versioned":
            return "Legacy versioned — mapped to backup schema 3";
        case "current":
            return "Current backup schema 3";
        case "unknown-newer":
            return "Newer unsupported backup schema";
        case "corrupt":
            return "Unreadable backup file";
        default:
            return "Unknown backup class";
    }
}

  })(
    modules["persist/copy"].exports,
    createRequire(modules["persist/copy"].dirname),
    modules["persist/copy"],
    "persist"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildExportDocument = buildExportDocument;
exports.exportDocumentJson = exportDocumentJson;
const keys_1 = require("./keys");
const fields_1 = require("./fields");
const map_github_1 = require("./map-github");
const adapter_1 = require("../ux/adapter");
function buildExportDocument(state, exportedAt, settings) {
    const resolved = {
        timeZone: (0, adapter_1.resolveTimeZone)(settings?.timeZone),
        theme: settings?.theme ?? null,
        updatedAt: settings?.updatedAt || exportedAt,
    };
    const fills = (0, fields_1.cloneJson)(state.fills);
    const schedules = (0, fields_1.cloneJson)(state.schedules);
    const occurrences = (0, fields_1.cloneJson)(state.occurrences);
    const medications = (0, fields_1.cloneJson)(state.medications);
    return {
        schemaVersion: keys_1.BACKUP_SCHEMA_V3,
        exportedAt,
        entities: {
            fills: fills.map(map_github_1.specFillFromGithub),
            schedules: schedules.map(map_github_1.specScheduleFromGithub),
            occurrences,
            medications,
            settings: resolved,
        },
        fills,
        schedules,
        occurrences,
        medications,
    };
}
function exportDocumentJson(state, exportedAt, settings) {
    return `${JSON.stringify(buildExportDocument(state, exportedAt, settings), null, 2)}\n`;
}

  })(
    modules["persist/export"].exports,
    createRequire(modules["persist/export"].dirname),
    modules["persist/export"],
    "persist"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asRecord = asRecord;
exports.cloneJson = cloneJson;
exports.readString = readString;
exports.firstString = firstString;
exports.readFiniteNumber = readFiniteNumber;
exports.firstFiniteNumber = firstFiniteNumber;
exports.firstPositiveNumber = firstPositiveNumber;
exports.isPositiveNumber = isPositiveNumber;
exports.pickUnknown = pickUnknown;
exports.mergePassthrough = mergePassthrough;
exports.uniqueStrings = uniqueStrings;
exports.escapeHtml = escapeHtml;
function asRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    return value;
}
function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}
function readString(value) {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
function firstString(...candidates) {
    for (const candidate of candidates) {
        const value = readString(candidate);
        if (value) {
            return value;
        }
    }
    return null;
}
function readFiniteNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
function firstFiniteNumber(...candidates) {
    for (const candidate of candidates) {
        const value = readFiniteNumber(candidate);
        if (value !== null) {
            return value;
        }
    }
    return null;
}
function firstPositiveNumber(...candidates) {
    const value = firstFiniteNumber(...candidates);
    return value !== null && value > 0 ? value : null;
}
function isPositiveNumber(value) {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
}
function pickUnknown(record, knownKeys) {
    const known = new Set(knownKeys);
    const extra = {};
    for (const [key, value] of Object.entries(record)) {
        if (!known.has(key)) {
            extra[key] = value;
        }
    }
    return extra;
}
function mergePassthrough(base, extra) {
    return { ...extra, ...base };
}
function uniqueStrings(values) {
    return [...new Set(values)];
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

  })(
    modules["persist/fields"].exports,
    createRequire(modules["persist/fields"].dirname),
    modules["persist/fields"],
    "persist"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.previewImportFromStorage = previewImportFromStorage;
exports.applyImport = applyImport;
exports.restoreFromSlot = restoreFromSlot;
const copy_1 = require("./copy");
const policy_1 = require("./policy");
const preview_1 = require("./preview");
const recovery_1 = require("./recovery");
const writer_1 = require("./writer");
function isoFromMs(nowMs) {
    return new Date(nowMs).toISOString();
}
function previewImportFromStorage(storage, text, timeZone, nowIso) {
    return (0, preview_1.previewImport)({
        text,
        current: (0, writer_1.readGithubState)(storage),
        baselineKeyPresent: (0, writer_1.readBaselineRaw)(storage) !== null,
        timeZone,
        nowIso,
    });
}
function applyImport(storage, preview, policy, nowMs, confirmReplaceAll = false) {
    const baselineBefore = (0, writer_1.readBaselineRaw)(storage);
    const unchanged = () => (0, writer_1.baselineKeyUnchanged)(storage, baselineBefore);
    if (preview.applyBlocked) {
        return {
            ok: false,
            noop: true,
            wrote: false,
            code: "APPLY_BLOCKED",
            message: preview.applyBlockedReason || copy_1.IMPORT_APPLY_ERROR,
            policy,
            baselineKeyUnchanged: unchanged(),
        };
    }
    if (policy === "replace-all" && !confirmReplaceAll) {
        return {
            ok: false,
            noop: true,
            wrote: false,
            code: "REPLACE_CONFIRM_REQUIRED",
            message: "Replace all requires a destructive confirm.",
            policy,
            baselineKeyUnchanged: unchanged(),
        };
    }
    const before = (0, writer_1.cloneGithubState)((0, writer_1.readGithubState)(storage));
    const next = (0, policy_1.applyDuplicatePolicy)(before, preview.incoming, policy);
    if ((0, policy_1.githubStateEqual)(before, next)) {
        return {
            ok: true,
            noop: true,
            wrote: false,
            policy,
            baselineKeyUnchanged: unchanged(),
        };
    }
    const snapshot = (0, recovery_1.buildRecoverySnapshot)(before, isoFromMs(nowMs));
    const slot = (0, recovery_1.writeRecoverySlot)(storage, snapshot);
    if (!slot.ok) {
        return {
            ok: false,
            noop: false,
            wrote: false,
            code: slot.code,
            message: slot.message || copy_1.IMPORT_QUOTA_ERROR,
            policy,
            baselineKeyUnchanged: unchanged(),
        };
    }
    try {
        (0, writer_1.commitGithubState)(storage, next);
    }
    catch {
        const rolled = (0, writer_1.tryRollbackGithubState)(storage, before);
        return {
            ok: false,
            noop: false,
            wrote: false,
            code: rolled.ok ? "APPLY_FAILED_ROLLED_BACK" : "APPLY_FAILED",
            message: copy_1.IMPORT_APPLY_ERROR,
            policy,
            baselineKeyUnchanged: unchanged(),
        };
    }
    return {
        ok: true,
        noop: false,
        wrote: true,
        policy,
        baselineKeyUnchanged: unchanged(),
    };
}
function restoreFromSlot(storage, nowMs) {
    const baselineBefore = (0, writer_1.readBaselineRaw)(storage);
    const inspect = (0, recovery_1.inspectRestore)(storage, nowMs);
    if (!("snapshot" in inspect) || inspect.ok !== true) {
        return inspect;
    }
    const state = (0, recovery_1.snapshotToGithubState)(inspect.snapshot);
    if (!state) {
        return {
            ok: false,
            wrote: false,
            code: "CORRUPT_SNAPSHOT",
            message: copy_1.RESTORE_CORRUPT,
            baselineKeyUnchanged: (0, writer_1.baselineKeyUnchanged)(storage, baselineBefore),
        };
    }
    try {
        (0, writer_1.commitGithubState)(storage, state);
    }
    catch {
        return {
            ok: false,
            wrote: false,
            code: "RESTORE_FAILED",
            message: copy_1.IMPORT_APPLY_ERROR,
            baselineKeyUnchanged: (0, writer_1.baselineKeyUnchanged)(storage, baselineBefore),
        };
    }
    return {
        ok: true,
        wrote: true,
        baselineKeyUnchanged: (0, writer_1.baselineKeyUnchanged)(storage, baselineBefore),
    };
}

  })(
    modules["persist/import"].exports,
    createRequire(modules["persist/import"].dirname),
    modules["persist/import"],
    "persist"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.githubStateEqual = exports.applyDuplicatePolicy = exports.previewBodyHtml = exports.previewImport = exports.parseBackupText = exports.mapGithubDocument = exports.BASELINE_SYNTHETIC_SCHEDULE_PREFIX = exports.mapBaselineDocument = exports.mapToV3 = exports.schemaClassFromVersion = exports.detectGeneration = exports.classifyBackup = exports.importClassLabel = exports.RESTORE_UNAVAILABLE = exports.RESTORE_TITLE = exports.RESTORE_PRIMARY = exports.RESTORE_EXPIRED = exports.RESTORE_CORRUPT = exports.RESTORE_CANCEL = exports.RESTORE_BUTTON_LABEL = exports.IMPORT_SKIP_PRIMARY = exports.IMPORT_REPLACE_TITLE = exports.IMPORT_REPLACE_PRIMARY = exports.IMPORT_REPLACE_LINK = exports.IMPORT_REPLACE_BACK = exports.IMPORT_QUOTA_ERROR = exports.IMPORT_PREVIEW_TITLE = exports.IMPORT_CLOSE = exports.IMPORT_CANCEL = exports.IMPORT_BLOCKED_NEWER = exports.IMPORT_BLOCKED_EMPTY = exports.IMPORT_BLOCKED_CORRUPT = exports.IMPORT_APPLY_ERROR = exports.EXPORT_PLAINTEXT_WARNING = exports.EXPORT_CONFIRM_TITLE = exports.EXPORT_CONFIRM_PRIMARY = exports.EXPORT_CONFIRM_CANCEL = exports.BASELINE_COEXIST_NOTE = exports.SCHEDULES_STORAGE_KEY = exports.RECOVERY_TTL_MS = exports.RECOVERY_SLOT_PENDING_KEY = exports.RECOVERY_SLOT_KEY = exports.PROTECTED_WRITE_KEYS = exports.PERSIST_WRITE_STEPS = exports.OCCURRENCES_STORAGE_KEY = exports.MEDICATIONS_STORAGE_KEY = exports.FILLS_STORAGE_KEY = exports.ENVELOPE_STORAGE_KEY = exports.BASELINE_ENVELOPE_KEY = exports.BACKUP_SCHEMA_V3 = void 0;
exports.writeRecoverySlot = exports.restoreAvailable = exports.readRecoverySlot = exports.isRecoveryExpired = exports.isQuotaError = exports.inspectRestore = exports.guardedSetItem = exports.guardedRemoveItem = exports.buildRecoverySnapshot = exports.readGithubState = exports.readBaselineRaw = exports.commitGithubState = exports.cloneGithubState = exports.baselineKeyUnchanged = exports.restoreFromSlot = exports.previewImportFromStorage = exports.applyImport = exports.exportDocumentJson = exports.buildExportDocument = void 0;
var keys_1 = require("./keys");
Object.defineProperty(exports, "BACKUP_SCHEMA_V3", { enumerable: true, get: function () { return keys_1.BACKUP_SCHEMA_V3; } });
Object.defineProperty(exports, "BASELINE_ENVELOPE_KEY", { enumerable: true, get: function () { return keys_1.BASELINE_ENVELOPE_KEY; } });
Object.defineProperty(exports, "ENVELOPE_STORAGE_KEY", { enumerable: true, get: function () { return keys_1.ENVELOPE_STORAGE_KEY; } });
Object.defineProperty(exports, "FILLS_STORAGE_KEY", { enumerable: true, get: function () { return keys_1.FILLS_STORAGE_KEY; } });
Object.defineProperty(exports, "MEDICATIONS_STORAGE_KEY", { enumerable: true, get: function () { return keys_1.MEDICATIONS_STORAGE_KEY; } });
Object.defineProperty(exports, "OCCURRENCES_STORAGE_KEY", { enumerable: true, get: function () { return keys_1.OCCURRENCES_STORAGE_KEY; } });
Object.defineProperty(exports, "PERSIST_WRITE_STEPS", { enumerable: true, get: function () { return keys_1.PERSIST_WRITE_STEPS; } });
Object.defineProperty(exports, "PROTECTED_WRITE_KEYS", { enumerable: true, get: function () { return keys_1.PROTECTED_WRITE_KEYS; } });
Object.defineProperty(exports, "RECOVERY_SLOT_KEY", { enumerable: true, get: function () { return keys_1.RECOVERY_SLOT_KEY; } });
Object.defineProperty(exports, "RECOVERY_SLOT_PENDING_KEY", { enumerable: true, get: function () { return keys_1.RECOVERY_SLOT_PENDING_KEY; } });
Object.defineProperty(exports, "RECOVERY_TTL_MS", { enumerable: true, get: function () { return keys_1.RECOVERY_TTL_MS; } });
Object.defineProperty(exports, "SCHEDULES_STORAGE_KEY", { enumerable: true, get: function () { return keys_1.SCHEDULES_STORAGE_KEY; } });
var copy_1 = require("./copy");
Object.defineProperty(exports, "BASELINE_COEXIST_NOTE", { enumerable: true, get: function () { return copy_1.BASELINE_COEXIST_NOTE; } });
Object.defineProperty(exports, "EXPORT_CONFIRM_CANCEL", { enumerable: true, get: function () { return copy_1.EXPORT_CONFIRM_CANCEL; } });
Object.defineProperty(exports, "EXPORT_CONFIRM_PRIMARY", { enumerable: true, get: function () { return copy_1.EXPORT_CONFIRM_PRIMARY; } });
Object.defineProperty(exports, "EXPORT_CONFIRM_TITLE", { enumerable: true, get: function () { return copy_1.EXPORT_CONFIRM_TITLE; } });
Object.defineProperty(exports, "EXPORT_PLAINTEXT_WARNING", { enumerable: true, get: function () { return copy_1.EXPORT_PLAINTEXT_WARNING; } });
Object.defineProperty(exports, "IMPORT_APPLY_ERROR", { enumerable: true, get: function () { return copy_1.IMPORT_APPLY_ERROR; } });
Object.defineProperty(exports, "IMPORT_BLOCKED_CORRUPT", { enumerable: true, get: function () { return copy_1.IMPORT_BLOCKED_CORRUPT; } });
Object.defineProperty(exports, "IMPORT_BLOCKED_EMPTY", { enumerable: true, get: function () { return copy_1.IMPORT_BLOCKED_EMPTY; } });
Object.defineProperty(exports, "IMPORT_BLOCKED_NEWER", { enumerable: true, get: function () { return copy_1.IMPORT_BLOCKED_NEWER; } });
Object.defineProperty(exports, "IMPORT_CANCEL", { enumerable: true, get: function () { return copy_1.IMPORT_CANCEL; } });
Object.defineProperty(exports, "IMPORT_CLOSE", { enumerable: true, get: function () { return copy_1.IMPORT_CLOSE; } });
Object.defineProperty(exports, "IMPORT_PREVIEW_TITLE", { enumerable: true, get: function () { return copy_1.IMPORT_PREVIEW_TITLE; } });
Object.defineProperty(exports, "IMPORT_QUOTA_ERROR", { enumerable: true, get: function () { return copy_1.IMPORT_QUOTA_ERROR; } });
Object.defineProperty(exports, "IMPORT_REPLACE_BACK", { enumerable: true, get: function () { return copy_1.IMPORT_REPLACE_BACK; } });
Object.defineProperty(exports, "IMPORT_REPLACE_LINK", { enumerable: true, get: function () { return copy_1.IMPORT_REPLACE_LINK; } });
Object.defineProperty(exports, "IMPORT_REPLACE_PRIMARY", { enumerable: true, get: function () { return copy_1.IMPORT_REPLACE_PRIMARY; } });
Object.defineProperty(exports, "IMPORT_REPLACE_TITLE", { enumerable: true, get: function () { return copy_1.IMPORT_REPLACE_TITLE; } });
Object.defineProperty(exports, "IMPORT_SKIP_PRIMARY", { enumerable: true, get: function () { return copy_1.IMPORT_SKIP_PRIMARY; } });
Object.defineProperty(exports, "RESTORE_BUTTON_LABEL", { enumerable: true, get: function () { return copy_1.RESTORE_BUTTON_LABEL; } });
Object.defineProperty(exports, "RESTORE_CANCEL", { enumerable: true, get: function () { return copy_1.RESTORE_CANCEL; } });
Object.defineProperty(exports, "RESTORE_CORRUPT", { enumerable: true, get: function () { return copy_1.RESTORE_CORRUPT; } });
Object.defineProperty(exports, "RESTORE_EXPIRED", { enumerable: true, get: function () { return copy_1.RESTORE_EXPIRED; } });
Object.defineProperty(exports, "RESTORE_PRIMARY", { enumerable: true, get: function () { return copy_1.RESTORE_PRIMARY; } });
Object.defineProperty(exports, "RESTORE_TITLE", { enumerable: true, get: function () { return copy_1.RESTORE_TITLE; } });
Object.defineProperty(exports, "RESTORE_UNAVAILABLE", { enumerable: true, get: function () { return copy_1.RESTORE_UNAVAILABLE; } });
Object.defineProperty(exports, "importClassLabel", { enumerable: true, get: function () { return copy_1.importClassLabel; } });
var classify_1 = require("./classify");
Object.defineProperty(exports, "classifyBackup", { enumerable: true, get: function () { return classify_1.classifyBackup; } });
Object.defineProperty(exports, "detectGeneration", { enumerable: true, get: function () { return classify_1.detectGeneration; } });
Object.defineProperty(exports, "schemaClassFromVersion", { enumerable: true, get: function () { return classify_1.schemaClassFromVersion; } });
var map_1 = require("./map");
Object.defineProperty(exports, "mapToV3", { enumerable: true, get: function () { return map_1.mapToV3; } });
var map_baseline_1 = require("./map-baseline");
Object.defineProperty(exports, "mapBaselineDocument", { enumerable: true, get: function () { return map_baseline_1.mapBaselineDocument; } });
Object.defineProperty(exports, "BASELINE_SYNTHETIC_SCHEDULE_PREFIX", { enumerable: true, get: function () { return map_baseline_1.BASELINE_SYNTHETIC_SCHEDULE_PREFIX; } });
var map_github_1 = require("./map-github");
Object.defineProperty(exports, "mapGithubDocument", { enumerable: true, get: function () { return map_github_1.mapGithubDocument; } });
var preview_1 = require("./preview");
Object.defineProperty(exports, "parseBackupText", { enumerable: true, get: function () { return preview_1.parseBackupText; } });
Object.defineProperty(exports, "previewImport", { enumerable: true, get: function () { return preview_1.previewImport; } });
Object.defineProperty(exports, "previewBodyHtml", { enumerable: true, get: function () { return preview_1.previewBodyHtml; } });
var policy_1 = require("./policy");
Object.defineProperty(exports, "applyDuplicatePolicy", { enumerable: true, get: function () { return policy_1.applyDuplicatePolicy; } });
Object.defineProperty(exports, "githubStateEqual", { enumerable: true, get: function () { return policy_1.githubStateEqual; } });
var export_1 = require("./export");
Object.defineProperty(exports, "buildExportDocument", { enumerable: true, get: function () { return export_1.buildExportDocument; } });
Object.defineProperty(exports, "exportDocumentJson", { enumerable: true, get: function () { return export_1.exportDocumentJson; } });
var import_1 = require("./import");
Object.defineProperty(exports, "applyImport", { enumerable: true, get: function () { return import_1.applyImport; } });
Object.defineProperty(exports, "previewImportFromStorage", { enumerable: true, get: function () { return import_1.previewImportFromStorage; } });
Object.defineProperty(exports, "restoreFromSlot", { enumerable: true, get: function () { return import_1.restoreFromSlot; } });
var writer_1 = require("./writer");
Object.defineProperty(exports, "baselineKeyUnchanged", { enumerable: true, get: function () { return writer_1.baselineKeyUnchanged; } });
Object.defineProperty(exports, "cloneGithubState", { enumerable: true, get: function () { return writer_1.cloneGithubState; } });
Object.defineProperty(exports, "commitGithubState", { enumerable: true, get: function () { return writer_1.commitGithubState; } });
Object.defineProperty(exports, "readBaselineRaw", { enumerable: true, get: function () { return writer_1.readBaselineRaw; } });
Object.defineProperty(exports, "readGithubState", { enumerable: true, get: function () { return writer_1.readGithubState; } });
var recovery_1 = require("./recovery");
Object.defineProperty(exports, "buildRecoverySnapshot", { enumerable: true, get: function () { return recovery_1.buildRecoverySnapshot; } });
Object.defineProperty(exports, "guardedRemoveItem", { enumerable: true, get: function () { return recovery_1.guardedRemoveItem; } });
Object.defineProperty(exports, "guardedSetItem", { enumerable: true, get: function () { return recovery_1.guardedSetItem; } });
Object.defineProperty(exports, "inspectRestore", { enumerable: true, get: function () { return recovery_1.inspectRestore; } });
Object.defineProperty(exports, "isQuotaError", { enumerable: true, get: function () { return recovery_1.isQuotaError; } });
Object.defineProperty(exports, "isRecoveryExpired", { enumerable: true, get: function () { return recovery_1.isRecoveryExpired; } });
Object.defineProperty(exports, "readRecoverySlot", { enumerable: true, get: function () { return recovery_1.readRecoverySlot; } });
Object.defineProperty(exports, "restoreAvailable", { enumerable: true, get: function () { return recovery_1.restoreAvailable; } });
Object.defineProperty(exports, "writeRecoverySlot", { enumerable: true, get: function () { return recovery_1.writeRecoverySlot; } });

  })(
    modules["persist/index"].exports,
    createRequire(modules["persist/index"].dirname),
    modules["persist/index"],
    "persist"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROTECTED_WRITE_KEYS = exports.BACKUP_SCHEMA_V3 = exports.RECOVERY_TTL_MS = exports.RECOVERY_SLOT_PENDING_KEY = exports.RECOVERY_SLOT_KEY = exports.MEDICATIONS_STORAGE_KEY = exports.BASELINE_ENVELOPE_KEY = exports.SCHEDULES_STORAGE_KEY = exports.PERSIST_WRITE_STEPS = exports.OCCURRENCES_STORAGE_KEY = exports.FILLS_STORAGE_KEY = exports.ENVELOPE_STORAGE_KEY = void 0;
var persist_1 = require("../ux/persist");
Object.defineProperty(exports, "ENVELOPE_STORAGE_KEY", { enumerable: true, get: function () { return persist_1.ENVELOPE_STORAGE_KEY; } });
Object.defineProperty(exports, "FILLS_STORAGE_KEY", { enumerable: true, get: function () { return persist_1.FILLS_STORAGE_KEY; } });
Object.defineProperty(exports, "OCCURRENCES_STORAGE_KEY", { enumerable: true, get: function () { return persist_1.OCCURRENCES_STORAGE_KEY; } });
Object.defineProperty(exports, "PERSIST_WRITE_STEPS", { enumerable: true, get: function () { return persist_1.PERSIST_WRITE_STEPS; } });
Object.defineProperty(exports, "SCHEDULES_STORAGE_KEY", { enumerable: true, get: function () { return persist_1.SCHEDULES_STORAGE_KEY; } });
exports.BASELINE_ENVELOPE_KEY = "fitgen-peptide-rebuild-v1";
exports.MEDICATIONS_STORAGE_KEY = "peptide-calculator-v2-medications";
exports.RECOVERY_SLOT_KEY = "peptide-calculator-v2-recovery-slot";
exports.RECOVERY_SLOT_PENDING_KEY = "peptide-calculator-v2-recovery-slot-pending";
exports.RECOVERY_TTL_MS = 168 * 60 * 60 * 1000;
exports.BACKUP_SCHEMA_V3 = 3;
exports.PROTECTED_WRITE_KEYS = [exports.BASELINE_ENVELOPE_KEY];

  })(
    modules["persist/keys"].exports,
    createRequire(modules["persist/keys"].dirname),
    modules["persist/keys"],
    "persist"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASELINE_SYNTHETIC_SCHEDULE_PREFIX = void 0;
exports.mapBaselineDocument = mapBaselineDocument;
const types_1 = require("../occ/types");
const validate_1 = require("../occ/validate");
const adapter_1 = require("../ux/adapter");
const fields_1 = require("./fields");
const map_github_1 = require("./map-github");
exports.BASELINE_SYNTHETIC_SCHEDULE_PREFIX = "baseline-sched:";
function emptyState() {
    return { fills: [], schedules: [], occurrences: [], medications: [] };
}
function historyStatus(record) {
    const status = (0, fields_1.firstString)(record.status, record.state);
    if (status === "missed" || record.missed === true) {
        return "missed";
    }
    if (status === "taken" || record.taken === true) {
        return "taken";
    }
    if (record.taken === false && status !== "taken") {
        return "missed";
    }
    return "unknown";
}
function historyFromUnknown(value, fallbackFillId, quarantine) {
    const record = (0, fields_1.asRecord)(value);
    if (!record) {
        quarantine.push({ entity: "history", id: null, reason: "not-object", payload: value });
        return null;
    }
    const fillSavedId = (0, fields_1.firstString)(record.fillSavedId, record.fillId, record.savedId, fallbackFillId);
    const localCivilDate = (0, validate_1.normalizeLocalCivilDate)(record.localCivilDate) ||
        (0, validate_1.normalizeLocalCivilDate)(record.date) ||
        (0, validate_1.normalizeLocalCivilDate)(record.takenDate) ||
        (0, validate_1.normalizeLocalCivilDate)(record.day);
    if (!fillSavedId || !localCivilDate) {
        quarantine.push({
            entity: "history",
            id: fillSavedId,
            reason: "missing-fill-or-date",
            payload: record,
        });
        return null;
    }
    return {
        fillSavedId,
        localCivilDate,
        status: historyStatus(record),
        raw: record,
    };
}
function collectHistories(raw, fills, quarantine) {
    const record = (0, fields_1.asRecord)(raw);
    const collected = [];
    const top = record?.histories;
    function pushAll(values, fallbackFillId) {
        for (const row of values) {
            const mapped = historyFromUnknown(row, fallbackFillId, quarantine);
            if (mapped) {
                collected.push(mapped);
            }
        }
    }
    if (Array.isArray(top)) {
        pushAll(top, null);
    }
    else if ((0, fields_1.asRecord)(top)) {
        for (const [fillId, rows] of Object.entries((0, fields_1.asRecord)(top) || {})) {
            if (Array.isArray(rows)) {
                pushAll(rows, fillId);
            }
            else if (rows != null) {
                const mapped = historyFromUnknown(rows, fillId, quarantine);
                if (mapped) {
                    collected.push(mapped);
                }
            }
        }
    }
    for (const fill of fills) {
        const nested = fill.histories;
        if (Array.isArray(nested)) {
            pushAll(nested, fill.savedId);
        }
    }
    return collected;
}
function civilFromIso(value) {
    const text = (0, fields_1.firstString)(value);
    if (!text) {
        return null;
    }
    const day = text.slice(0, 10);
    return types_1.LOCAL_CIVIL_DATE_RE.test(day) ? day : null;
}
function syntheticSchedule(fill, takenDates, timeZone) {
    const vialAmount = Number(fill.vialAmount);
    const waterMl = Number(fill.waterMl);
    const doseAmount = Number(fill.recommendedDoseAmount);
    if (!(vialAmount > 0 && waterMl > 0 && doseAmount > 0)) {
        return null;
    }
    const concentration = vialAmount / waterMl;
    const doseMl = doseAmount / concentration;
    if (!(doseMl >= 0.05)) {
        return null;
    }
    const intervalRaw = (0, fields_1.readFiniteNumber)(fill.intervalDays);
    const intervalDays = intervalRaw !== null && Number.isInteger(intervalRaw) && intervalRaw >= 1 ? intervalRaw : 1;
    const startDate = [...takenDates].sort()[0] ||
        civilFromIso(fill.savedAt) ||
        civilFromIso(fill.createdAt) ||
        "2026-01-01";
    return {
        id: `${exports.BASELINE_SYNTHETIC_SCHEDULE_PREFIX}${fill.savedId}`,
        fillSavedId: fill.savedId,
        doseAmount,
        doseMl,
        unitLabel: String(fill.unitLabel || "mg"),
        intervalDays,
        reminderTime: "09:00",
        startDate,
        fillSnapshot: fill,
        takenDates,
        lifecycle: fill.lifecycle === "archived" ? "archived" : "active",
        timeZone,
    };
}
function mapBaselineDocument(raw, timeZone, nowIso = "2026-09-09T00:00:00.000Z") {
    const record = (0, fields_1.asRecord)(raw);
    const quarantine = [];
    const notes = [
        "baseline-rebuild-mapped-to-BACKUP_SCHEMA_V3",
        "synthetic-schedule-id-prefix:" + exports.BASELINE_SYNTHETIC_SCHEDULE_PREFIX,
        "missed-histories-quarantined-not-applied",
    ];
    if (!record) {
        return {
            ok: false,
            generation: "baseline-rebuild",
            state: emptyState(),
            settings: { timeZone: (0, adapter_1.resolveTimeZone)(timeZone), theme: null, updatedAt: nowIso },
            quarantine: [{ entity: "document", id: null, reason: "not-object", payload: raw }],
            historyCount: 0,
            notes,
        };
    }
    const fills = [];
    const fillSource = Array.isArray(record.fills) ? record.fills : [];
    for (const row of fillSource) {
        const mapped = (0, map_github_1.githubFillFromUnknown)(row, quarantine);
        if (mapped) {
            fills.push(mapped);
        }
    }
    const histories = collectHistories(record, fills, quarantine);
    const takenByFill = new Map();
    for (const history of histories) {
        if (history.status === "missed") {
            quarantine.push({
                entity: "history",
                id: `${history.fillSavedId}:${history.localCivilDate}`,
                reason: "missed-status-unmapped",
                payload: history.raw,
            });
            continue;
        }
        if (history.status !== "taken") {
            quarantine.push({
                entity: "history",
                id: `${history.fillSavedId}:${history.localCivilDate}`,
                reason: "unknown-history-status",
                payload: history.raw,
            });
            continue;
        }
        const list = takenByFill.get(history.fillSavedId) || [];
        if (!list.includes(history.localCivilDate)) {
            list.push(history.localCivilDate);
        }
        takenByFill.set(history.fillSavedId, list);
    }
    const zone = (0, adapter_1.resolveTimeZone)(timeZone);
    const schedules = [];
    const occurrences = [];
    for (const fill of fills) {
        const takenDates = takenByFill.get(fill.savedId) || [];
        const schedule = syntheticSchedule(fill, takenDates, zone);
        if (!schedule) {
            quarantine.push({
                entity: "schedule",
                id: `${exports.BASELINE_SYNTHETIC_SCHEDULE_PREFIX}${fill.savedId}`,
                reason: "could-not-synthesize-schedule",
                payload: fill,
            });
            continue;
        }
        schedules.push(schedule);
        for (const date of takenDates) {
            occurrences.push({
                id: `occ:${schedule.id}:${date}`,
                scheduleId: schedule.id,
                localCivilDate: date,
                timeZone: zone,
                status: "taken",
                takenAt: `${date}T00:00:00.000Z`,
                appliedDepletionAmount: null,
                appliedDepletionUnit: null,
                appliedFillId: null,
                updatedAt: `${date}T00:00:00.000Z`,
            });
        }
    }
    if (record.activeView != null) {
        quarantine.push({
            entity: "settings",
            id: "activeView",
            field: "activeView",
            reason: "passthrough-ui-state",
            payload: record.activeView,
        });
    }
    if (record.lastReminderDigestDate != null) {
        quarantine.push({
            entity: "settings",
            id: "lastReminderDigestDate",
            field: "lastReminderDigestDate",
            reason: "passthrough-reminder-digest-not-applied",
            payload: record.lastReminderDigestDate,
        });
    }
    return {
        ok: fills.length > 0,
        generation: "baseline-rebuild",
        state: { fills, schedules, occurrences, medications: [] },
        settings: { timeZone: zone, theme: null, updatedAt: nowIso },
        quarantine,
        historyCount: histories.length,
        notes,
    };
}

  })(
    modules["persist/map-baseline"].exports,
    createRequire(modules["persist/map-baseline"].dirname),
    modules["persist/map-baseline"],
    "persist"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GITHUB_SCHEDULE_KEYS = exports.GITHUB_FILL_KEYS = void 0;
exports.githubFillFromUnknown = githubFillFromUnknown;
exports.githubScheduleFromUnknown = githubScheduleFromUnknown;
exports.githubMedicationFromUnknown = githubMedicationFromUnknown;
exports.occurrenceFromUnknown = occurrenceFromUnknown;
exports.specFillFromGithub = specFillFromGithub;
exports.specScheduleFromGithub = specScheduleFromGithub;
exports.mapGithubDocument = mapGithubDocument;
exports.mapSpecEntities = mapSpecEntities;
const types_1 = require("../occ/types");
const legacy_1 = require("../occ/legacy");
const validate_1 = require("../occ/validate");
const adapter_1 = require("../ux/adapter");
const fields_1 = require("./fields");
exports.GITHUB_FILL_KEYS = [
    "savedId",
    "name",
    "fillName",
    "label",
    "peptideName",
    "vialAmount",
    "vialMg",
    "waterMl",
    "unitLabel",
    "concentrationPerMl",
    "syringeMax",
    "maxWaterMl",
    "recommendedDoseAmount",
    "doseAmount",
    "doseMg",
    "savedAt",
    "lifecycle",
    "depletionRemaining",
    "depletionUnit",
];
exports.GITHUB_SCHEDULE_KEYS = [
    "id",
    "fillSavedId",
    "fillId",
    "doseAmount",
    "doseMl",
    "unitLabel",
    "intervalDays",
    "reminderTime",
    "startDate",
    "createdAt",
    "lastTriggeredAt",
    "fillSnapshot",
    "fill",
    "takenDates",
    "lifecycle",
    "timeZone",
    "timezone",
];
const MIN_DRAW_ML = 0.05;
function emptyState() {
    return { fills: [], schedules: [], occurrences: [], medications: [] };
}
function defaultSettings(nowIso, timeZone) {
    return {
        timeZone: (0, adapter_1.resolveTimeZone)(timeZone),
        theme: null,
        updatedAt: nowIso,
    };
}
function concentrationOf(vialAmount, waterMl) {
    if (!(vialAmount > 0 && waterMl > 0)) {
        return null;
    }
    return vialAmount / waterMl;
}
function githubFillFromUnknown(value, quarantine) {
    const record = (0, fields_1.asRecord)(value);
    if (!record) {
        quarantine.push({ entity: "fill", id: null, reason: "not-object", payload: value });
        return null;
    }
    const savedId = (0, fields_1.firstString)(record.savedId, record.id);
    const vialAmount = (0, fields_1.firstPositiveNumber)(record.vialAmount, record.vialMg);
    const waterMl = (0, fields_1.firstPositiveNumber)(record.waterMl);
    const extra = (0, fields_1.pickUnknown)(record, exports.GITHUB_FILL_KEYS);
    if (!savedId) {
        quarantine.push({ entity: "fill", id: null, reason: "missing-id", payload: record });
        return null;
    }
    if (vialAmount === null || waterMl === null) {
        quarantine.push({
            entity: "fill",
            id: savedId,
            reason: "invalid-vial-or-water",
            payload: record,
        });
        return null;
    }
    const unitLabel = (0, fields_1.firstString)(record.unitLabel, record.unit) || "mg";
    const recommendedDoseAmount = (0, fields_1.firstPositiveNumber)(record.recommendedDoseAmount, record.desiredDose, record.doseAmount, record.doseMg);
    if (recommendedDoseAmount === null) {
        quarantine.push({
            entity: "fill",
            id: savedId,
            field: "desiredDose",
            reason: "missing-positive-desired-dose",
            payload: record,
        });
    }
    const concentrationPerMl = concentrationOf(vialAmount, waterMl);
    const name = (0, fields_1.firstString)(record.name, record.displayName, record.fillName, record.label, record.peptideName) ||
        "Unnamed Peptide Fill";
    const fill = (0, fields_1.mergePassthrough)({
        savedId,
        name,
        vialAmount,
        waterMl,
        unitLabel,
        concentrationPerMl: concentrationPerMl ?? Number.NaN,
        syringeMax: (0, fields_1.firstPositiveNumber)(record.syringeMax, record.syringeCapacityMl),
        maxWaterMl: (0, fields_1.firstPositiveNumber)(record.maxWaterMl, record.bacWaterMl),
        recommendedDoseAmount: recommendedDoseAmount ?? 0,
        savedAt: (0, fields_1.firstString)(record.savedAt, record.createdAt) || undefined,
        lifecycle: record.lifecycle === "archived" ? "archived" : "active",
        depletionRemaining: (0, fields_1.readFiniteNumber)(record.depletionRemaining) !== null ? Number(record.depletionRemaining) : null,
        depletionUnit: (0, fields_1.firstString)(record.depletionUnit, record.unitLabel, record.unit) || unitLabel,
    }, extra);
    if (recommendedDoseAmount === null) {
        return null;
    }
    return fill;
}
function githubScheduleFromUnknown(value, fills, quarantine, fallbackTimeZone) {
    const record = (0, fields_1.asRecord)(value);
    if (!record) {
        quarantine.push({ entity: "schedule", id: null, reason: "not-object", payload: value });
        return null;
    }
    const extra = (0, fields_1.pickUnknown)(record, exports.GITHUB_SCHEDULE_KEYS);
    const id = (0, fields_1.firstString)(record.id);
    const fillSavedId = (0, fields_1.firstString)(record.fillSavedId, record.fillId);
    const snapshotRecord = (0, fields_1.asRecord)(record.fillSnapshot) || (0, fields_1.asRecord)(record.fill);
    const snapshot = snapshotRecord ? githubFillFromUnknown(snapshotRecord, []) : null;
    const linkedFill = fills.find((row) => row.savedId === fillSavedId) || snapshot;
    const doseAmount = (0, fields_1.firstPositiveNumber)(record.doseAmount, snapshot?.recommendedDoseAmount, linkedFill?.recommendedDoseAmount);
    const concentration = snapshot && isFiniteConcentration(snapshot.concentrationPerMl)
        ? Number(snapshot.concentrationPerMl)
        : linkedFill && isFiniteConcentration(linkedFill.concentrationPerMl)
            ? Number(linkedFill.concentrationPerMl)
            : null;
    const doseMl = (0, fields_1.firstPositiveNumber)(record.doseMl) ||
        (doseAmount !== null && concentration ? doseAmount / concentration : null);
    if (!id) {
        quarantine.push({ entity: "schedule", id: null, reason: "missing-id", payload: record });
        return null;
    }
    if (!fillSavedId && !snapshot) {
        quarantine.push({ entity: "schedule", id, reason: "missing-fill", payload: record });
        return null;
    }
    if (doseAmount === null || doseMl === null || doseMl < MIN_DRAW_ML) {
        quarantine.push({
            entity: "schedule",
            id,
            reason: "invalid-dose-or-draw",
            payload: record,
        });
        return null;
    }
    const intervalDays = firstFiniteNumberAsInt(record.intervalDays, record.recurrence);
    if (intervalDays === null || intervalDays < 1) {
        quarantine.push({
            entity: "schedule",
            id,
            reason: "invalid-interval-days",
            payload: record,
        });
        return null;
    }
    const startDate = (0, validate_1.normalizeLocalCivilDate)(record.startDate) ||
        (0, validate_1.normalizeLocalCivilDate)(record.startCivilDate) ||
        (0, fields_1.firstString)(record.startDate, record.startCivilDate);
    const reminderTime = (0, fields_1.firstString)(record.reminderTime, record.timeOfDay) || "09:00";
    if (!startDate || !reminderTime) {
        quarantine.push({ entity: "schedule", id, reason: "missing-start-or-time", payload: record });
        return null;
    }
    const timeZone = (0, validate_1.normalizeIanaTimeZone)((0, fields_1.firstString)(record.timeZone, record.timezone)) || fallbackTimeZone;
    return (0, fields_1.mergePassthrough)({
        id,
        fillSavedId: fillSavedId || snapshot?.savedId || null,
        doseAmount,
        doseMl,
        unitLabel: (0, fields_1.firstString)(record.unitLabel, snapshot?.unitLabel, linkedFill?.unitLabel) || "mg",
        intervalDays,
        reminderTime,
        startDate,
        createdAt: (0, fields_1.firstString)(record.createdAt),
        lastTriggeredAt: record.lastTriggeredAt ?? null,
        fillSnapshot: snapshot || linkedFill || null,
        takenDates: (0, legacy_1.explicitLegacyTakenDates)(record.takenDates),
        lifecycle: record.lifecycle === "archived" ? "archived" : "active",
        timeZone,
    }, extra);
}
function firstFiniteNumberAsInt(intervalDays, recurrence) {
    const direct = (0, fields_1.readFiniteNumber)(intervalDays);
    if (direct !== null && Number.isInteger(direct)) {
        return direct;
    }
    const rec = (0, fields_1.asRecord)(recurrence);
    const nested = rec ? (0, fields_1.readFiniteNumber)(rec.intervalDays) : null;
    if (nested !== null && Number.isInteger(nested)) {
        return nested;
    }
    return null;
}
function isFiniteConcentration(value) {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
}
function githubMedicationFromUnknown(value, quarantine) {
    const record = (0, fields_1.asRecord)(value);
    if (!record) {
        quarantine.push({ entity: "medication", id: null, reason: "not-object", payload: value });
        return null;
    }
    const id = (0, fields_1.firstString)(record.id);
    const name = (0, fields_1.firstString)(record.name);
    if (!id || !name) {
        quarantine.push({ entity: "medication", id, reason: "missing-id-or-name", payload: record });
        return null;
    }
    return { ...record, id, name };
}
function occurrenceFromUnknown(value, quarantine) {
    const record = (0, fields_1.asRecord)(value);
    if (!record) {
        quarantine.push({ entity: "occurrence", id: null, reason: "not-object", payload: value });
        return null;
    }
    const scheduleId = (0, fields_1.firstString)(record.scheduleId);
    const localCivilDate = (0, validate_1.normalizeLocalCivilDate)(record.localCivilDate);
    const timeZone = (0, validate_1.normalizeIanaTimeZone)(record.timeZone) || "UTC";
    if (!scheduleId || !localCivilDate) {
        quarantine.push({
            entity: "occurrence",
            id: (0, fields_1.firstString)(record.id),
            reason: "invalid-identity",
            payload: record,
        });
        return null;
    }
    const status = record.status === "taken" ? "taken" : "pending";
    const extra = (0, fields_1.pickUnknown)(record, [
        "id",
        "scheduleId",
        "localCivilDate",
        "timeZone",
        "status",
        "takenAt",
        "appliedDepletionAmount",
        "appliedDepletionUnit",
        "appliedFillId",
        "updatedAt",
    ]);
    return (0, fields_1.mergePassthrough)({
        id: (0, fields_1.firstString)(record.id) || `occ:${scheduleId}:${localCivilDate}`,
        scheduleId,
        localCivilDate,
        timeZone,
        status,
        takenAt: (0, fields_1.firstString)(record.takenAt),
        appliedDepletionAmount: (0, fields_1.readFiniteNumber)(record.appliedDepletionAmount),
        appliedDepletionUnit: record.appliedDepletionUnit === "mg" ||
            record.appliedDepletionUnit === "mcg" ||
            record.appliedDepletionUnit === "IU"
            ? record.appliedDepletionUnit
            : null,
        appliedFillId: (0, fields_1.firstString)(record.appliedFillId),
        updatedAt: (0, fields_1.firstString)(record.updatedAt) || `${localCivilDate}T00:00:00.000Z`,
    }, extra);
}
function specFillFromGithub(fill) {
    return (0, fields_1.mergePassthrough)({
        id: fill.savedId,
        displayName: String(fill.name || ""),
        vialAmount: Number(fill.vialAmount),
        desiredDose: Number(fill.recommendedDoseAmount),
        unit: String(fill.unitLabel || "mg"),
        waterMl: Number(fill.waterMl),
        concentration: Number(fill.concentrationPerMl),
        syringeCapacityMl: (0, fields_1.firstPositiveNumber)(fill.syringeMax, fill.syringeCapacityMl),
        lifecycle: String(fill.lifecycle || "active"),
        depletionRemaining: fill.depletionRemaining === undefined ? null : fill.depletionRemaining,
        createdAt: typeof fill.savedAt === "string" ? fill.savedAt : undefined,
        savedId: fill.savedId,
        name: fill.name,
        unitLabel: fill.unitLabel,
        recommendedDoseAmount: fill.recommendedDoseAmount,
    }, (0, fields_1.pickUnknown)(fill, ["savedId", "name", "vialAmount", "waterMl", "unitLabel", "recommendedDoseAmount"]));
}
function specScheduleFromGithub(schedule) {
    return {
        id: schedule.id,
        fillId: String(schedule.fillSavedId || ""),
        timeZone: typeof schedule.timeZone === "string" ? schedule.timeZone : undefined,
        startCivilDate: typeof schedule.startDate === "string" ? schedule.startDate : undefined,
        timeOfDay: typeof schedule.reminderTime === "string" ? schedule.reminderTime : undefined,
        recurrence: { intervalDays: Number(schedule.intervalDays) },
        lifecycle: typeof schedule.lifecycle === "string" ? schedule.lifecycle : undefined,
        takenDates: (0, legacy_1.explicitLegacyTakenDates)(schedule.takenDates),
        fillSavedId: schedule.fillSavedId,
        doseAmount: schedule.doseAmount,
        doseMl: schedule.doseMl,
        unitLabel: schedule.unitLabel,
        intervalDays: schedule.intervalDays,
        reminderTime: schedule.reminderTime,
        startDate: schedule.startDate,
    };
}
function collectArray(value) {
    return Array.isArray(value) ? value : [];
}
function mapGithubDocument(raw, timeZone, nowIso = "2026-09-09T00:00:00.000Z") {
    const record = (0, fields_1.asRecord)(raw);
    const quarantine = [];
    const notes = [];
    if (!record) {
        return {
            ok: false,
            generation: "github-main",
            state: emptyState(),
            settings: defaultSettings(nowIso, timeZone),
            quarantine: [{ entity: "document", id: null, reason: "not-object", payload: raw }],
            historyCount: 0,
            notes,
        };
    }
    const entities = (0, fields_1.asRecord)(record.entities);
    const fillSource = collectArray(entities?.fills).length ? collectArray(entities?.fills) : collectArray(record.fills);
    const scheduleSource = collectArray(entities?.schedules).length
        ? collectArray(entities?.schedules)
        : collectArray(record.schedules);
    const occurrenceSource = collectArray(entities?.occurrences).length
        ? collectArray(entities?.occurrences)
        : collectArray(record.occurrences);
    const medicationSource = collectArray(entities?.medications).length
        ? collectArray(entities?.medications)
        : collectArray(record.medications);
    const settingsSource = (0, fields_1.asRecord)(entities?.settings);
    const settings = defaultSettings(nowIso, (0, fields_1.firstString)(timeZone, settingsSource?.timeZone, record.timezone, record.timeZone) || undefined);
    const fills = [];
    for (const row of fillSource) {
        const mapped = githubFillFromUnknown(row, quarantine);
        if (mapped) {
            fills.push(mapped);
        }
    }
    const schedules = [];
    for (const row of scheduleSource) {
        const mapped = githubScheduleFromUnknown(row, fills, quarantine, settings.timeZone);
        if (mapped) {
            schedules.push(mapped);
        }
    }
    const occurrences = [];
    const seenOcc = new Set();
    for (const row of occurrenceSource) {
        const mapped = occurrenceFromUnknown(row, quarantine);
        if (!mapped) {
            continue;
        }
        const key = `${mapped.scheduleId}\u001f${mapped.localCivilDate}`;
        if (seenOcc.has(key)) {
            quarantine.push({
                entity: "occurrence",
                id: mapped.id,
                reason: "duplicate-identity",
                payload: row,
            });
            continue;
        }
        seenOcc.add(key);
        occurrences.push(mapped);
    }
    if (occurrences.length === 0) {
        for (const schedule of schedules) {
            for (const date of (0, legacy_1.explicitLegacyTakenDates)(schedule.takenDates)) {
                if (!types_1.LOCAL_CIVIL_DATE_RE.test(date)) {
                    continue;
                }
                const key = `${schedule.id}\u001f${date}`;
                if (seenOcc.has(key)) {
                    continue;
                }
                seenOcc.add(key);
                occurrences.push({
                    id: `occ:${schedule.id}:${date}`,
                    scheduleId: schedule.id,
                    localCivilDate: date,
                    timeZone: settings.timeZone,
                    status: "taken",
                    takenAt: `${date}T00:00:00.000Z`,
                    appliedDepletionAmount: null,
                    appliedDepletionUnit: null,
                    appliedFillId: null,
                    updatedAt: `${date}T00:00:00.000Z`,
                });
            }
        }
    }
    const medications = [];
    for (const row of medicationSource) {
        const mapped = githubMedicationFromUnknown(row, quarantine);
        if (mapped) {
            medications.push(mapped);
        }
    }
    notes.push("github-generation-mapped-to-BACKUP_SCHEMA_V3");
    return {
        ok: fills.length > 0 || schedules.length > 0 || medications.length > 0 || occurrences.length > 0,
        generation: "github-main",
        state: { fills, schedules, occurrences, medications },
        settings,
        quarantine,
        historyCount: 0,
        notes,
    };
}
function mapSpecEntities(raw, timeZone, nowIso) {
    return mapGithubDocument(raw, timeZone, nowIso);
}

  })(
    modules["persist/map-github"].exports,
    createRequire(modules["persist/map-github"].dirname),
    modules["persist/map-github"],
    "persist"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapToV3 = mapToV3;
const classify_1 = require("./classify");
const copy_1 = require("./copy");
const map_baseline_1 = require("./map-baseline");
const map_github_1 = require("./map-github");
function mapToV3(raw, timeZone, nowIso) {
    const classified = (0, classify_1.classifyBackup)(raw);
    if (classified.class === "corrupt") {
        return {
            ok: false,
            generation: "unknown",
            state: { fills: [], schedules: [], occurrences: [], medications: [] },
            settings: { timeZone: "UTC", theme: null, updatedAt: nowIso || "2026-09-09T00:00:00.000Z" },
            quarantine: [{ entity: "document", id: null, reason: copy_1.IMPORT_BLOCKED_CORRUPT, payload: raw }],
            historyCount: 0,
            notes: [],
        };
    }
    if (classified.class === "unknown-newer") {
        return {
            ok: false,
            generation: "unknown",
            state: { fills: [], schedules: [], occurrences: [], medications: [] },
            settings: { timeZone: "UTC", theme: null, updatedAt: nowIso || "2026-09-09T00:00:00.000Z" },
            quarantine: [{ entity: "document", id: null, reason: copy_1.IMPORT_BLOCKED_NEWER, payload: raw }],
            historyCount: 0,
            notes: ["unknown-newer-not-applied-as-v3"],
        };
    }
    const generation = classified.generation === "unknown" ? (0, classify_1.detectGeneration)(raw) : classified.generation;
    if (generation === "baseline-rebuild") {
        return (0, map_baseline_1.mapBaselineDocument)(raw, timeZone, nowIso);
    }
    const mapped = (0, map_github_1.mapGithubDocument)(raw, timeZone, nowIso);
    if (generation === "backup-v3") {
        return { ...mapped, generation: "backup-v3" };
    }
    return mapped;
}

  })(
    modules["persist/map"].exports,
    createRequire(modules["persist/map"].dirname),
    modules["persist/map"],
    "persist"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyDuplicatePolicy = applyDuplicatePolicy;
exports.githubStateEqual = githubStateEqual;
const identity_1 = require("../occ/identity");
const fields_1 = require("./fields");
function applyDuplicatePolicy(current, incoming, policy) {
    if (policy === "replace-all") {
        return (0, fields_1.cloneJson)(incoming);
    }
    const fillIds = new Set(current.fills.map((row) => row.savedId));
    const scheduleIds = new Set(current.schedules.map((row) => row.id));
    const occKeys = new Set(current.occurrences.map((row) => (0, identity_1.occurrenceIdentityKey)(row.scheduleId, row.localCivilDate)));
    const medIds = new Set(current.medications.map((row) => row.id));
    return {
        fills: [...(0, fields_1.cloneJson)(current.fills), ...incoming.fills.filter((row) => !fillIds.has(row.savedId))],
        schedules: [
            ...(0, fields_1.cloneJson)(current.schedules),
            ...incoming.schedules.filter((row) => !scheduleIds.has(row.id)),
        ],
        occurrences: [
            ...(0, fields_1.cloneJson)(current.occurrences),
            ...incoming.occurrences.filter((row) => !occKeys.has((0, identity_1.occurrenceIdentityKey)(row.scheduleId, row.localCivilDate))),
        ],
        medications: [
            ...(0, fields_1.cloneJson)(current.medications),
            ...incoming.medications.filter((row) => !medIds.has(row.id)),
        ],
    };
}
function githubStateEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}

  })(
    modules["persist/policy"].exports,
    createRequire(modules["persist/policy"].dirname),
    modules["persist/policy"],
    "persist"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBackupText = parseBackupText;
exports.previewImport = previewImport;
exports.previewBodyHtml = previewBodyHtml;
const identity_1 = require("../occ/identity");
const copy_1 = require("./copy");
const classify_1 = require("./classify");
const fields_1 = require("./fields");
const map_1 = require("./map");
function parseBackupText(text) {
    if (typeof text !== "string" || !text.trim()) {
        return { ok: false, error: copy_1.IMPORT_BLOCKED_CORRUPT };
    }
    try {
        const value = JSON.parse(text);
        if (value === null || typeof value !== "object" || Array.isArray(value)) {
            return { ok: false, error: copy_1.IMPORT_BLOCKED_CORRUPT };
        }
        return { ok: true, value };
    }
    catch {
        return { ok: false, error: copy_1.IMPORT_BLOCKED_CORRUPT };
    }
}
function emptyIncoming() {
    return { fills: [], schedules: [], occurrences: [], medications: [] };
}
function collisionsBetween(current, incoming) {
    const fillIds = new Set(current.fills.map((row) => row.savedId));
    const scheduleIds = new Set(current.schedules.map((row) => row.id));
    const occKeys = new Set(current.occurrences.map((row) => (0, identity_1.occurrenceIdentityKey)(row.scheduleId, row.localCivilDate)));
    const medIds = new Set(current.medications.map((row) => row.id));
    return {
        fills: incoming.fills.filter((row) => fillIds.has(row.savedId)).map((row) => row.savedId),
        schedules: incoming.schedules.filter((row) => scheduleIds.has(row.id)).map((row) => row.id),
        occurrences: incoming.occurrences
            .filter((row) => occKeys.has((0, identity_1.occurrenceIdentityKey)(row.scheduleId, row.localCivilDate)))
            .map((row) => (0, identity_1.occurrenceIdentityKey)(row.scheduleId, row.localCivilDate)),
        medications: incoming.medications.filter((row) => medIds.has(row.id)).map((row) => row.id),
    };
}
function blockedPreview(current, baselineKeyPresent, extra) {
    return {
        class: "corrupt",
        generation: "unknown",
        schemaVersion: null,
        mapped: false,
        applyBlocked: true,
        applyBlockedReason: copy_1.IMPORT_BLOCKED_CORRUPT,
        classLabel: (0, copy_1.importClassLabel)("corrupt", "unknown"),
        counts: {
            fills: 0,
            schedules: 0,
            occurrences: 0,
            medications: 0,
            histories: 0,
            quarantined: 0,
        },
        collisions: { fills: [], schedules: [], occurrences: [], medications: [] },
        quarantine: [],
        incoming: emptyIncoming(),
        baselineKeyPresent,
        baselineKeyWillMutate: false,
        replaceAllWouldRemove: {
            fills: current.fills.length,
            schedules: current.schedules.length,
            occurrences: current.occurrences.length,
            medications: current.medications.length,
        },
        warningLines: [],
        ...extra,
    };
}
function previewImport(input) {
    const baselineKeyPresent = Boolean(input.baselineKeyPresent);
    const parsed = parseBackupText(input.text);
    if (!parsed.ok) {
        return blockedPreview(input.current, baselineKeyPresent, {
            applyBlockedReason: parsed.error,
            quarantine: [{ entity: "document", id: null, reason: "corrupt-json" }],
            counts: {
                fills: 0,
                schedules: 0,
                occurrences: 0,
                medications: 0,
                histories: 0,
                quarantined: 1,
            },
        });
    }
    const classified = (0, classify_1.classifyBackup)(parsed.value);
    if (classified.class === "unknown-newer") {
        const record = (0, fields_1.asRecord)(parsed.value);
        const quarantine = [
            {
                entity: "document",
                id: null,
                reason: copy_1.IMPORT_BLOCKED_NEWER,
                payload: { schemaVersion: classified.schemaVersion, keys: record ? Object.keys(record) : [] },
            },
        ];
        return blockedPreview(input.current, baselineKeyPresent, {
            class: "unknown-newer",
            schemaVersion: classified.schemaVersion,
            applyBlockedReason: copy_1.IMPORT_BLOCKED_NEWER,
            classLabel: (0, copy_1.importClassLabel)("unknown-newer", "unknown"),
            quarantine,
            warningLines: [copy_1.IMPORT_BLOCKED_NEWER],
            counts: {
                fills: 0,
                schedules: 0,
                occurrences: 0,
                medications: 0,
                histories: 0,
                quarantined: quarantine.length,
            },
        });
    }
    const mapped = (0, map_1.mapToV3)(parsed.value, input.timeZone, input.nowIso);
    const incoming = mapped.state;
    const hasEntities = incoming.fills.length > 0 ||
        incoming.schedules.length > 0 ||
        incoming.medications.length > 0 ||
        incoming.occurrences.length > 0;
    const applyBlocked = classified.applyBlocked || !mapped.ok || !hasEntities;
    const applyBlockedReason = applyBlocked
        ? classified.applyBlockedReason || (!mapped.ok ? copy_1.IMPORT_BLOCKED_CORRUPT : copy_1.IMPORT_BLOCKED_EMPTY)
        : null;
    const warningLines = [];
    if (baselineKeyPresent) {
        warningLines.push(copy_1.BASELINE_COEXIST_NOTE);
    }
    if (applyBlockedReason) {
        warningLines.push(applyBlockedReason);
    }
    return {
        class: classified.class,
        generation: mapped.generation,
        schemaVersion: classified.schemaVersion,
        mapped: mapped.ok,
        applyBlocked,
        applyBlockedReason,
        classLabel: (0, copy_1.importClassLabel)(classified.class, mapped.generation),
        counts: {
            fills: incoming.fills.length,
            schedules: incoming.schedules.length,
            occurrences: incoming.occurrences.length,
            medications: incoming.medications.length,
            histories: mapped.historyCount,
            quarantined: mapped.quarantine.length,
        },
        collisions: collisionsBetween(input.current, incoming),
        quarantine: mapped.quarantine,
        incoming,
        baselineKeyPresent,
        baselineKeyWillMutate: false,
        replaceAllWouldRemove: {
            fills: input.current.fills.length,
            schedules: input.current.schedules.length,
            occurrences: input.current.occurrences.length,
            medications: input.current.medications.length,
        },
        warningLines,
    };
}
function previewBodyHtml(preview) {
    const collisionCount = preview.collisions.fills.length +
        preview.collisions.schedules.length +
        preview.collisions.occurrences.length +
        preview.collisions.medications.length;
    const parts = [
        `<p>${(0, fields_1.escapeHtml)(preview.classLabel)}</p>`,
        `<p>Fills ${preview.counts.fills} · schedules ${preview.counts.schedules} · occurrences ${preview.counts.occurrences} · medications ${preview.counts.medications}</p>`,
        `<p>ID collisions: ${collisionCount} (skip keeps existing). Quarantined fields: ${preview.counts.quarantined}.</p>`,
    ];
    if (preview.counts.histories > 0) {
        parts.push(`<p>Rebuild histories mapped: ${preview.counts.histories}.</p>`);
    }
    for (const line of preview.warningLines) {
        parts.push(`<p>${(0, fields_1.escapeHtml)(line)}</p>`);
    }
    if (!preview.applyBlocked) {
        parts.push(`<p><button type="button" class="secondary-button" id="fitgen-import-replace">${(0, fields_1.escapeHtml)(copy_1.IMPORT_REPLACE_LINK)}</button></p>`);
    }
    return parts.join("");
}

  })(
    modules["persist/preview"].exports,
    createRequire(modules["persist/preview"].dirname),
    modules["persist/preview"],
    "persist"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESTORE_UNAVAILABLE = exports.RESTORE_EXPIRED = exports.RESTORE_CORRUPT = void 0;
exports.isQuotaError = isQuotaError;
exports.guardedSetItem = guardedSetItem;
exports.guardedRemoveItem = guardedRemoveItem;
exports.recoveryExpiresAt = recoveryExpiresAt;
exports.isRecoveryExpired = isRecoveryExpired;
exports.readRecoverySlot = readRecoverySlot;
exports.restoreAvailable = restoreAvailable;
exports.buildRecoverySnapshot = buildRecoverySnapshot;
exports.writeRecoverySlot = writeRecoverySlot;
exports.snapshotToGithubState = snapshotToGithubState;
exports.restoreFailure = restoreFailure;
exports.inspectRestore = inspectRestore;
const copy_1 = require("./copy");
Object.defineProperty(exports, "RESTORE_CORRUPT", { enumerable: true, get: function () { return copy_1.RESTORE_CORRUPT; } });
Object.defineProperty(exports, "RESTORE_EXPIRED", { enumerable: true, get: function () { return copy_1.RESTORE_EXPIRED; } });
Object.defineProperty(exports, "RESTORE_UNAVAILABLE", { enumerable: true, get: function () { return copy_1.RESTORE_UNAVAILABLE; } });
const export_1 = require("./export");
const fields_1 = require("./fields");
const keys_1 = require("./keys");
const map_1 = require("./map");
function isQuotaError(error) {
    if (!error || typeof error !== "object") {
        return false;
    }
    const name = "name" in error ? String(error.name) : "";
    const message = "message" in error ? String(error.message) : "";
    return name === "QuotaExceededError" || /quota/i.test(message);
}
function guardedSetItem(storage, key, value) {
    if (key === keys_1.BASELINE_ENVELOPE_KEY) {
        throw new Error("Stage 3 import writer must not mutate fitgen-peptide-rebuild-v1");
    }
    storage.setItem(key, value);
}
function guardedRemoveItem(storage, key) {
    if (key === keys_1.BASELINE_ENVELOPE_KEY) {
        throw new Error("Stage 3 import writer must not delete fitgen-peptide-rebuild-v1");
    }
    storage.removeItem?.(key);
}
function parseSlot(raw) {
    if (!raw) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
            return null;
        }
        if (typeof parsed.createdAt !== "string" || typeof parsed.expiresAt !== "string") {
            return null;
        }
        if (!parsed.envelope || parsed.envelope.schemaVersion !== keys_1.BACKUP_SCHEMA_V3) {
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
function recoveryExpiresAt(createdAtIso) {
    const createdMs = Date.parse(createdAtIso);
    return new Date(createdMs + keys_1.RECOVERY_TTL_MS).toISOString();
}
function isRecoveryExpired(snapshot, nowMs) {
    const expiresMs = Date.parse(snapshot.expiresAt);
    return !Number.isFinite(expiresMs) || nowMs >= expiresMs;
}
function readRecoverySlot(storage) {
    const raw = storage.getItem(keys_1.RECOVERY_SLOT_KEY);
    if (!raw) {
        return { snapshot: null, corrupt: false };
    }
    const snapshot = parseSlot(raw);
    return { snapshot, corrupt: snapshot === null };
}
function restoreAvailable(storage, nowMs) {
    const { snapshot, corrupt } = readRecoverySlot(storage);
    return Boolean(snapshot && !corrupt && !isRecoveryExpired(snapshot, nowMs));
}
function buildRecoverySnapshot(state, createdAt) {
    return {
        createdAt,
        expiresAt: recoveryExpiresAt(createdAt),
        envelope: (0, export_1.buildExportDocument)(state, createdAt),
    };
}
function writeRecoverySlot(storage, snapshot) {
    const serialized = JSON.stringify(snapshot);
    try {
        guardedSetItem(storage, keys_1.RECOVERY_SLOT_PENDING_KEY, serialized);
    }
    catch (error) {
        return {
            ok: false,
            code: isQuotaError(error) ? "QUOTA" : "VERIFY_FAILED",
            message: copy_1.IMPORT_QUOTA_ERROR,
        };
    }
    const pendingRaw = storage.getItem(keys_1.RECOVERY_SLOT_PENDING_KEY);
    if (pendingRaw !== serialized || parseSlot(pendingRaw) === null) {
        return { ok: false, code: "VERIFY_FAILED", message: copy_1.IMPORT_QUOTA_ERROR };
    }
    try {
        guardedSetItem(storage, keys_1.RECOVERY_SLOT_KEY, serialized);
    }
    catch (error) {
        return {
            ok: false,
            code: isQuotaError(error) ? "QUOTA" : "VERIFY_FAILED",
            message: copy_1.IMPORT_QUOTA_ERROR,
        };
    }
    const slotRaw = storage.getItem(keys_1.RECOVERY_SLOT_KEY);
    if (slotRaw !== serialized || parseSlot(slotRaw) === null) {
        return { ok: false, code: "VERIFY_FAILED", message: copy_1.IMPORT_QUOTA_ERROR };
    }
    try {
        guardedRemoveItem(storage, keys_1.RECOVERY_SLOT_PENDING_KEY);
    }
    catch {
    }
    return { ok: true };
}
function snapshotToGithubState(snapshot) {
    const mapped = (0, map_1.mapToV3)(snapshot.envelope);
    if (!mapped.ok) {
        return null;
    }
    return (0, fields_1.cloneJson)(mapped.state);
}
function restoreFailure(code, message, extras) {
    return {
        ok: false,
        wrote: false,
        code,
        message,
        baselineKeyUnchanged: true,
        ...extras,
    };
}
function inspectRestore(storage, nowMs) {
    const { snapshot, corrupt } = readRecoverySlot(storage);
    if (corrupt) {
        return restoreFailure("CORRUPT_SNAPSHOT", copy_1.RESTORE_CORRUPT);
    }
    if (!snapshot) {
        return restoreFailure("UNAVAILABLE", copy_1.RESTORE_UNAVAILABLE);
    }
    if (isRecoveryExpired(snapshot, nowMs)) {
        return restoreFailure("EXPIRED", copy_1.RESTORE_EXPIRED, { expired: true });
    }
    return { ok: true, snapshot };
}

  })(
    modules["persist/recovery"].exports,
    createRequire(modules["persist/recovery"].dirname),
    modules["persist/recovery"],
    "persist"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

  })(
    modules["persist/types"].exports,
    createRequire(modules["persist/types"].dirname),
    modules["persist/types"],
    "persist"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readGithubState = readGithubState;
exports.readBaselineRaw = readBaselineRaw;
exports.baselineKeyUnchanged = baselineKeyUnchanged;
exports.commitGithubState = commitGithubState;
exports.tryRollbackGithubState = tryRollbackGithubState;
exports.cloneGithubState = cloneGithubState;
const persist_1 = require("../ux/persist");
const copy_1 = require("./copy");
const fields_1 = require("./fields");
const keys_1 = require("./keys");
const map_github_1 = require("./map-github");
const recovery_1 = require("./recovery");
function readGithubState(storage) {
    const persisted = (0, persist_1.readAppState)(storage);
    const medications = [];
    const raw = storage.getItem(keys_1.MEDICATIONS_STORAGE_KEY);
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                for (const row of parsed) {
                    const mapped = (0, map_github_1.githubMedicationFromUnknown)(row, []);
                    if (mapped) {
                        medications.push(mapped);
                    }
                }
            }
        }
        catch {
        }
    }
    return {
        fills: persisted.fills,
        schedules: persisted.schedules,
        occurrences: persisted.occurrences,
        medications,
    };
}
function readBaselineRaw(storage) {
    return storage.getItem(keys_1.BASELINE_ENVELOPE_KEY);
}
function baselineKeyUnchanged(storage, before) {
    return storage.getItem(keys_1.BASELINE_ENVELOPE_KEY) === before;
}
function commitGithubState(storage, next) {
    (0, persist_1.commitAppState)(storage, {
        fills: next.fills,
        schedules: next.schedules,
        occurrences: next.occurrences,
    });
    (0, recovery_1.guardedSetItem)(storage, keys_1.MEDICATIONS_STORAGE_KEY, JSON.stringify(next.medications));
}
function tryRollbackGithubState(storage, previous) {
    try {
        commitGithubState(storage, previous);
        return { ok: true };
    }
    catch {
        return { ok: false, message: copy_1.IMPORT_APPLY_ERROR };
    }
}
function cloneGithubState(state) {
    return (0, fields_1.cloneJson)(state);
}

  })(
    modules["persist/writer"].exports,
    createRequire(modules["persist/writer"].dirname),
    modules["persist/writer"],
    "persist"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OCCURRENCES_STORAGE_KEY = void 0;
exports.resolveTimeZone = resolveTimeZone;
exports.fillToDepletion = fillToDepletion;
exports.hydrateLegacyOccurrences = hydrateLegacyOccurrences;
exports.toWriterSnapshot = toWriterSnapshot;
exports.applyWriterSnapshot = applyWriterSnapshot;
exports.mirrorTakenDate = mirrorTakenDate;
exports.isScheduleTakenOnDate = isScheduleTakenOnDate;
exports.canUndoTaken = canUndoTaken;
exports.resolveScheduleFillId = resolveScheduleFillId;
exports.createTakenAdapter = createTakenAdapter;
const index_1 = require("../occ/index");
const types_1 = require("../occ/types");
const copy_1 = require("./copy");
exports.OCCURRENCES_STORAGE_KEY = "peptide-calculator-v2-occurrences";
function cloneFills(fills) {
    return fills.map((fill) => ({ ...fill }));
}
function cloneSchedules(schedules) {
    return schedules.map((schedule) => ({
        ...schedule,
        takenDates: Array.isArray(schedule.takenDates) ? [...schedule.takenDates] : schedule.takenDates,
    }));
}
function resolveTimeZone(value) {
    if (typeof value === "string" && value.trim()) {
        try {
            new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
            return value;
        }
        catch {
        }
    }
    try {
        const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (resolved) {
            return resolved;
        }
    }
    catch {
    }
    return "UTC";
}
function deriveRemaining(fill, schedules) {
    if (Number.isFinite(Number(fill.depletionRemaining))) {
        return Number(fill.depletionRemaining);
    }
    const vial = Number(fill.vialAmount);
    const used = schedules
        .filter((schedule) => schedule.fillSavedId === fill.savedId)
        .reduce((sum, schedule) => {
        const dose = Number(schedule.doseAmount) || 0;
        return sum + (0, index_1.explicitLegacyTakenDates)(schedule.takenDates).length * dose;
    }, 0);
    if (!Number.isFinite(vial)) {
        return 0;
    }
    return vial - used;
}
function fillToDepletion(fill, schedules, desiredDoseOverride) {
    const linked = schedules.filter((schedule) => schedule.fillSavedId === fill.savedId);
    const desiredDose = Number.isFinite(Number(desiredDoseOverride))
        ? Number(desiredDoseOverride)
        : Number(linked[0]?.doseAmount ?? fill.recommendedDoseAmount);
    const unit = String(fill.unitLabel || linked[0]?.unitLabel || "mg");
    return {
        id: fill.savedId,
        desiredDose,
        unit,
        depletionRemaining: deriveRemaining(fill, schedules),
        depletionUnit: String(fill.depletionUnit || unit),
    };
}
function hydrateLegacyOccurrences(state, timeZone, nowIso) {
    let records = state.occurrences.map((row) => ({ ...row }));
    for (const schedule of state.schedules) {
        const result = (0, index_1.materializeLegacyTakenDates)(records, { id: schedule.id, timeZone, takenDates: schedule.takenDates }, nowIso);
        if (result.ok) {
            records = result.records;
        }
    }
    return {
        fills: cloneFills(state.fills),
        schedules: cloneSchedules(state.schedules),
        occurrences: records,
    };
}
function toWriterSnapshot(state, desiredDoseByFillId) {
    return {
        occurrences: state.occurrences.map((row) => ({ ...row })),
        fills: state.fills.map((fill) => fillToDepletion(fill, state.schedules, desiredDoseByFillId?.[fill.savedId])),
    };
}
function applyWriterSnapshot(state, snapshot) {
    const depletionById = new Map(snapshot.fills.map((row) => [row.id, row]));
    return {
        fills: state.fills.map((fill) => {
            const row = depletionById.get(fill.savedId);
            if (!row) {
                return { ...fill };
            }
            return {
                ...fill,
                depletionRemaining: row.depletionRemaining,
                depletionUnit: row.depletionUnit,
            };
        }),
        schedules: cloneSchedules(state.schedules),
        occurrences: snapshot.occurrences.map((row) => ({ ...row })),
    };
}
function mirrorTakenDate(schedules, scheduleId, localCivilDate, taken) {
    return schedules.map((schedule) => {
        if (schedule.id !== scheduleId) {
            return { ...schedule, takenDates: Array.isArray(schedule.takenDates) ? [...schedule.takenDates] : schedule.takenDates };
        }
        const current = (0, index_1.explicitLegacyTakenDates)(schedule.takenDates);
        if (taken && !current.includes(localCivilDate)) {
            return { ...schedule, takenDates: [...current, localCivilDate] };
        }
        if (!taken) {
            return { ...schedule, takenDates: current.filter((date) => date !== localCivilDate) };
        }
        return { ...schedule, takenDates: [...current] };
    });
}
function isScheduleTakenOnDate(state, scheduleId, localCivilDate) {
    const occurrence = (0, index_1.lookupOccurrence)(state.occurrences, scheduleId, localCivilDate);
    if (occurrence) {
        return occurrence.status === "taken";
    }
    const schedule = state.schedules.find((row) => row.id === scheduleId);
    return (0, index_1.explicitLegacyTakenDates)(schedule?.takenDates).includes(localCivilDate);
}
function canUndoTaken(state, scheduleId, localCivilDate) {
    const occurrence = (0, index_1.lookupOccurrence)(state.occurrences, scheduleId, localCivilDate);
    return Boolean(occurrence &&
        occurrence.status === "taken" &&
        (0, types_1.depletionApplied)(occurrence) &&
        occurrence.appliedFillId);
}
function resolveScheduleFillId(state, scheduleId) {
    const schedule = state.schedules.find((row) => row.id === scheduleId);
    if (schedule?.fillSavedId) {
        return schedule.fillSavedId;
    }
    return null;
}
function toAdapterResult(result, fallback, takenMirror) {
    if (!result.ok) {
        return {
            ok: false,
            noop: false,
            code: result.code,
            message: (0, copy_1.writerErrorMessage)(result.code),
            state: fallback,
        };
    }
    let next = applyWriterSnapshot(fallback, result.snapshot);
    if (takenMirror && !result.noop) {
        next = {
            ...next,
            schedules: mirrorTakenDate(next.schedules, takenMirror.scheduleId, takenMirror.localCivilDate, takenMirror.taken),
        };
    }
    return {
        ok: true,
        noop: result.noop,
        state: next,
    };
}
function createTakenAdapter(deps) {
    function loadHydrated() {
        return hydrateLegacyOccurrences(deps.readAppState(), deps.timeZone, deps.nowIso());
    }
    function commitPersist(before, mirror) {
        return (candidate) => {
            const applied = applyWriterSnapshot(before, candidate);
            const mirrored = {
                ...applied,
                schedules: mirrorTakenDate(applied.schedules, mirror.scheduleId, mirror.localCivilDate, mirror.taken),
            };
            deps.writeAppState(mirrored);
        };
    }
    return {
        markTaken(scheduleId, localCivilDate, fillId) {
            const before = loadHydrated();
            const resolvedFillId = fillId || resolveScheduleFillId(before, scheduleId);
            if (!resolvedFillId) {
                return {
                    ok: false,
                    noop: false,
                    code: "NOT_FOUND",
                    message: (0, copy_1.writerErrorMessage)("NOT_FOUND"),
                    state: deps.readAppState(),
                };
            }
            const schedule = before.schedules.find((row) => row.id === scheduleId);
            const snapshot = toWriterSnapshot(before, {
                [resolvedFillId]: Number(schedule?.doseAmount),
            });
            const result = (0, index_1.markTaken)(snapshot, {
                scheduleId,
                localCivilDate,
                timeZone: deps.timeZone,
                fillId: resolvedFillId,
                nowIso: deps.nowIso(),
            }, commitPersist(before, { scheduleId, localCivilDate, taken: true }));
            if (!result.ok || result.noop) {
                return toAdapterResult(result, deps.readAppState());
            }
            return toAdapterResult(result, before, { scheduleId, localCivilDate, taken: true });
        },
        undoTaken(scheduleId, localCivilDate, fillId) {
            const before = loadHydrated();
            const snapshot = toWriterSnapshot(before);
            const result = (0, index_1.undoTaken)(snapshot, {
                scheduleId,
                localCivilDate,
                fillId,
                nowIso: deps.nowIso(),
            }, commitPersist(before, { scheduleId, localCivilDate, taken: false }));
            if (!result.ok || result.noop) {
                return toAdapterResult(result, deps.readAppState());
            }
            return toAdapterResult(result, before, { scheduleId, localCivilDate, taken: false });
        },
        isTaken(scheduleId, localCivilDate) {
            return isScheduleTakenOnDate(loadHydrated(), scheduleId, localCivilDate);
        },
        canUndo(scheduleId, localCivilDate) {
            return canUndoTaken(loadHydrated(), scheduleId, localCivilDate);
        },
        readHydrated() {
            return loadHydrated();
        },
    };
}

  })(
    modules["ux/adapter"].exports,
    createRequire(modules["ux/adapter"].dirname),
    modules["ux/adapter"],
    "ux"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FILL_LIFECYCLE_ACTIVE = exports.FILL_LIFECYCLE_ARCHIVED = void 0;
exports.isArchivedLifecycle = isArchivedLifecycle;
exports.planCabinetCascade = planCabinetCascade;
exports.applyCabinetArchive = applyCabinetArchive;
exports.activeFills = activeFills;
exports.activeSchedules = activeSchedules;
exports.FILL_LIFECYCLE_ARCHIVED = "archived";
exports.FILL_LIFECYCLE_ACTIVE = "active";
function explicitTakenCount(takenDates) {
    if (!Array.isArray(takenDates)) {
        return 0;
    }
    return takenDates.filter((value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
        .length;
}
function isArchivedLifecycle(value) {
    return value === exports.FILL_LIFECYCLE_ARCHIVED;
}
function planCabinetCascade(fill, schedules) {
    if (!fill?.savedId) {
        return null;
    }
    const linked = schedules.filter((schedule) => schedule.fillSavedId === fill.savedId);
    const historicalTakenCount = linked.reduce((sum, schedule) => sum + explicitTakenCount(schedule.takenDates), 0);
    return {
        fillId: fill.savedId,
        fillName: fill.name || "Unnamed Peptide Fill",
        scheduleCount: linked.length,
        historicalTakenCount,
        scheduleIds: linked.map((schedule) => schedule.id),
    };
}
function applyCabinetArchive(input) {
    const fillIds = new Set(input.fills.filter((fill) => fill.savedId === input.fillId).map((fill) => fill.savedId));
    const scheduleIds = new Set(input.schedules
        .filter((schedule) => schedule.fillSavedId && fillIds.has(schedule.fillSavedId))
        .map((schedule) => schedule.id));
    const fills = input.fills.map((fill) => fill.savedId === input.fillId ? { ...fill, lifecycle: exports.FILL_LIFECYCLE_ARCHIVED } : { ...fill });
    const schedules = input.schedules.map((schedule) => schedule.fillSavedId === input.fillId
        ? { ...schedule, lifecycle: exports.FILL_LIFECYCLE_ARCHIVED }
        : { ...schedule });
    let removedPendingCount = 0;
    const occurrences = input.occurrences.filter((row) => {
        if (!scheduleIds.has(row.scheduleId)) {
            return true;
        }
        if (row.status === "taken") {
            return true;
        }
        if (row.status === "pending" && row.localCivilDate >= input.todayKey) {
            removedPendingCount += 1;
            return false;
        }
        return true;
    });
    return { fills, schedules, occurrences, removedPendingCount };
}
function activeFills(fills) {
    return fills.filter((fill) => !isArchivedLifecycle(fill.lifecycle));
}
function activeSchedules(schedules) {
    return schedules.filter((schedule) => !isArchivedLifecycle(schedule.lifecycle));
}

  })(
    modules["ux/cabinet-cascade"].exports,
    createRequire(modules["ux/cabinet-cascade"].dirname),
    modules["ux/cabinet-cascade"],
    "ux"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CABINET_DELETE_CANCEL = exports.CABINET_DELETE_PRIMARY = exports.CHARACTERIZED_DEFAULTS_NOTE = exports.PERSIST_FAIL_ERROR = exports.MARK_TAKEN_LABEL = exports.UNDO_LABEL = exports.TAKEN_SNACKBAR_TEXT = exports.SAVE_SCHEDULE_ERROR = exports.FIELD_DOSE_GT_VIAL_ERROR = exports.FIELD_NUMBER_ERROR = exports.SAVE_CONFIRM_CANCEL = exports.SAVE_CONFIRM_PRIMARY = exports.SAVE_CONFIRM_TITLE = exports.SAVE_DISCLAIMER = exports.DISCARD_CONFIRM = exports.DISCARD_KEEP = exports.DISCARD_TITLE = void 0;
exports.cabinetDeleteTitle = cabinetDeleteTitle;
exports.cabinetDeleteBody = cabinetDeleteBody;
exports.writerErrorMessage = writerErrorMessage;
exports.DISCARD_TITLE = "Discard this peptide setup?";
exports.DISCARD_KEEP = "Keep editing";
exports.DISCARD_CONFIRM = "Discard";
exports.SAVE_DISCLAIMER = "You entered this dose. FitGen only calculates water and draw volume.";
exports.SAVE_CONFIRM_TITLE = "Confirm fill";
exports.SAVE_CONFIRM_PRIMARY = "Save peptide";
exports.SAVE_CONFIRM_CANCEL = "Cancel";
exports.FIELD_NUMBER_ERROR = "Enter a number greater than 0.";
exports.FIELD_DOSE_GT_VIAL_ERROR = "Dose can’t be larger than the amount in the vial.";
exports.SAVE_SCHEDULE_ERROR = "Enter a valid interval, time, and start date.";
exports.TAKEN_SNACKBAR_TEXT = "Marked taken";
exports.UNDO_LABEL = "Undo";
exports.MARK_TAKEN_LABEL = "Mark as taken";
exports.PERSIST_FAIL_ERROR = "Could not save this change. Nothing was updated.";
exports.CHARACTERIZED_DEFAULTS_NOTE = "These are the current on-screen starting values. They are not a target dose.";
function cabinetDeleteTitle(fillName) {
    return `Delete ${fillName} and its schedules?`;
}
function cabinetDeleteBody(scheduleCount, takenCount) {
    const plans = scheduleCount === 1 ? "1 dosage plan" : `${scheduleCount} dosage plans`;
    const history = takenCount > 0
        ? ` Historical taken records (${takenCount}) stay on this device.`
        : " Historical taken records stay on this device.";
    return `Deletes ${plans}. Future pending doses stop.${history}`;
}
exports.CABINET_DELETE_PRIMARY = "Delete fill";
exports.CABINET_DELETE_CANCEL = "Cancel";
function writerErrorMessage(code) {
    switch (code) {
        case "PERSIST_FAILED":
            return exports.PERSIST_FAIL_ERROR;
        case "UNIT_MISMATCH":
            return "This plan’s unit does not match the fill unit. Nothing was updated.";
        case "UNSUPPORTED_UNIT":
            return "This unit cannot be tracked as taken. Nothing was updated.";
        case "NOT_FOUND":
            return "This item is no longer available. Nothing was updated.";
        case "INVALID_SNAPSHOT":
            return "This taken record cannot be undone because no stored amount is available.";
        case "INVALID_DOSE":
            return "This plan is missing a usable amount. Nothing was updated.";
        case "FILL_MISMATCH":
            return "Undo does not match the stored fill. Nothing was updated.";
        case "INVALID_IDENTITY":
        case "INVALID_TIMEZONE":
        case "INVALID_INSTANT":
        case "DUPLICATE_IDENTITY":
            return "This change could not be applied. Nothing was updated.";
        default:
            return exports.PERSIST_FAIL_ERROR;
    }
}

  })(
    modules["ux/copy"].exports,
    createRequire(modules["ux/copy"].dirname),
    modules["ux/copy"],
    "ux"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FOCUSABLE_SELECTOR = exports.FOCUS_VISIBLE_PX = exports.UNDO_SNACKBAR_MS = exports.MIN_TARGET_PX = void 0;
exports.confirmAllowsEscape = confirmAllowsEscape;
exports.nextFocusIndex = nextFocusIndex;
exports.trapTabKey = trapTabKey;
exports.shouldCloseOnKey = shouldCloseOnKey;
exports.dialogAria = dialogAria;
exports.MIN_TARGET_PX = 44;
exports.UNDO_SNACKBAR_MS = 8000;
exports.FOCUS_VISIBLE_PX = 2;
exports.FOCUSABLE_SELECTOR = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type='hidden'])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
].join(",");
function confirmAllowsEscape(_kind) {
    return true;
}
function nextFocusIndex(current, count, direction) {
    if (count <= 0) {
        return 0;
    }
    return (current + direction + count) % count;
}
function trapTabKey(key, shiftKey, currentIndex, focusableCount) {
    if (key !== "Tab" || focusableCount <= 0) {
        return { handled: false, nextIndex: currentIndex };
    }
    return {
        handled: true,
        nextIndex: nextFocusIndex(currentIndex, focusableCount, shiftKey ? -1 : 1),
    };
}
function shouldCloseOnKey(key, allowEscape) {
    return allowEscape && key === "Escape";
}
function dialogAria(titleId) {
    return {
        role: "dialog",
        ariaModal: "true",
        ariaLabelledby: titleId,
    };
}

  })(
    modules["ux/dialog"].exports,
    createRequire(modules["ux/dialog"].dirname),
    modules["ux/dialog"],
    "ux"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OCCURRENCES_STORAGE_KEY = exports.FILLS_STORAGE_KEY = exports.ENVELOPE_STORAGE_KEY = exports.trapTabKey = exports.shouldCloseOnKey = exports.nextFocusIndex = exports.dialogAria = exports.confirmAllowsEscape = exports.UNDO_SNACKBAR_MS = exports.MIN_TARGET_PX = exports.FOCUS_VISIBLE_PX = exports.FOCUSABLE_SELECTOR = exports.planCabinetCascade = exports.isArchivedLifecycle = exports.applyCabinetArchive = exports.activeSchedules = exports.activeFills = exports.FILL_LIFECYCLE_ARCHIVED = exports.FILL_LIFECYCLE_ACTIVE = exports.validateSaveSchedule = exports.summaryContainsForbiddenFraming = exports.buildSaveSummary = exports.validateWizardStep = exports.parsePositiveNumber = exports.normalizeWizardValue = exports.isWizardDirty = exports.firstInvalidField = exports.discardWizardDraft = exports.characterizedDefaults = exports.CHARACTERIZED_DEFAULTS = exports.writerErrorMessage = exports.cabinetDeleteTitle = exports.cabinetDeleteBody = exports.UNDO_LABEL = exports.TAKEN_SNACKBAR_TEXT = exports.SAVE_SCHEDULE_ERROR = exports.SAVE_DISCLAIMER = exports.SAVE_CONFIRM_TITLE = exports.SAVE_CONFIRM_PRIMARY = exports.SAVE_CONFIRM_CANCEL = exports.PERSIST_FAIL_ERROR = exports.MARK_TAKEN_LABEL = exports.FIELD_NUMBER_ERROR = exports.FIELD_DOSE_GT_VIAL_ERROR = exports.DISCARD_TITLE = exports.DISCARD_KEEP = exports.DISCARD_CONFIRM = exports.CHARACTERIZED_DEFAULTS_NOTE = exports.CABINET_DELETE_PRIMARY = exports.CABINET_DELETE_CANCEL = void 0;
exports.RESTORE_BUTTON_LABEL = exports.RECOVERY_TTL_MS = exports.RECOVERY_SLOT_PENDING_KEY = exports.RECOVERY_SLOT_KEY = exports.MEDICATIONS_STORAGE_KEY = exports.IMPORT_SKIP_PRIMARY = exports.IMPORT_REPLACE_TITLE = exports.IMPORT_REPLACE_PRIMARY = exports.IMPORT_REPLACE_LINK = exports.IMPORT_REPLACE_BACK = exports.IMPORT_QUOTA_ERROR = exports.IMPORT_PREVIEW_TITLE = exports.IMPORT_CLOSE = exports.IMPORT_CANCEL = exports.IMPORT_BLOCKED_NEWER = exports.IMPORT_BLOCKED_EMPTY = exports.IMPORT_BLOCKED_CORRUPT = exports.IMPORT_APPLY_ERROR = exports.EXPORT_PLAINTEXT_WARNING = exports.EXPORT_CONFIRM_TITLE = exports.EXPORT_CONFIRM_PRIMARY = exports.EXPORT_CONFIRM_CANCEL = exports.BASELINE_SYNTHETIC_SCHEDULE_PREFIX = exports.BASELINE_ENVELOPE_KEY = exports.BASELINE_COEXIST_NOTE = exports.BACKUP_SCHEMA_V3 = exports.undoTaken = exports.reloadSnapshot = exports.materializeLegacyTakenDates = exports.markTaken = exports.lookupOccurrence = exports.explicitLegacyTakenDates = exports.toWriterSnapshot = exports.resolveTimeZone = exports.resolveScheduleFillId = exports.mirrorTakenDate = exports.isScheduleTakenOnDate = exports.hydrateLegacyOccurrences = exports.fillToDepletion = exports.createTakenAdapter = exports.canUndoTaken = exports.applyWriterSnapshot = exports.snapshotEqual = exports.readAppState = exports.hydrateLegacyMirrors = exports.emptyAppState = exports.commitAppState = exports.cloneAppState = exports.SCHEDULES_STORAGE_KEY = exports.PERSIST_WRITE_STEPS = void 0;
exports.restoreFromSlot = exports.restoreAvailable = exports.readGithubState = exports.previewImportFromStorage = exports.previewImport = exports.previewBodyHtml = exports.parseBackupText = exports.mapToV3 = exports.inspectRestore = exports.importClassLabel = exports.githubStateEqual = exports.exportDocumentJson = exports.classifyBackup = exports.buildExportDocument = exports.applyImport = exports.applyDuplicatePolicy = exports.RESTORE_UNAVAILABLE = exports.RESTORE_TITLE = exports.RESTORE_PRIMARY = exports.RESTORE_EXPIRED = exports.RESTORE_CORRUPT = exports.RESTORE_CANCEL = void 0;
var copy_1 = require("./copy");
Object.defineProperty(exports, "CABINET_DELETE_CANCEL", { enumerable: true, get: function () { return copy_1.CABINET_DELETE_CANCEL; } });
Object.defineProperty(exports, "CABINET_DELETE_PRIMARY", { enumerable: true, get: function () { return copy_1.CABINET_DELETE_PRIMARY; } });
Object.defineProperty(exports, "CHARACTERIZED_DEFAULTS_NOTE", { enumerable: true, get: function () { return copy_1.CHARACTERIZED_DEFAULTS_NOTE; } });
Object.defineProperty(exports, "DISCARD_CONFIRM", { enumerable: true, get: function () { return copy_1.DISCARD_CONFIRM; } });
Object.defineProperty(exports, "DISCARD_KEEP", { enumerable: true, get: function () { return copy_1.DISCARD_KEEP; } });
Object.defineProperty(exports, "DISCARD_TITLE", { enumerable: true, get: function () { return copy_1.DISCARD_TITLE; } });
Object.defineProperty(exports, "FIELD_DOSE_GT_VIAL_ERROR", { enumerable: true, get: function () { return copy_1.FIELD_DOSE_GT_VIAL_ERROR; } });
Object.defineProperty(exports, "FIELD_NUMBER_ERROR", { enumerable: true, get: function () { return copy_1.FIELD_NUMBER_ERROR; } });
Object.defineProperty(exports, "MARK_TAKEN_LABEL", { enumerable: true, get: function () { return copy_1.MARK_TAKEN_LABEL; } });
Object.defineProperty(exports, "PERSIST_FAIL_ERROR", { enumerable: true, get: function () { return copy_1.PERSIST_FAIL_ERROR; } });
Object.defineProperty(exports, "SAVE_CONFIRM_CANCEL", { enumerable: true, get: function () { return copy_1.SAVE_CONFIRM_CANCEL; } });
Object.defineProperty(exports, "SAVE_CONFIRM_PRIMARY", { enumerable: true, get: function () { return copy_1.SAVE_CONFIRM_PRIMARY; } });
Object.defineProperty(exports, "SAVE_CONFIRM_TITLE", { enumerable: true, get: function () { return copy_1.SAVE_CONFIRM_TITLE; } });
Object.defineProperty(exports, "SAVE_DISCLAIMER", { enumerable: true, get: function () { return copy_1.SAVE_DISCLAIMER; } });
Object.defineProperty(exports, "SAVE_SCHEDULE_ERROR", { enumerable: true, get: function () { return copy_1.SAVE_SCHEDULE_ERROR; } });
Object.defineProperty(exports, "TAKEN_SNACKBAR_TEXT", { enumerable: true, get: function () { return copy_1.TAKEN_SNACKBAR_TEXT; } });
Object.defineProperty(exports, "UNDO_LABEL", { enumerable: true, get: function () { return copy_1.UNDO_LABEL; } });
Object.defineProperty(exports, "cabinetDeleteBody", { enumerable: true, get: function () { return copy_1.cabinetDeleteBody; } });
Object.defineProperty(exports, "cabinetDeleteTitle", { enumerable: true, get: function () { return copy_1.cabinetDeleteTitle; } });
Object.defineProperty(exports, "writerErrorMessage", { enumerable: true, get: function () { return copy_1.writerErrorMessage; } });
var wizard_1 = require("./wizard");
Object.defineProperty(exports, "CHARACTERIZED_DEFAULTS", { enumerable: true, get: function () { return wizard_1.CHARACTERIZED_DEFAULTS; } });
Object.defineProperty(exports, "characterizedDefaults", { enumerable: true, get: function () { return wizard_1.characterizedDefaults; } });
Object.defineProperty(exports, "discardWizardDraft", { enumerable: true, get: function () { return wizard_1.discardWizardDraft; } });
Object.defineProperty(exports, "firstInvalidField", { enumerable: true, get: function () { return wizard_1.firstInvalidField; } });
Object.defineProperty(exports, "isWizardDirty", { enumerable: true, get: function () { return wizard_1.isWizardDirty; } });
Object.defineProperty(exports, "normalizeWizardValue", { enumerable: true, get: function () { return wizard_1.normalizeWizardValue; } });
Object.defineProperty(exports, "parsePositiveNumber", { enumerable: true, get: function () { return wizard_1.parsePositiveNumber; } });
Object.defineProperty(exports, "validateWizardStep", { enumerable: true, get: function () { return wizard_1.validateWizardStep; } });
var save_summary_1 = require("./save-summary");
Object.defineProperty(exports, "buildSaveSummary", { enumerable: true, get: function () { return save_summary_1.buildSaveSummary; } });
Object.defineProperty(exports, "summaryContainsForbiddenFraming", { enumerable: true, get: function () { return save_summary_1.summaryContainsForbiddenFraming; } });
Object.defineProperty(exports, "validateSaveSchedule", { enumerable: true, get: function () { return save_summary_1.validateSaveSchedule; } });
var cabinet_cascade_1 = require("./cabinet-cascade");
Object.defineProperty(exports, "FILL_LIFECYCLE_ACTIVE", { enumerable: true, get: function () { return cabinet_cascade_1.FILL_LIFECYCLE_ACTIVE; } });
Object.defineProperty(exports, "FILL_LIFECYCLE_ARCHIVED", { enumerable: true, get: function () { return cabinet_cascade_1.FILL_LIFECYCLE_ARCHIVED; } });
Object.defineProperty(exports, "activeFills", { enumerable: true, get: function () { return cabinet_cascade_1.activeFills; } });
Object.defineProperty(exports, "activeSchedules", { enumerable: true, get: function () { return cabinet_cascade_1.activeSchedules; } });
Object.defineProperty(exports, "applyCabinetArchive", { enumerable: true, get: function () { return cabinet_cascade_1.applyCabinetArchive; } });
Object.defineProperty(exports, "isArchivedLifecycle", { enumerable: true, get: function () { return cabinet_cascade_1.isArchivedLifecycle; } });
Object.defineProperty(exports, "planCabinetCascade", { enumerable: true, get: function () { return cabinet_cascade_1.planCabinetCascade; } });
var dialog_1 = require("./dialog");
Object.defineProperty(exports, "FOCUSABLE_SELECTOR", { enumerable: true, get: function () { return dialog_1.FOCUSABLE_SELECTOR; } });
Object.defineProperty(exports, "FOCUS_VISIBLE_PX", { enumerable: true, get: function () { return dialog_1.FOCUS_VISIBLE_PX; } });
Object.defineProperty(exports, "MIN_TARGET_PX", { enumerable: true, get: function () { return dialog_1.MIN_TARGET_PX; } });
Object.defineProperty(exports, "UNDO_SNACKBAR_MS", { enumerable: true, get: function () { return dialog_1.UNDO_SNACKBAR_MS; } });
Object.defineProperty(exports, "confirmAllowsEscape", { enumerable: true, get: function () { return dialog_1.confirmAllowsEscape; } });
Object.defineProperty(exports, "dialogAria", { enumerable: true, get: function () { return dialog_1.dialogAria; } });
Object.defineProperty(exports, "nextFocusIndex", { enumerable: true, get: function () { return dialog_1.nextFocusIndex; } });
Object.defineProperty(exports, "shouldCloseOnKey", { enumerable: true, get: function () { return dialog_1.shouldCloseOnKey; } });
Object.defineProperty(exports, "trapTabKey", { enumerable: true, get: function () { return dialog_1.trapTabKey; } });
var persist_1 = require("./persist");
Object.defineProperty(exports, "ENVELOPE_STORAGE_KEY", { enumerable: true, get: function () { return persist_1.ENVELOPE_STORAGE_KEY; } });
Object.defineProperty(exports, "FILLS_STORAGE_KEY", { enumerable: true, get: function () { return persist_1.FILLS_STORAGE_KEY; } });
Object.defineProperty(exports, "OCCURRENCES_STORAGE_KEY", { enumerable: true, get: function () { return persist_1.OCCURRENCES_STORAGE_KEY; } });
Object.defineProperty(exports, "PERSIST_WRITE_STEPS", { enumerable: true, get: function () { return persist_1.PERSIST_WRITE_STEPS; } });
Object.defineProperty(exports, "SCHEDULES_STORAGE_KEY", { enumerable: true, get: function () { return persist_1.SCHEDULES_STORAGE_KEY; } });
Object.defineProperty(exports, "cloneAppState", { enumerable: true, get: function () { return persist_1.cloneAppState; } });
Object.defineProperty(exports, "commitAppState", { enumerable: true, get: function () { return persist_1.commitAppState; } });
Object.defineProperty(exports, "emptyAppState", { enumerable: true, get: function () { return persist_1.emptyAppState; } });
Object.defineProperty(exports, "hydrateLegacyMirrors", { enumerable: true, get: function () { return persist_1.hydrateLegacyMirrors; } });
Object.defineProperty(exports, "readAppState", { enumerable: true, get: function () { return persist_1.readAppState; } });
Object.defineProperty(exports, "snapshotEqual", { enumerable: true, get: function () { return persist_1.snapshotEqual; } });
var adapter_1 = require("./adapter");
Object.defineProperty(exports, "applyWriterSnapshot", { enumerable: true, get: function () { return adapter_1.applyWriterSnapshot; } });
Object.defineProperty(exports, "canUndoTaken", { enumerable: true, get: function () { return adapter_1.canUndoTaken; } });
Object.defineProperty(exports, "createTakenAdapter", { enumerable: true, get: function () { return adapter_1.createTakenAdapter; } });
Object.defineProperty(exports, "fillToDepletion", { enumerable: true, get: function () { return adapter_1.fillToDepletion; } });
Object.defineProperty(exports, "hydrateLegacyOccurrences", { enumerable: true, get: function () { return adapter_1.hydrateLegacyOccurrences; } });
Object.defineProperty(exports, "isScheduleTakenOnDate", { enumerable: true, get: function () { return adapter_1.isScheduleTakenOnDate; } });
Object.defineProperty(exports, "mirrorTakenDate", { enumerable: true, get: function () { return adapter_1.mirrorTakenDate; } });
Object.defineProperty(exports, "resolveScheduleFillId", { enumerable: true, get: function () { return adapter_1.resolveScheduleFillId; } });
Object.defineProperty(exports, "resolveTimeZone", { enumerable: true, get: function () { return adapter_1.resolveTimeZone; } });
Object.defineProperty(exports, "toWriterSnapshot", { enumerable: true, get: function () { return adapter_1.toWriterSnapshot; } });
var index_1 = require("../occ/index");
Object.defineProperty(exports, "explicitLegacyTakenDates", { enumerable: true, get: function () { return index_1.explicitLegacyTakenDates; } });
Object.defineProperty(exports, "lookupOccurrence", { enumerable: true, get: function () { return index_1.lookupOccurrence; } });
Object.defineProperty(exports, "markTaken", { enumerable: true, get: function () { return index_1.markTaken; } });
Object.defineProperty(exports, "materializeLegacyTakenDates", { enumerable: true, get: function () { return index_1.materializeLegacyTakenDates; } });
Object.defineProperty(exports, "reloadSnapshot", { enumerable: true, get: function () { return index_1.reloadSnapshot; } });
Object.defineProperty(exports, "undoTaken", { enumerable: true, get: function () { return index_1.undoTaken; } });
var index_2 = require("../persist/index");
Object.defineProperty(exports, "BACKUP_SCHEMA_V3", { enumerable: true, get: function () { return index_2.BACKUP_SCHEMA_V3; } });
Object.defineProperty(exports, "BASELINE_COEXIST_NOTE", { enumerable: true, get: function () { return index_2.BASELINE_COEXIST_NOTE; } });
Object.defineProperty(exports, "BASELINE_ENVELOPE_KEY", { enumerable: true, get: function () { return index_2.BASELINE_ENVELOPE_KEY; } });
Object.defineProperty(exports, "BASELINE_SYNTHETIC_SCHEDULE_PREFIX", { enumerable: true, get: function () { return index_2.BASELINE_SYNTHETIC_SCHEDULE_PREFIX; } });
Object.defineProperty(exports, "EXPORT_CONFIRM_CANCEL", { enumerable: true, get: function () { return index_2.EXPORT_CONFIRM_CANCEL; } });
Object.defineProperty(exports, "EXPORT_CONFIRM_PRIMARY", { enumerable: true, get: function () { return index_2.EXPORT_CONFIRM_PRIMARY; } });
Object.defineProperty(exports, "EXPORT_CONFIRM_TITLE", { enumerable: true, get: function () { return index_2.EXPORT_CONFIRM_TITLE; } });
Object.defineProperty(exports, "EXPORT_PLAINTEXT_WARNING", { enumerable: true, get: function () { return index_2.EXPORT_PLAINTEXT_WARNING; } });
Object.defineProperty(exports, "IMPORT_APPLY_ERROR", { enumerable: true, get: function () { return index_2.IMPORT_APPLY_ERROR; } });
Object.defineProperty(exports, "IMPORT_BLOCKED_CORRUPT", { enumerable: true, get: function () { return index_2.IMPORT_BLOCKED_CORRUPT; } });
Object.defineProperty(exports, "IMPORT_BLOCKED_EMPTY", { enumerable: true, get: function () { return index_2.IMPORT_BLOCKED_EMPTY; } });
Object.defineProperty(exports, "IMPORT_BLOCKED_NEWER", { enumerable: true, get: function () { return index_2.IMPORT_BLOCKED_NEWER; } });
Object.defineProperty(exports, "IMPORT_CANCEL", { enumerable: true, get: function () { return index_2.IMPORT_CANCEL; } });
Object.defineProperty(exports, "IMPORT_CLOSE", { enumerable: true, get: function () { return index_2.IMPORT_CLOSE; } });
Object.defineProperty(exports, "IMPORT_PREVIEW_TITLE", { enumerable: true, get: function () { return index_2.IMPORT_PREVIEW_TITLE; } });
Object.defineProperty(exports, "IMPORT_QUOTA_ERROR", { enumerable: true, get: function () { return index_2.IMPORT_QUOTA_ERROR; } });
Object.defineProperty(exports, "IMPORT_REPLACE_BACK", { enumerable: true, get: function () { return index_2.IMPORT_REPLACE_BACK; } });
Object.defineProperty(exports, "IMPORT_REPLACE_LINK", { enumerable: true, get: function () { return index_2.IMPORT_REPLACE_LINK; } });
Object.defineProperty(exports, "IMPORT_REPLACE_PRIMARY", { enumerable: true, get: function () { return index_2.IMPORT_REPLACE_PRIMARY; } });
Object.defineProperty(exports, "IMPORT_REPLACE_TITLE", { enumerable: true, get: function () { return index_2.IMPORT_REPLACE_TITLE; } });
Object.defineProperty(exports, "IMPORT_SKIP_PRIMARY", { enumerable: true, get: function () { return index_2.IMPORT_SKIP_PRIMARY; } });
Object.defineProperty(exports, "MEDICATIONS_STORAGE_KEY", { enumerable: true, get: function () { return index_2.MEDICATIONS_STORAGE_KEY; } });
Object.defineProperty(exports, "RECOVERY_SLOT_KEY", { enumerable: true, get: function () { return index_2.RECOVERY_SLOT_KEY; } });
Object.defineProperty(exports, "RECOVERY_SLOT_PENDING_KEY", { enumerable: true, get: function () { return index_2.RECOVERY_SLOT_PENDING_KEY; } });
Object.defineProperty(exports, "RECOVERY_TTL_MS", { enumerable: true, get: function () { return index_2.RECOVERY_TTL_MS; } });
Object.defineProperty(exports, "RESTORE_BUTTON_LABEL", { enumerable: true, get: function () { return index_2.RESTORE_BUTTON_LABEL; } });
Object.defineProperty(exports, "RESTORE_CANCEL", { enumerable: true, get: function () { return index_2.RESTORE_CANCEL; } });
Object.defineProperty(exports, "RESTORE_CORRUPT", { enumerable: true, get: function () { return index_2.RESTORE_CORRUPT; } });
Object.defineProperty(exports, "RESTORE_EXPIRED", { enumerable: true, get: function () { return index_2.RESTORE_EXPIRED; } });
Object.defineProperty(exports, "RESTORE_PRIMARY", { enumerable: true, get: function () { return index_2.RESTORE_PRIMARY; } });
Object.defineProperty(exports, "RESTORE_TITLE", { enumerable: true, get: function () { return index_2.RESTORE_TITLE; } });
Object.defineProperty(exports, "RESTORE_UNAVAILABLE", { enumerable: true, get: function () { return index_2.RESTORE_UNAVAILABLE; } });
Object.defineProperty(exports, "applyDuplicatePolicy", { enumerable: true, get: function () { return index_2.applyDuplicatePolicy; } });
Object.defineProperty(exports, "applyImport", { enumerable: true, get: function () { return index_2.applyImport; } });
Object.defineProperty(exports, "buildExportDocument", { enumerable: true, get: function () { return index_2.buildExportDocument; } });
Object.defineProperty(exports, "classifyBackup", { enumerable: true, get: function () { return index_2.classifyBackup; } });
Object.defineProperty(exports, "exportDocumentJson", { enumerable: true, get: function () { return index_2.exportDocumentJson; } });
Object.defineProperty(exports, "githubStateEqual", { enumerable: true, get: function () { return index_2.githubStateEqual; } });
Object.defineProperty(exports, "importClassLabel", { enumerable: true, get: function () { return index_2.importClassLabel; } });
Object.defineProperty(exports, "inspectRestore", { enumerable: true, get: function () { return index_2.inspectRestore; } });
Object.defineProperty(exports, "mapToV3", { enumerable: true, get: function () { return index_2.mapToV3; } });
Object.defineProperty(exports, "parseBackupText", { enumerable: true, get: function () { return index_2.parseBackupText; } });
Object.defineProperty(exports, "previewBodyHtml", { enumerable: true, get: function () { return index_2.previewBodyHtml; } });
Object.defineProperty(exports, "previewImport", { enumerable: true, get: function () { return index_2.previewImport; } });
Object.defineProperty(exports, "previewImportFromStorage", { enumerable: true, get: function () { return index_2.previewImportFromStorage; } });
Object.defineProperty(exports, "readGithubState", { enumerable: true, get: function () { return index_2.readGithubState; } });
Object.defineProperty(exports, "restoreAvailable", { enumerable: true, get: function () { return index_2.restoreAvailable; } });
Object.defineProperty(exports, "restoreFromSlot", { enumerable: true, get: function () { return index_2.restoreFromSlot; } });

  })(
    modules["ux/index"].exports,
    createRequire(modules["ux/index"].dirname),
    modules["ux/index"],
    "ux"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERSIST_WRITE_STEPS = exports.SCHEDULES_STORAGE_KEY = exports.FILLS_STORAGE_KEY = exports.ENVELOPE_STORAGE_KEY = exports.OCCURRENCES_STORAGE_KEY = void 0;
exports.emptyAppState = emptyAppState;
exports.cloneAppState = cloneAppState;
exports.readAppState = readAppState;
exports.commitAppState = commitAppState;
exports.hydrateLegacyMirrors = hydrateLegacyMirrors;
exports.snapshotEqual = snapshotEqual;
const adapter_1 = require("./adapter");
Object.defineProperty(exports, "OCCURRENCES_STORAGE_KEY", { enumerable: true, get: function () { return adapter_1.OCCURRENCES_STORAGE_KEY; } });
exports.ENVELOPE_STORAGE_KEY = "peptide-calculator-v2-p0ux-store";
exports.FILLS_STORAGE_KEY = "peptide-calculator-v2-fills";
exports.SCHEDULES_STORAGE_KEY = "peptide-calculator-v2-schedules";
exports.PERSIST_WRITE_STEPS = [
    exports.ENVELOPE_STORAGE_KEY,
    exports.FILLS_STORAGE_KEY,
    exports.SCHEDULES_STORAGE_KEY,
    adapter_1.OCCURRENCES_STORAGE_KEY,
];
function parseJsonArray(raw) {
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function parseEnvelope(raw) {
    if (!raw) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== 1) {
            return null;
        }
        if (!Array.isArray(parsed.fills) || !Array.isArray(parsed.schedules) || !Array.isArray(parsed.occurrences)) {
            return null;
        }
        return {
            version: 1,
            fills: parsed.fills,
            schedules: parsed.schedules,
            occurrences: parsed.occurrences,
        };
    }
    catch {
        return null;
    }
}
function emptyAppState() {
    return { fills: [], schedules: [], occurrences: [] };
}
function cloneAppState(state) {
    return JSON.parse(JSON.stringify(state));
}
function readAppState(storage) {
    const envelope = parseEnvelope(storage.getItem(exports.ENVELOPE_STORAGE_KEY));
    if (envelope) {
        return {
            fills: envelope.fills,
            schedules: envelope.schedules,
            occurrences: envelope.occurrences,
        };
    }
    return {
        fills: parseJsonArray(storage.getItem(exports.FILLS_STORAGE_KEY)),
        schedules: parseJsonArray(storage.getItem(exports.SCHEDULES_STORAGE_KEY)),
        occurrences: parseJsonArray(storage.getItem(adapter_1.OCCURRENCES_STORAGE_KEY)),
    };
}
function writeMirror(storage, key, value) {
    try {
        storage.setItem(key, value);
    }
    catch {
    }
}
function commitAppState(storage, next) {
    const envelope = {
        version: 1,
        fills: next.fills,
        schedules: next.schedules,
        occurrences: next.occurrences,
    };
    const envelopeJson = JSON.stringify(envelope);
    const fillsJson = JSON.stringify(next.fills);
    const schedulesJson = JSON.stringify(next.schedules);
    const occurrencesJson = JSON.stringify(next.occurrences);
    storage.setItem(exports.ENVELOPE_STORAGE_KEY, envelopeJson);
    writeMirror(storage, exports.FILLS_STORAGE_KEY, fillsJson);
    writeMirror(storage, exports.SCHEDULES_STORAGE_KEY, schedulesJson);
    writeMirror(storage, adapter_1.OCCURRENCES_STORAGE_KEY, occurrencesJson);
}
function hydrateLegacyMirrors(storage) {
    const state = readAppState(storage);
    const hasEnvelope = Boolean(parseEnvelope(storage.getItem(exports.ENVELOPE_STORAGE_KEY)));
    if (!hasEnvelope) {
        const hasLegacy = storage.getItem(exports.FILLS_STORAGE_KEY) !== null ||
            storage.getItem(exports.SCHEDULES_STORAGE_KEY) !== null ||
            storage.getItem(adapter_1.OCCURRENCES_STORAGE_KEY) !== null;
        if (hasLegacy) {
            try {
                commitAppState(storage, state);
            }
            catch {
                return state;
            }
        }
        return state;
    }
    writeMirror(storage, exports.FILLS_STORAGE_KEY, JSON.stringify(state.fills));
    writeMirror(storage, exports.SCHEDULES_STORAGE_KEY, JSON.stringify(state.schedules));
    writeMirror(storage, adapter_1.OCCURRENCES_STORAGE_KEY, JSON.stringify(state.occurrences));
    return state;
}
function snapshotEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}

  })(
    modules["ux/persist"].exports,
    createRequire(modules["ux/persist"].dirname),
    modules["ux/persist"],
    "ux"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSaveSchedule = validateSaveSchedule;
exports.buildSaveSummary = buildSaveSummary;
exports.summaryContainsForbiddenFraming = summaryContainsForbiddenFraming;
const copy_1 = require("./copy");
function formatAmount(value) {
    if (!Number.isFinite(value)) {
        return "";
    }
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}
function validateSaveSchedule(intervalDays, reminderTime, startDate) {
    const interval = Number(intervalDays);
    if (!Number.isInteger(interval) || interval < 1) {
        return { ok: false, field: "intervalDays", message: copy_1.SAVE_SCHEDULE_ERROR };
    }
    if (typeof reminderTime !== "string" || !/^\d{2}:\d{2}$/.test(reminderTime)) {
        return { ok: false, field: "reminderTime", message: copy_1.SAVE_SCHEDULE_ERROR };
    }
    if (typeof startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        return { ok: false, field: "startDate", message: copy_1.SAVE_SCHEDULE_ERROR };
    }
    return { ok: true, field: null, message: null };
}
function buildSaveSummary(input) {
    const unit = input.unitLabel || "";
    const rows = [
        { label: "Name", value: input.name },
        { label: "Vial amount", value: `${formatAmount(input.vialAmount)} ${unit}`.trim() },
        { label: "Entered dose", value: `${formatAmount(input.doseAmount)} ${unit}`.trim() },
        { label: "BAC water", value: `${formatAmount(input.waterMl)} mL` },
        { label: "Draw volume", value: `${formatAmount(input.doseMl)} mL` },
    ];
    if (Number.isFinite(input.insulinUnits) && input.insulinUnits !== null) {
        rows.push({ label: "U-100 units", value: formatAmount(input.insulinUnits) });
    }
    rows.push({
        label: "Concentration",
        value: `${formatAmount(input.concentrationPerMl)} ${unit}/mL`.trim(),
    });
    rows.push({
        label: "Schedule",
        value: `Every ${input.intervalDays} day${input.intervalDays === 1 ? "" : "s"} at ${input.reminderTime}, starting ${input.startDate}`,
    });
    return {
        title: "Confirm fill",
        rows,
        disclaimer: copy_1.SAVE_DISCLAIMER,
    };
}
function summaryContainsForbiddenFraming(summary) {
    const blob = `${summary.title} ${summary.disclaimer} ${summary.rows
        .map((row) => `${row.label} ${row.value}`)
        .join(" ")}`.toLowerCase();
    return (blob.includes("recommend" + "ed") ||
        blob.includes("typical dose") ||
        blob.includes("prescribed") ||
        blob.includes("therapeutic"));
}

  })(
    modules["ux/save-summary"].exports,
    createRequire(modules["ux/save-summary"].dirname),
    modules["ux/save-summary"],
    "ux"
  );


  (function (exports, require, module, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHARACTERIZED_DEFAULTS = void 0;
exports.characterizedDefaults = characterizedDefaults;
exports.normalizeWizardValue = normalizeWizardValue;
exports.parsePositiveNumber = parsePositiveNumber;
exports.isWizardDirty = isWizardDirty;
exports.validateWizardStep = validateWizardStep;
exports.firstInvalidField = firstInvalidField;
exports.discardWizardDraft = discardWizardDraft;
const copy_1 = require("./copy");
exports.CHARACTERIZED_DEFAULTS = {
    doseUnit: "mg",
    vialAmount: "30",
    doseAmount: "3",
    syringeMax: "1",
    maxWaterMl: "3",
};
function characterizedDefaults() {
    return {
        doseUnit: exports.CHARACTERIZED_DEFAULTS.doseUnit,
        vialAmount: exports.CHARACTERIZED_DEFAULTS.vialAmount,
        doseAmount: exports.CHARACTERIZED_DEFAULTS.doseAmount,
        syringeMax: exports.CHARACTERIZED_DEFAULTS.syringeMax,
        maxWaterMl: exports.CHARACTERIZED_DEFAULTS.maxWaterMl,
    };
}
function normalizeWizardValue(value) {
    return String(value ?? "").trim();
}
function parsePositiveNumber(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
}
function isWizardDirty(current, baseline) {
    return (normalizeWizardValue(current.doseUnit) !== normalizeWizardValue(baseline.doseUnit) ||
        normalizeWizardValue(current.vialAmount) !== normalizeWizardValue(baseline.vialAmount) ||
        normalizeWizardValue(current.doseAmount) !== normalizeWizardValue(baseline.doseAmount) ||
        normalizeWizardValue(current.syringeMax) !== normalizeWizardValue(baseline.syringeMax) ||
        normalizeWizardValue(current.maxWaterMl) !== normalizeWizardValue(baseline.maxWaterMl));
}
function numberFieldError(field, raw) {
    if (parsePositiveNumber(raw) === null) {
        return { field, message: copy_1.FIELD_NUMBER_ERROR };
    }
    return null;
}
function validateWizardStep(step, values) {
    const errors = [];
    if (step === 1) {
        const vialError = numberFieldError("vialAmount", values.vialAmount);
        if (vialError) {
            errors.push(vialError);
        }
    }
    if (step === 2) {
        const doseError = numberFieldError("doseAmount", values.doseAmount);
        if (doseError) {
            errors.push(doseError);
        }
        else {
            const dose = Number(values.doseAmount);
            const vial = parsePositiveNumber(values.vialAmount);
            if (vial !== null && dose > vial) {
                errors.push({ field: "doseAmount", message: copy_1.FIELD_DOSE_GT_VIAL_ERROR });
            }
        }
    }
    if (step === 3) {
        const syringeError = numberFieldError("syringeMax", values.syringeMax);
        if (syringeError) {
            errors.push(syringeError);
        }
        const waterError = numberFieldError("maxWaterMl", values.maxWaterMl);
        if (waterError) {
            errors.push(waterError);
        }
    }
    return { ok: errors.length === 0, errors };
}
function firstInvalidField(result) {
    return result.errors[0]?.field ?? null;
}
function discardWizardDraft() {
    return characterizedDefaults();
}

  })(
    modules["ux/wizard"].exports,
    createRequire(modules["ux/wizard"].dirname),
    modules["ux/wizard"],
    "ux"
  );

  root.FitGenP0Ux = modules["ux/index"].exports;
})(typeof window !== "undefined" ? window : globalThis);

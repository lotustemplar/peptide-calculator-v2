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
exports.undoTaken = exports.reloadSnapshot = exports.materializeLegacyTakenDates = exports.markTaken = exports.lookupOccurrence = exports.explicitLegacyTakenDates = exports.toWriterSnapshot = exports.resolveTimeZone = exports.resolveScheduleFillId = exports.mirrorTakenDate = exports.isScheduleTakenOnDate = exports.hydrateLegacyOccurrences = exports.fillToDepletion = exports.createTakenAdapter = exports.canUndoTaken = exports.applyWriterSnapshot = exports.snapshotEqual = exports.readAppState = exports.hydrateLegacyMirrors = exports.emptyAppState = exports.commitAppState = exports.cloneAppState = exports.SCHEDULES_STORAGE_KEY = exports.PERSIST_WRITE_STEPS = void 0;
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

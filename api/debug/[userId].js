"use strict";

const { handleDebug, withHttp } = require("../../backend/app");

module.exports = withHttp(handleDebug);

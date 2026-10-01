"use strict";

const { handleSync, withHttp } = require("../../backend/app");

module.exports = withHttp(handleSync);

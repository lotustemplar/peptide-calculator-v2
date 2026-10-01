"use strict";

const { handleHealth, withHttp } = require("../backend/app");

module.exports = withHttp(handleHealth);

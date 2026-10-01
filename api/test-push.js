"use strict";

const { handleTestPush, withHttp } = require("../backend/app");

module.exports = withHttp(handleTestPush);

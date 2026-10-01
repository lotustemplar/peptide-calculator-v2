"use strict";

require("dotenv").config();

const { app } = require("./app");

const PORT = Number(process.env.PORT || 8787);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Peptide Calculator backend listening on port ${PORT}`);
  });
}

module.exports = app;

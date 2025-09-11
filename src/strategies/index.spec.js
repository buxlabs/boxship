const test = require("node:test");
const assert = require("node:assert");
const strategies = require(".");

test("it exposes strategies", () => {
  assert(strategies.MyDevilNet);
});

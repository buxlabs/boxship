const test = require("node:test");
const assert = require("node:assert");
const deploy = require("./deploy");
const Strategy = require("./Strategy");

test("it deploys using given strategy", () => {
  let copied = false;
  class Subject extends Strategy {
    copy() {
      copied = true;
    }
  }
  deploy({}, Subject);
  assert(copied);
});

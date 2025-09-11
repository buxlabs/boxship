const test = require("node:test");
const assert = require("node:assert");
const Strategy = require("./Strategy");

test("it deploys", () => {
  let cleaned = false;
  let copied = false;
  class Subject extends Strategy {
    clean() {
      cleaned = true;
    }
    copy() {
      copied = true;
    }
  }
  let subject = new Subject({});
  subject.deploy();
  assert(cleaned);
  assert(copied);
});

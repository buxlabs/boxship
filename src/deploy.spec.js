const test = require("ava");
const deploy = require("./deploy");
const Strategy = require("./Strategy");

test("it deploys using given strategy", (t) => {
  let copied = false;
  class Subject extends Strategy {
    copy() {
      copied = true;
    }
  }
  deploy({}, Subject);
  t.truthy(copied);
});

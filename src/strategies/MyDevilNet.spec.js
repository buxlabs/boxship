const test = require("node:test");
const assert = require("node:assert");
const sinon = require("sinon");
const MyDevilNetStrategy = require("./MyDevilNet");

test("it cleans files via a ssh exec command", () => {
  let spy = sinon.spy();
  let subject = new MyDevilNetStrategy({
    username: "user",
    host: "s1.mydevil.net",
    domain: "buxlabs.pl",
    location: "~/domains/buxlabs.pl/public_nodejs",
    exec: spy,
  });
  subject.clean();
  assert(
    spy.calledWith(
      `ssh -l user s1.mydevil.net 'rm -rf ~/domains/buxlabs.pl/public_nodejs/*'`
    )
  );
});

test("it copies files via a scp exec command", () => {
  let spy = sinon.spy();
  let subject = new MyDevilNetStrategy({
    username: "user",
    host: "s1.mydevil.net",
    domain: "buxlabs.pl",
    location: "~/domains/buxlabs.pl/public_nodejs",
    exec: spy,
  });
  subject.copy();
  assert(
    spy.calledWith(
      `rsync -avz -e ssh * user@s1.mydevil.net:~/domains/buxlabs.pl/public_nodejs`
    )
  );
});

test("it can exclude a single dir when copying", () => {
  let spy = sinon.spy();
  let subject = new MyDevilNetStrategy({
    username: "user",
    host: "s1.mydevil.net",
    domain: "buxlabs.pl",
    location: "~/domains/buxlabs.pl/public_nodejs",
    exclude: "node_modules",
    exec: spy,
  });
  subject.copy();
  assert(
    spy.calledWith(
      `rsync -avz -e ssh --exclude='node_modules' * user@s1.mydevil.net:~/domains/buxlabs.pl/public_nodejs`
    )
  );
});

test("it can exclude multiple dirs when copying", () => {
  let spy = sinon.spy();
  let subject = new MyDevilNetStrategy({
    username: "user",
    host: "s1.mydevil.net",
    domain: "buxlabs.pl",
    location: "~/domains/buxlabs.pl/public_nodejs",
    exclude: "node_modules,test",
    exec: spy,
  });
  subject.copy();
  assert(
    spy.calledWith(
      `rsync -avz -e ssh --exclude={'node_modules','test'} * user@s1.mydevil.net:~/domains/buxlabs.pl/public_nodejs`
    )
  );
});

test("it installs packages via npm", () => {
  let spy = sinon.spy();
  let subject = new MyDevilNetStrategy({
    username: "user",
    host: "s1.mydevil.net",
    domain: "buxlabs.pl",
    location: "~/domains/buxlabs.pl/public_nodejs",
    exec: spy,
  });
  subject.install();
  assert(
    spy.calledWith(
      `ssh -l user s1.mydevil.net 'cd ~/domains/buxlabs.pl/public_nodejs && npm install --production --omit=dev --silent --no-optional'`
    )
  );
});

test("it restarts server via a ssh exec command", () => {
  let spy = sinon.spy();
  let subject = new MyDevilNetStrategy({
    username: "user",
    host: "s1.mydevil.net",
    domain: "buxlabs.pl",
    location: "~/domains/buxlabs.pl/public_nodejs",
    exec: spy,
  });
  subject.restart();
  assert(
    spy.calledWith(`ssh -l user s1.mydevil.net 'devil www restart buxlabs.pl'`)
  );
});

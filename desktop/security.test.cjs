const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function launch() {
  const events = {};
  const session = {};
  const loaded = [];
  let options;
  let popup;
  const contents = {
    session: {
      setPermissionRequestHandler(fn) { session.request = fn; },
      setPermissionCheckHandler(fn) { session.check = fn; },
      on(name, fn) { session[name] = fn; }
    },
    on(name, fn) { events[name] = fn; },
    setWindowOpenHandler(fn) { popup = fn; },
    loadURL(url) { loaded.push(url); return Promise.resolve(); }
  };
  const electron = {
    app: { enableSandbox() {}, requestSingleInstanceLock: () => true, on() {}, whenReady: () => ({ then: (fn) => fn() }) },
    BrowserWindow: class {
      constructor(config) { options = config; this.webContents = contents; }
      loadURL(url) { return contents.loadURL(url); }
      loadFile(file) { loaded.push(file); return Promise.resolve(); }
    },
    Menu: { buildFromTemplate: (template) => template, setApplicationMenu() {} },
    dialog: { showMessageBox() {} }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8"), {
    require: (name) => name === "electron" ? electron : require(name), URL, __dirname
  });
  return { events, session, loaded, options, popup: (url) => popup({ url }) };
}

test("remote page has no native bridge and all device permissions are denied", () => {
  const { options, session, loaded } = launch();
  assert.equal(loaded[0], "https://www.burgerbudds.in/merchant");
  assert.equal(options.webPreferences.nodeIntegration, false);
  assert.equal(options.webPreferences.contextIsolation, true);
  assert.equal(options.webPreferences.sandbox, true);
  assert.equal(options.webPreferences.webSecurity, true);
  assert.equal(options.webPreferences.preload, undefined);
  let allowed;
  session.request(null, "media", (value) => { allowed = value; });
  assert.equal(allowed, false);
  assert.equal(session.check(), false);
});

test("navigation and redirects reject lookalike hosts, unsafe protocols and credentials", () => {
  const { events } = launch();
  for (const eventName of ["will-navigate", "will-redirect", "will-frame-navigate"]) {
    for (const url of ["https://www.burgerbudds.in.evil.com/", "http://www.burgerbudds.in/", "file:///C:/Windows/", "javascript:alert(1)", "https://user@www.burgerbudds.in/", "https://evil.com/"]) {
      let prevented = false;
      events[eventName]({ preventDefault() { prevented = true; } }, url);
      assert.equal(prevented, true, `${eventName}: ${url}`);
    }
    events[eventName]({ preventDefault() { assert.fail("trusted navigation blocked"); } }, "https://www.burgerbudds.in/admin");
  }
});

test("popups never create a window; only trusted links load in the existing window", () => {
  const runtime = launch();
  assert.equal(runtime.popup("https://evil.com/").action, "deny");
  assert.equal(runtime.loaded.length, 1);
  assert.equal(runtime.popup("https://www.burgerbudds.in/track/123").action, "deny");
  assert.equal(runtime.loaded[1], "https://www.burgerbudds.in/track/123");
});

test("network failure shows local recovery page without a recursive fallback", () => {
  const { events, loaded } = launch();
  events["did-fail-load"]({}, -105, "offline", "https://www.burgerbudds.in/merchant", true);
  assert.equal(loaded[1], path.join(__dirname, "offline.html"));
  events["did-fail-load"]({}, -6, "missing", "file:///offline.html", true);
  events["did-fail-load"]({}, -3, "aborted", "https://www.burgerbudds.in/merchant", true);
  assert.equal(loaded.length, 2);
});

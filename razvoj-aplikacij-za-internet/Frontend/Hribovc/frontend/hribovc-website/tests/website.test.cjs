const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("website ima osnovne frontend datoteke", () => {
  assert.ok(fs.existsSync(path.join(root, "package.json")), "package.json mora obstajati");
  assert.ok(fs.existsSync(path.join(root, "index.html")), "index.html mora obstajati");
  assert.ok(fs.existsSync(path.join(root, "src")), "src mapa mora obstajati");
});

test("package.json ima build skripto", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

  assert.ok(pkg.scripts, "package.json mora imeti scripts");
  assert.ok(pkg.scripts.build, "package.json mora imeti build skripto");
});
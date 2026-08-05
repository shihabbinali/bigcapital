#!/usr/bin/env node
/**
 * Re-applies bun-compatibility patches to installed dependencies.
 *
 * These are hand-patches to node_modules files that are wiped on any
 * reinstall. They are required for `bunx --bun jest` to pass (Phase 0 gate).
 *
 * 1. jest-runtime: "Attempted to assign to readonly property" — bun's
 *    node:module Module class has readonly statics (e.g. `prototype`), so
 *    `Object.entries(Module).forEach(([k,v]) => { Module[k] = v })` throws.
 *    Use Object.defineProperty instead (fix from bun issue #16933).
 * 2. depd: "callSite.getFileName is not a function" — inside jest's vm
 *    sandbox bun's Error.captureStackTrace returns plain strings instead of
 *    CallSite objects. Guard callSiteLocation accordingly.
 *
 * Files live under pnpm's `.pnpm/<pkg>@<ver>/node_modules/<pkg>/` layout or
 * bun's `.bun/<pkg>@<ver>/node_modules/<pkg>/` layout — resolved via
 * require.resolve (falls back to a node_modules search).
 */
'use strict';

const fs = require('fs');
const path = require('path');

function findPackage(pkgName, subPath) {
  // 1) resolve via require in the repo root context
  try {
    const resolved = require.resolve(path.posix.join(pkgName, subPath), {
      paths: [path.join(__dirname, '..', 'packages/server')],
    });
    return fs.realpathSync(resolved);
  } catch {
    // fall through to a scan of node_modules/{.bun,.pnpm}
  }
  // 2) scan the two known store layouts
  const root = path.join(__dirname, '..', 'node_modules');
  for (const storeDir of ['.bun', '.pnpm']) {
    const store = path.join(root, storeDir);
    if (!fs.existsSync(store)) continue;
    const prefix = `${pkgName}@`;
    let entries = [];
    try {
      entries = fs.readdirSync(store);
    } catch {
      continue;
    }
    const match = entries.find((e) => e.startsWith(prefix));
    if (!match) continue;
    const candidate = path.join(store, match, 'node_modules', pkgName, subPath);
    if (fs.existsSync(candidate)) return fs.realpathSync(candidate);
  }
  return null;
}

const ROOT = path.join(__dirname, '..');
const PATCHES = [
  {
    name: 'jest-runtime (readonly Module statics)',
    file: findPackage('jest-runtime', 'build/index.js'),
    old: `    Object.entries(_module().default.Module).forEach(([key, value]) => {
      // @ts-expect-error: no index signature
      Module[key] = value;
    });`,
    next: `    Object.entries(_module().default.Module).forEach(([key, value]) => {
      const desc = Object.getOwnPropertyDescriptor(Module, key) || {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      };
      // @ts-expect-error: no index signature
      Object.defineProperty(Module, key, desc);
    });`,
  },
  {
    name: 'depd (CallSite vs string stack frames)',
    file: findPackage('depd', 'index.js'),
    old: `function callSiteLocation (callSite) {
  var file = callSite.getFileName() || '<anonymous>'`,
    next: `function callSiteLocation (callSite) {
  if (callSite === null || typeof callSite.getFileName !== 'function') {
    return ['<anonymous>', 0, 0]
  }
  var file = callSite.getFileName() || '<anonymous>'`,
  },
];

let changed = 0;
for (const patch of PATCHES) {
  if (!patch.file) {
    console.error(`[patch-node-modules] FAIL ${patch.name}: package not found in node_modules`);
    process.exitCode = 1;
    continue;
  }
  const content = fs.readFileSync(patch.file, 'utf8');
  if (content.includes(patch.next)) {
    console.log(`[patch-node-modules] ok (already applied): ${patch.name}`);
    continue;
  }
  if (!content.includes(patch.old)) {
    console.error(`[patch-node-modules] FAIL ${patch.name}: original snippet not found at ${patch.file}`);
    process.exitCode = 1;
    continue;
  }
  fs.writeFileSync(patch.file, content.replace(patch.old, patch.next));
  console.log(`[patch-node-modules] applied: ${patch.name}`);
  changed += 1;
}

console.log(`[patch-node-modules] done (${changed} applied)`);

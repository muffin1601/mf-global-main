// Regenerates src/legacy-marketing from the original MERN frontend.
//
// The original React marketing site is the single source of truth. This script
// copies its components, pages and CSS byte-for-byte (UTF-8, BOM stripped) and
// applies only the mechanical changes Next.js needs:
//   - a "use client" directive on every JS/JSX module
//   - react-router-dom imports -> the local Next.js router shim (../router)
//   - flattened import paths (components/, pages/, styles/)
//   - import.meta.env.VITE_API_URL -> same-origin "/api"
//   - Vite public-asset imports -> plain URL string constants
//   - lucide-react -> lucide-react-legacy (npm alias pinned to the original 0.525.0)
// Swiper intentionally stays on the app's patched version: the original 11.2.10
// has a critical advisory (GHSA-hmx5-qpq5-p643) and v14 measured identical layout.
//
// Usage: node scripts/sync-legacy-marketing.mjs [path-to-original-frontend]
// The original frontend is only read, never written.

import { mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(process.argv[2] ?? join(root, "..", "frontend"));
const target = join(root, "src", "legacy-marketing");

const sources = {
  components: join(source, "src", "components", "main"),
  pages: join(source, "src", "pages", "main"),
  styles: join(source, "src", "styles", "main"),
};

// Unit tests target Vitest/jsdom in the original app and are not part of the site.
const skip = new Set(["Careers.test.jsx"]);

const transforms = [
  [/(["'])\.\.\/\.\.\/components\/main\//g, "$1../components/"],
  [/(["'])\.\.\/\.\.\/styles\/main\//g, "$1../styles/"],
  [/(["'])\.\/(Careers|CareersAdmin|CareerRichText)\.css\1/g, "$1../styles/$2.css$1"],
  [/from\s+(["'])react-router-dom\1/g, 'from "../router"'],
  // The CRM uses a newer lucide-react whose icon artwork differs; the marketing
  // site keeps the original 0.525.0 artwork via the lucide-react-legacy alias.
  [/from\s+(["'])lucide-react\1/g, 'from "lucide-react-legacy"'],
  [/\$\{\(import\.meta\.env\.VITE_API_URL \|\| '\/api'\)\.replace\(\/\\\/\+\$\/, ''\)\}/g, "/api"],
  [/\$\{import\.meta\.env\.VITE_API_URL\}/g, "/api"],
  [/^import\s+(\w+)\s+from\s+(["'])(\/assets\/[^"']+)\2;?/gm, 'const $1 = "$3";'],
];

const read = (file) => readFileSync(file, "utf8").replace(/^﻿/, "");

function convertModule(code, file) {
  let output = code;
  for (const [pattern, replacement] of transforms) output = output.replace(pattern, replacement);
  if (/import\.meta\.env/.test(output)) throw new Error(`Unhandled import.meta.env in ${file}`);
  if (/react-router-dom/.test(output)) throw new Error(`Unhandled react-router-dom import in ${file}`);
  const eol = output.includes("\r\n") ? "\r\n" : "\n";
  return `"use client";${eol}${output}`;
}

let written = 0;
for (const dir of ["components", "pages", "styles"]) mkdirSync(join(target, dir), { recursive: true });

for (const kind of ["components", "pages"]) {
  for (const name of readdirSync(sources[kind])) {
    if (skip.has(name)) continue;
    const from = join(sources[kind], name);
    if (name.endsWith(".css")) {
      copyFileSync(from, join(target, "styles", name));
    } else if (/\.(jsx?|tsx?)$/.test(name)) {
      writeFileSync(join(target, kind, name), convertModule(read(from), from), "utf8");
    } else continue;
    written++;
  }
}

for (const name of readdirSync(sources.styles)) {
  if (!name.endsWith(".css")) continue;
  copyFileSync(join(sources.styles, name), join(target, "styles", name));
  written++;
}

console.log(`Synced ${written} legacy marketing files from ${source}`);

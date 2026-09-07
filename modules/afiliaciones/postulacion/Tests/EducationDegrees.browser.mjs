// Run with the local Next server available on localhost:3000.
// Reads the real public catalog; UI save and persistence writes are test doubles.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";
import puppeteer from "puppeteer";

const require = createRequire(import.meta.url);
const response = await fetch("http://localhost:3000/api/catalogs/degrees");
assert.equal(response.status, 200);
const { data: degrees } = await response.json();
const expected = { Bachiller: "BACHELOR", Técnico: "TECHNICAL", "Título profesional": "OTHER", Maestría: "MASTER", Doctorado: "DOCTORATE", Otro: "OTHER" };
assert.equal(degrees.length, 6);
assert.deepEqual(degrees.map(item => item.name).sort(), Object.keys(expected).sort());
for (const degree of degrees) assert.equal(degree.studyLevel, expected[degree.name]);
console.log("PASS endpoint: six active canonical degrees, expected studyLevel, no legacy values");

const cwd = process.cwd();
const ui = await build({ stdin: { resolveDir: cwd, loader: "tsx", contents: `
  import React, {createRef} from "react";
  import {createRoot} from "react-dom/client";
  import EducationStep from "./modules/afiliaciones/postulacion/Components/ApplicationStepper/EducationStep";
  window.fetch = async url => ({ok: true, json: async () => url === "/api/catalogs/degrees" ? {data: ${JSON.stringify(degrees)}} : [{id: 1, name: "Test catalog"}]});
  const ref = createRef(); window.submitStudy = () => ref.current.submit();
  createRoot(document.getElementById("app")).render(<EducationStep ref={ref} membershipType="ACTIVE"
    value={[{institutionId: 1, specialtyId: 77, specialty: "Original specialty", degreeTitle: "Original degree title"}]}
    onSave={async value => {window.savedStudy = value[0];}} onNext={() => {}} onBack={() => {}} />);
` }, bundle: true, write: false, format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"', "process.env": "{}" } });
const browser = await puppeteer.launch({headless: true});
const saved = [];
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => { errors.push(error.message); console.error(error.message); });
  await page.setContent('<div id="app"></div>');
  await page.addScriptTag({content: ui.outputFiles[0].text});
  let currentLabel = "Seleccione grado";
  for (const degree of degrees) {
    await page.waitForFunction(label => [...document.querySelectorAll("span.truncate")].some(span => span.textContent === label), {}, currentLabel);
    await page.evaluate(label => [...document.querySelectorAll("span.truncate")].find(span => span.textContent === label).parentElement.click(), currentLabel);
    await page.waitForSelector('input[placeholder="Buscar..."]');
    const options = await page.$$eval("div.overflow-y-auto span", elements => elements.map(element => element.textContent));
    assert.deepEqual(options.sort(), Object.keys(expected).sort());
    await page.evaluate(name => [...document.querySelectorAll("div.overflow-y-auto span")].find(span => span.textContent === name).parentElement.click(), degree.name);
    await page.waitForFunction(name => [...document.querySelectorAll("span.truncate")].some(span => span.textContent === name), {}, degree.name);
    const study = await page.evaluate(async () => { await window.submitStudy(); return window.savedStudy; });
    assert.equal(study?.degreeId, degree.id);
    assert.equal(study.specialtyId, 77);
    assert.equal(study.degreeTitle, "Original degree title");
    saved.push(study);
    currentLabel = degree.name;
  }
  assert.deepEqual(errors, []);
  console.log("PASS browser: six selectable degrees; save preserves degreeId, independent specialtyId and degreeTitle");
} finally { await browser.close(); }

const server = await build({stdin: {resolveDir: cwd, loader: "ts", contents: 'export {ApplicationRepository} from "./modules/afiliaciones/postulacion/Repositories/ApplicationRepository"; export {prisma} from "./lib/prisma";'}, bundle: true, write: false, platform: "node", format: "cjs", packages: "external"});
const module = {exports: {}};
new Function("require", "module", "exports", server.outputFiles[0].text)(require, module, module.exports);
const {ApplicationRepository, prisma} = module.exports;
try {
  const persisted = [];
  const tx = {
    academicDegree: {findUnique: async ({where}) => ({...degrees.find(degree => degree.id === where.id), isActive: true})},
    academicInfo: {deleteMany: async () => {}, create: async ({data}) => {persisted.push(data);}},
  };
  await new ApplicationRepository().persistAcademicInfos(tx, 1, {draftData: {academicStudies: saved}});
  for (const row of persisted) {
    assert.equal(row.studyLevel, degrees.find(degree => degree.id === row.degreeId).studyLevel);
    assert.equal(row.specialtyId, 77);
    assert.equal(row.degreeTitle, "Original degree title");
  }
  assert.equal(persisted.length, 6);
  console.log("PASS repository: studyLevel derived from degreeId for all six; specialtyId/degreeTitle unchanged; no DB writes");
} finally { await prisma.$disconnect(); }

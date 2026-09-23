// Real Postulación/Consulta entry points and shared gate; HTTP and payment boundary are local doubles.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import puppeteer from "puppeteer";
const cwd = process.cwd();
const stepPath = "modules/afiliaciones/postulacion/Components/ApplicationStepper/PersonalDataStep.tsx";
const step = await readFile(stepPath, "utf8");
const defaults = step.match(/const emptyPersonalInformation: PersonalInformation = (\{[\s\S]*?\n\});/)[1];
const bundle = await build({ stdin: { resolveDir: cwd, loader: "tsx", contents: `
  import React from "react";
  import { createRoot } from "react-dom/client";
  import PersonalDataStep from "./${stepPath}";
  import { ConsultaView } from "./modules/afiliaciones/consulta/Views/ConsultaView";
  const channels = [{ channel: "EMAIL", destination: "m***@example.com" }];
  window.fixture.challenge = { hasApplication: window.fixture.status !== null, requiresVerification: window.fixture.status !== null, context: "opaque", channels, options: [{context: "opaque", channels}] };
  window.fixture.verified = false; window.fixture.detailCalls = 0; window.fixture.lookupCalls = 0; window.fixture.lookupBody = null;
  const summary = {id: 7, affiliateType: "ACTIVE", createdAt: "2026-08-01T12:00:00Z", status: window.fixture.status, canStartNew: window.fixture.canStartNew, recoveryUrl: window.fixture.status === "DRAFT" ? "/postulacion/asociado?trackingCode=private-7" : null};
  window.fetch = async (url, options = {}) => { let data = [];
    if (url.includes("validate-document")) data = window.fixture.challenge;
    else if (url === "/api/consulta/verification") { window.fixture.lookupCalls++; window.fixture.lookupBody = JSON.parse(options.body); data = window.fixture.challenge; }
    else if (url.includes("verify-otp")) { window.fixture.verified = true; data = {success: true}; }
    else if (url === "/api/consulta/applications") { if (!window.fixture.verified) throw Error("Unverified list"); data = window.fixture.multiple ? [summary, {...summary, id: 8, status: "REJECTED"}] : [summary]; }
    else if (url.startsWith("/api/consulta?")) { if (!window.fixture.verified) throw Error("Unverified detail"); window.fixture.detailCalls++; data = {...summary, applicationId: 7, applicationCode: "EXP-7", applicantName: "Authorized applicant", areas: {}, observations: [], pendingObservations: [], draftData: {}}; }
    return {ok: true, status: 200, json: async () => data};
  };
  createRoot(document.getElementById("app")).render(window.fixture.context === "POSTULACION" ? <PersonalDataStep value={{...${defaults}, documentType: "DNI", documentNumber: "12345678"}} onSave={async () => {}} onNext={() => {}} /> : <ConsultaView />);
` }, bundle: true, write: false, format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' }, plugins: [{name: "test-boundaries", setup(builder) {
  builder.onResolve({filter: /^(next\/image|next\/link|next\/navigation)$|\/StatusPaymentReady$/}, args => ({path: args.path, namespace: "boundary"}));
  builder.onLoad({filter: /.*/, namespace: "boundary"}, args => ({loader: "jsx", resolveDir: cwd, contents: args.path.endsWith("StatusPaymentReady") ? 'export function StatusPaymentReady() { return <div data-payment="existing">Existing payment flow</div>; }' : args.path === "next/navigation" ? 'export const useRouter = () => ({push(url) { location.href = url; }});' : 'import React from "react"; export default function Wrapper({priority, ...props}) { return React.createElement("a", props); }'}));
}}] });
const browser = await puppeteer.launch({headless: true, args: ["--no-sandbox", "--disable-gpu"]});
const clickText = async (page, label) => {
  const clicked = await page.evaluate(label => { const button = [...document.querySelectorAll("button")].find(button => button.textContent.trim().toLowerCase().startsWith(label.toLowerCase())); if (!button) return false; button.click(); return true; }, label);
  assert.equal(clicked, true, `Button ${label}`);
};
const titles = {
  POSTULACION: {DRAFT: "Tienes una postulación pendiente de completar", PENDING: "Ya tienes una postulación registrada", UNDER_EVALUACION: "Tu postulación está en evaluación", OBSERVED: "Tu postulación tiene observaciones", RESOLVED: "Tus observaciones ya fueron subsanadas", READY_FOR_PAYMENT: "Tu postulación fue aprobada", COMPLETED: "Tu proceso de afiliación ya fue completado", REJECTED: "Tu postulación anterior fue rechazada"},
  CONSULTA: {DRAFT: "Tu postulación aún no ha sido enviada", PENDING: "Solicitud recibida", UNDER_EVALUACION: "En evaluación", OBSERVED: "Tienes observaciones pendientes", RESOLVED: "Subsanación enviada", READY_FOR_PAYMENT: "Existing payment flow", COMPLETED: "Proceso completado", REJECTED: "Postulación rechazada"},
};
let cases = 0;
try {
  for (const context of ["POSTULACION", "CONSULTA"]) for (const status of [...Object.keys(titles[context]), null, "UNKNOWN"]) {
    const page = await browser.newPage(); const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on("request", request => void request.respond({status: 200, contentType: "text/html", body: '<html><body><div id="app"></div></body></html>'}));
    await page.goto("http://matrix.test/");
    await page.evaluate(fixture => {window.fixture = fixture;}, {context, status, canStartNew: status === "REJECTED"});
    await page.addScriptTag({content: bundle.outputFiles[0].text});
    if (context === "POSTULACION") {
      await page.waitForSelector('input[placeholder="Ingrese número de documento"]');
      await page.$eval('input[placeholder="Ingrese número de documento"]', input => input.nextElementSibling.click());
    } else {
      await page.type('input[placeholder="Ingrese su número de documento"]', "12345678");
      await page.$eval("form", form => form.requestSubmit());
      assert.equal(await page.evaluate(() => window.fixture.lookupCalls), 0);
      await page.waitForSelector('#consultation-email');
      await page.type('#consultation-email', "maria@example.com");
      await page.$eval("form", form => form.requestSubmit());
      assert.equal(await page.evaluate(() => window.fixture.lookupCalls), 1);
      assert.deepEqual(await page.evaluate(() => window.fixture.lookupBody), {documentType: "DNI", documentNumber: "12345678", email: "maria@example.com"});
    }
    if (status !== null) {
      await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.textContent.includes("Verifica tu identidad"));
      assert.equal(await page.evaluate(() => window.fixture.detailCalls), 0);
      await clickText(page, "Enviar código por");
      await page.waitForSelector('input[aria-label="Código de verificación"]');
      await page.type('input[aria-label="Código de verificación"]', "123456");
      await clickText(page, "Validar código");
    }
    const title = status === null ? context === "POSTULACION" ? "Puedes iniciar una nueva postulación" : "No encontramos una solicitud registrada" : status === "UNKNOWN" ? "No pudimos determinar el estado actual" : titles[context][status];
    await page.waitForFunction(title => document.body.textContent.includes(title), {}, title);
    if (context === "POSTULACION") assert.equal(await page.evaluate(() => window.fixture.detailCalls), 0);
    if (context === "CONSULTA" && status === "DRAFT") {
      const body = await page.evaluate(() => document.body.textContent);
      for (const forbidden of ["Área de Asociados", "Pago de Incorporación", "Revisar y subsanar", "Estado de tu Expediente"]) assert.equal(body.includes(forbidden), false);
      await Promise.all([page.waitForNavigation(), clickText(page, "Continuar mi postulación")]);
      assert.equal(page.url(), "http://matrix.test/postulacion/asociado?trackingCode=private-7");
    }
    if (context === "CONSULTA" && ["PENDING", "UNDER_EVALUACION", "RESOLVED", "COMPLETED"].includes(status)) {
      assert.equal(await page.$('[data-payment="existing"]'), null);
      assert.equal(await page.$('input'), null);
    }
    if (context === "CONSULTA" && status === "OBSERVED") {
      await clickText(page, "Revisar y subsanar");
      assert.equal(await page.$('[data-payment="existing"]'), null);
    }
    assert.deepEqual(errors, []);
    console.log(`PASS ${context}: ${status ?? "NO_APPLICATION"}`); cases++; await page.close();
  }
  for (const context of ["POSTULACION", "CONSULTA"]) {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", request => void request.respond({status: 200, contentType: "text/html", body: '<html><body><div id="app"></div></body></html>'}));
    await page.goto("http://matrix.test/");
    await page.evaluate(fixture => { window.fixture = fixture; }, {context, status: "PENDING", multiple: true, canStartNew: false});
    await page.addScriptTag({content: bundle.outputFiles[0].text});
    if (context === "POSTULACION") {
      await page.waitForSelector('input[placeholder="Ingrese número de documento"]');
      await page.$eval('input[placeholder="Ingrese número de documento"]', input => input.nextElementSibling.click());
    } else {
      await page.type('input[placeholder="Ingrese su número de documento"]', "12345678");
      await page.$eval("form", form => form.requestSubmit());
      assert.equal(await page.evaluate(() => window.fixture.lookupCalls), 0);
      await page.waitForSelector('#consultation-email');
      await page.type('#consultation-email', "maria@example.com");
      await page.$eval("form", form => form.requestSubmit());
      assert.equal(await page.evaluate(() => window.fixture.lookupCalls), 1);
      assert.deepEqual(await page.evaluate(() => window.fixture.lookupBody), {documentType: "DNI", documentNumber: "12345678", email: "maria@example.com"});
    }
    await page.waitForSelector('[role="dialog"]');
    await clickText(page, "Enviar código por");
    await page.waitForSelector('input[aria-label="Código de verificación"]');
    await page.type('input[aria-label="Código de verificación"]', "123456");
    await clickText(page, "Validar código");
    await page.waitForFunction(() => document.body.textContent.includes("Selecciona la solicitud"));
    assert.equal(await page.evaluate(() => window.fixture.detailCalls), 0);
    const choices = await page.$$eval('[role="dialog"] button strong', elements => elements.map(element => element.parentElement.textContent));
    assert.equal(choices.length, 2);
    assert.ok(choices[0].includes("Pendiente")); assert.ok(choices[1].includes("Rechazada")); assert.ok(choices[0].includes("2026"));
    await clickText(page, "Asociado activo");
    await page.waitForFunction(title => document.body.textContent.includes(title), {}, titles[context].PENDING);
    assert.equal(await page.evaluate(() => window.fixture.detailCalls), context === "CONSULTA" ? 1 : 0);
    console.log(`PASS ${context}: explicit multiple-application selection`); cases++; await page.close();
  }
  console.log(`PASS ${cases} browser matrix scenarios (local HTTP/payment doubles; no messages or payments sent)`);
} finally { await browser.close(); }

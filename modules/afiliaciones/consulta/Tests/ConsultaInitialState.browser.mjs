// Browser contract for the recovered /consulta first step.
// Run from the repository root: node modules/afiliaciones/consulta/Tests/ConsultaInitialState.browser.mjs
import assert from "node:assert/strict";
import { build } from "esbuild";
import puppeteer from "puppeteer";

const cwd = process.cwd();
const componentPath = "modules/afiliaciones/consulta/Components/ConsultationForm.tsx";
const bundle = await build({
  stdin: {
    resolveDir: cwd,
    loader: "tsx",
    contents: `
      import React from "react";
      import { createRoot } from "react-dom/client";
      import { ConsultationForm } from "./${componentPath}";
      window.testState = { submits: 0, lastQuery: null };
      createRoot(document.getElementById("app")).render(
        <ConsultationForm onSubmit={(query) => { window.testState.submits++; window.testState.lastQuery = query; }} />
      );
    `,
  },
  bundle: true,
  write: false,
  format: "iife",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{
    name: "consulta-browser-boundaries",
    setup(builder) {
      builder.onResolve({ filter: /^next\/link$/ }, (args) => ({
        path: args.path,
        namespace: "test-boundary",
      }));
      builder.onLoad({ filter: /.*/, namespace: "test-boundary" }, () => ({
        loader: "js",
        contents: 'import React from "react"; export default function Link({ children, ...props }) { return React.createElement("a", props, children); }',
        resolveDir: cwd,
      }));
    },
  }],
});

const browser = await puppeteer.launch({
  headless: true,
  timeout: 120000,
  args: process.env.CI === "true" ? ["--no-sandbox", "--disable-setuid-sandbox"] : [],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setContent('<html lang="es"><body><div id="app"></div></body></html>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  try {
    await page.waitForSelector('button[type="submit"]', { timeout: 5000 });
  } catch (error) {
    console.error("Browser render errors:", errors);
    throw error;
  }

  const initial = await page.evaluate(() => {
    const visibleText = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
    };
    const labels = [...document.querySelectorAll("label")].filter(visibleText).map((label) => label.textContent.trim());
    const submit = document.querySelector('button[type="submit"]');
    return {
      labels,
      submitTag: submit?.tagName,
      submitText: submit?.textContent.trim(),
      emailVisible: labels.includes("Correo registrado"),
    };
  });

  assert(initial.labels.includes("Tipo de Documento"));
  assert(initial.labels.includes("Número de Documento"));
  assert.equal(initial.submitTag, "BUTTON");
  assert.match(initial.submitText, /^Consultar Estado/);
  assert.equal(initial.emailVisible, false);

  await page.type('input[type="text"]', "12345678");
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => window.testState.submits === 1, { timeout: 5000 });

  const after = await page.evaluate(() => ({
    submits: window.testState.submits,
    query: window.testState.lastQuery,
    emailVisible: [...document.querySelectorAll("label")].some((label) => label.textContent.trim() === "Correo registrado"),
    bodyText: document.body.innerText,
  }));
  assert.equal(after.submits, 1);
  assert.deepEqual(after.query, { documentType: "DNI", documentNumber: "12345678" });
  assert.equal(Object.prototype.hasOwnProperty.call(after.query, "email"), false);
  assert.equal(after.emailVisible, false);
  assert.doesNotMatch(after.bodyText, /Verifica tu identidad/);
  assert.doesNotMatch(after.bodyText, /Correo registrado/);
  assert.deepEqual(errors, []);

  console.log("PASS /consulta browser contract: single document step, submit payload without email, no second step");
} finally {
  await browser.close();
}

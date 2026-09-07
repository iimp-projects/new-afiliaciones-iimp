// Run from the repository root. Uses the real declaration step/footer/loader;
// persistence callbacks are controlled doubles and never send a real application.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import puppeteer from "puppeteer";

const cwd = process.cwd();
const bundle = await build({
  stdin: { resolveDir: cwd, loader: "tsx", contents: `
    import React, { useRef, useState } from "react";
    import { createRoot } from "react-dom/client";
    import DeclarationStep from "./modules/afiliaciones/postulacion/Components/ApplicationStepper/DeclarationStep";
    import ApplicationFooter from "./modules/afiliaciones/postulacion/Components/Layout/ApplicationFooter";
    window.testState = { next: 0, cancel: 0, previous: 0, saves: 0, submissions: 0 };
    function TestApplication() {
      const step = useRef(null);
      const [saving, setSaving] = useState(false);
      return <div>
        <main style={{ position: "relative", zIndex: 20, transform: "translateY(0)", minHeight: 1800 }}>
          <DeclarationStep ref={step} value={{ firstEndorsement: { sponsorDocumentNumber: "11111111" }, secondEndorsement: { sponsorDocumentNumber: "22222222" }, declarationAccepted: true, declarationDocumentId: "local-test-document" }}
            onBack={() => {}} onNext={() => {}} saving={saving}
            onSave={async () => { window.testState.saves++; }}
            onFinalSubmit={async () => {
              window.testState.submissions++; setSaving(true);
              await new Promise(resolve => { window.finishSubmission = resolve; });
              setSaving(false);
            }} />
        </main>
        <ApplicationFooter currentStep={5} isSubmitting={saving} nextLabel="ENVIAR PARA REVISIÓN"
          onNext={() => { window.testState.next++; step.current.submit(); }}
          onCancel={() => { window.testState.cancel++; }} onPrevious={() => { window.testState.previous++; }} />
      </div>;
    }
    createRoot(document.getElementById("app")).render(<React.StrictMode><TestApplication /></React.StrictMode>);
  ` },
  bundle: true, write: false, format: "iife", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "test-image", setup(builder) {
    builder.onResolve({ filter: /^next\/image$/ }, () => ({ path: "image", namespace: "test-image" }));
    builder.onLoad({ filter: /.*/, namespace: "test-image" }, () => ({ resolveDir: cwd, loader: "js", contents: 'import React from "react"; export default function Image({ priority, ...props }) { return React.createElement("img", props); }' }));
  } }],
});
const css = await postcss([tailwind({ base: cwd })]).process(await readFile(path.join(cwd, "app/globals.css"), "utf8"), { from: path.join(cwd, "app/globals.css") });
const browser = await puppeteer.launch({ headless: true });
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    for (const scroll of [0, 350]) {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewport(viewport);
      await page.setContent('<html><body><div id="app"></div></body></html>');
      await page.addStyleTag({ content: css.css });
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      const footer = '#app [class*="fixed bottom-0"]';
      await page.waitForSelector(`${footer} button`);
      await page.evaluate((y) => window.scrollTo(0, y), scroll);
      const clickButton = async (selector, text, options) => {
        for (const button of await page.$$(selector)) {
          if (await button.evaluate((element, label) => element.textContent.trim().startsWith(label), text)) { await button.click(options); return; }
        }
        throw new Error(`Button missing: ${text}`);
      };
      await clickButton(`${footer} button`, "ENVIAR PARA REVISIÓN");
      await page.waitForSelector('[role="dialog"]');
      const layout = await page.evaluate(() => {
        const root = document.querySelector('[role="dialog"]');
        const rect = root.getBoundingClientRect();
        return { portal: root.parentElement === document.body, z: getComputedStyle(root).zIndex, x: rect.x, y: rect.y, width: rect.width, height: rect.height, bodyOverflow: document.body.style.overflow, inert: document.getElementById("app").inert, scroll: scrollY };
      });
      assert.deepEqual(layout, { portal: true, z: "9998", x: 0, y: 0, width: viewport.width, height: viewport.height, bodyOverflow: "hidden", inert: true, scroll });
      const points = await page.$$eval(`${footer} button`, (buttons) => buttons.map((button) => { const r = button.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
      for (const point of points) {
        assert.equal(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('[role="dialog"]')), point), true);
        await page.mouse.click(point.x, point.y);
      }
      assert.deepEqual(await page.evaluate(() => window.testState), { next: 1, cancel: 0, previous: 0, saves: 0, submissions: 0 });
      for (let i = 0; i < 6; i++) { await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => Boolean(document.activeElement.closest('[role="dialog"]'))), true); }
      await page.mouse.move(5, 5); await page.mouse.wheel({ deltaY: 400 });
      await new Promise(resolve => setTimeout(resolve, 80));
      assert.equal(await page.evaluate(() => scrollY), scroll);
      await clickButton('[role="dialog"] button', "Cancelar y revisar datos");
      await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
      assert.equal(await page.evaluate(() => document.getElementById("app").inert), false);
      assert.equal(await page.evaluate(() => document.body.style.overflow), "");
      assert.equal(await page.evaluate(() => scrollY), scroll);
      await clickButton(`${footer} button`, "Cancelar");
      await clickButton(`${footer} button`, "Anterior");
      assert.deepEqual(await page.evaluate(() => [window.testState.cancel, window.testState.previous]), [1, 1]);
      await clickButton(`${footer} button`, "ENVIAR PARA REVISIÓN");
      await page.waitForSelector('[role="dialog"]');
      await clickButton('[role="dialog"] button', "Sí, enviar solicitud", { clickCount: 2 });
      await page.waitForSelector('[role="status"][aria-busy="true"]');
      await page.waitForFunction(() => window.testState.submissions === 1);
      assert.equal(await page.$('[role="dialog"]'), null);
      const loader = await page.$eval('[role="status"][aria-busy="true"]', (element) => {
        const rect = element.getBoundingClientRect(); return { portal: element.parentElement === document.body, z: getComputedStyle(element).zIndex, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
      assert.deepEqual(loader, { portal: true, z: "9999", x: 0, y: 0, width: viewport.width, height: viewport.height });
      for (const point of points) {
        assert.equal(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('[role="status"][aria-busy="true"]')), point), true);
        await page.mouse.click(point.x, point.y);
      }
      assert.deepEqual(await page.evaluate(() => [window.testState.saves, window.testState.submissions]), [1, 1]);
      await page.evaluate(() => window.finishSubmission());
      await page.waitForFunction(() => !document.querySelector('[role="status"][aria-busy="true"]'));
      assert.deepEqual(errors, []);
      console.log(`PASS Declaration ${viewport.width}x${viewport.height} scroll=${scroll}: footer blocked, scroll/focus locked, cancel restores, double click submits once, loader covers footer`);
      await page.close();
    }
  }
} finally { await browser.close(); }

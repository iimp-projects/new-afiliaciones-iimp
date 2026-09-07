// Run from the repository root: node modules/shared/Components/Tests/VerificationDialog.browser.mjs
// Real Postulación step, footer, modal and Tailwind CSS; OTP/API calls are local doubles.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import puppeteer from "puppeteer";

const cwd = process.cwd();
const stepPath = "modules/afiliaciones/postulacion/Components/ApplicationStepper/PersonalDataStep.tsx";
const step = await readFile(path.join(cwd, stepPath), "utf8");
const defaults = step.match(/const emptyPersonalInformation: PersonalInformation = (\{[\s\S]*?\n\});/)[1];
const bundle = await build({
  stdin: {
    resolveDir: cwd, loader: "tsx", contents: `
      import React from "react";
      import { createRoot } from "react-dom/client";
      import PersonalDataStep from "./${stepPath}";
      import ApplicationFooter from "./modules/afiliaciones/postulacion/Components/Layout/ApplicationFooter";
      window.testState = { next: 0, cancel: 0, sent: 0 };
      window.fetch = async (url) => { if (url.includes("send-otp")) { window.testState.sent++; await new Promise(resolve => setTimeout(resolve, 100)); } return { ok: true, json: async () => [] }; };
      const value = { ...${defaults}, documentType: "DNI", documentNumber: "12345678" };
      createRoot(document.getElementById("app")).render(<React.StrictMode><div>
        <main style={{ position: "relative", zIndex: 20, transform: "translateY(0)", paddingBottom: 150 }}>
          <PersonalDataStep value={value} onSave={async () => {}} onNext={() => { window.testState.next++; }} />
        </main>
        <ApplicationFooter currentStep={1} onNext={() => { window.testState.next++; }} onCancel={() => { window.testState.cancel++; }} />
      </div></React.StrictMode>);
    `,
  },
  bundle: true, write: false, format: "iife", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "local-test-boundaries", setup(builder) {
    builder.onResolve({ filter: /^(next\/image|next\/navigation)$|\/Services\/ApplicationApi$/ }, (args) => ({ path: args.path, namespace: "test-boundary" }));
    builder.onLoad({ filter: /.*/, namespace: "test-boundary" }, (args) => ({ loader: "js", contents:
      args.path === "next/image" ? 'import React from "react"; export default function Image({ priority, ...props }) { return React.createElement("img", props); }' :
      args.path === "next/navigation" ? 'export const useRouter = () => ({ push() {} });' :
      `export const applicationApi = {
        validateDocument: async () => { const channels = [
          { channel: "WHATSAPP", destination: "*** *** 812" }, { channel: "SMS", destination: "*** *** 812" }, { channel: "EMAIL", destination: "m***@example.com" }
        ]; return { hasApplication: true, requiresVerification: true, context: "opaque", channels, options: [{ context: "opaque", channels }] }; },
        sendRecoveryOtp: async () => { window.testState.sent++; await new Promise(resolve => setTimeout(resolve, 100)); },
        verifyRecoveryOtp: async () => ({ success: true })
      };`, resolveDir: cwd,
    }));
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
      await page.waitForFunction(() => document.querySelector('input[placeholder="Ingrese número de documento"]')?.value === "12345678");
      await page.evaluate((y) => window.scrollTo(0, y), scroll);
      const initialY = await page.evaluate(() => window.scrollY);
      assert.equal(initialY, scroll);
      // Trigger the real search callback without the browser auto-scrolling to its button.
      await page.$eval('input[placeholder="Ingrese número de documento"]', (input) => input.nextElementSibling.click());
      await page.waitForSelector('[role="dialog"]');
      const clickDialogButton = async (text) => {
        for (const button of await page.$$('[role="dialog"] button')) {
          if (await button.evaluate((element, label) => element.textContent.trim().startsWith(label), text)) {
            await button.click();
            return;
          }
        }
        throw new Error(`Dialog button not found: ${text}`);
      };

      const assertBlocked = async (phase) => {
        const layout = await page.evaluate(() => {
          const root = document.querySelector('[role="dialog"]');
          const rect = root.getBoundingClientRect();
          const footer = document.querySelector('#app [class*="fixed bottom-0"]');
          return { bodyPortal: root.parentElement === document.body, x: rect.x, y: rect.y, width: rect.width, height: rect.height,
            viewportWidth: innerWidth, viewportHeight: innerHeight, zIndex: getComputedStyle(root).zIndex,
            footerZIndex: getComputedStyle(footer).zIndex, inert: document.getElementById("app").inert,
            scrollY, bodyOverflow: document.body.style.overflow };
        });
        assert.equal(layout.bodyPortal, true, phase);
        assert.equal(layout.zIndex, "9998");
        assert.equal(layout.footerZIndex, "100");
        assert.equal(layout.x, 0); assert.equal(layout.y, 0);
        assert.equal(layout.width, layout.viewportWidth); assert.equal(layout.height, layout.viewportHeight);
        assert.equal(layout.scrollY, initialY);
        assert.equal(layout.inert, true); assert.equal(layout.bodyOverflow, "hidden");
        const buttons = await page.$$eval('#app [class*="fixed bottom-0"] button', (items) => items.map((item) => {
          const r = item.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }));
        for (const point of buttons) {
          const intercepted = await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('[role="dialog"]')), point);
          assert.equal(intercepted, true, `${phase}: footer hit must land on backdrop`);
          await page.mouse.click(point.x, point.y);
        }
        assert.deepEqual(await page.evaluate(() => [window.testState.next, window.testState.cancel]), [0, 0]);
        await page.evaluate(() => document.querySelector('#app [class*="fixed bottom-0"] button').focus());
        assert.equal(await page.evaluate(() => Boolean(document.activeElement.closest('[role="dialog"]'))), true);
        for (let index = 0; index < 12; index++) {
          await page.keyboard.press("Tab");
          assert.equal(await page.evaluate(() => Boolean(document.activeElement.closest('[role="dialog"]'))), true);
        }
        await page.mouse.move(5, 5);
        await page.mouse.wheel({ deltaY: 400 });
        await new Promise((resolve) => setTimeout(resolve, 80));
        assert.equal(await page.evaluate(() => window.scrollY), initialY);
      };

      await assertBlocked("channel");
      console.log(`Channel blocked correctly: ${viewport.width}, scroll=${scroll}`);
      await clickDialogButton("Enviar código por");
      await page.waitForSelector('input[aria-label="Código de verificación"]');
      await page.waitForFunction(() => !document.querySelector('[role="status"][aria-busy="true"]'));
      assert.equal(await page.evaluate(() => window.testState.sent), 1);
      await assertBlocked("OTP");
      await clickDialogButton("Cancelar");
      await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
      assert.equal(await page.evaluate(() => document.getElementById("app").inert), false);
      assert.equal(await page.evaluate(() => document.body.style.overflow), "");
      assert.equal(await page.evaluate(() => window.scrollY), initialY);
      const footerButtons = await page.$$('#app [class*="fixed bottom-0"] button');
      await footerButtons[0].click();
      await footerButtons[footerButtons.length - 1].click();
      assert.deepEqual(await page.evaluate(() => [window.testState.next, window.testState.cancel]), [1, 1]);
      assert.deepEqual(errors, []);
      console.log(`PASS Postulación ${viewport.width}x${viewport.height}, scroll=${scroll}: channel, OTP, footer clicks/focus blocked, scroll locked, close restores footer`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}

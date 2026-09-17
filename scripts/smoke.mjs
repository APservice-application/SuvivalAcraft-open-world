// Headless smoke test: โหลดเกมจริงใน jsdom, กดเริ่มเกม, ปล่อย loop รัน แล้วดัก error
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const dist = "dist-web";
const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const asset = fs.readdirSync(path.join(dist, "assets")).find((f) => f.endsWith(".js"));
const js = fs.readFileSync(path.join(dist, "assets", asset), "utf8");

// module script ใน head ของ build จริงเป็น deferred — จำลองด้วยการย้ายไปท้าย body (classic)
const patched = html.replace(
  /<script[^>]*src="[^"]*"[^>]*><\/script>/,
  "",
).replace("</body>", () => "<script>" + js + "</script></body>");

const errors = [];
const consoleErrors = [];

const dom = new JSDOM(patched, {
  runScripts: "dangerously",
  url: "https://play.test/",
  pretendToBeVisual: true,
  resources: "usable",
  beforeParse(window) {
    // canvas 2d stub (jsdom ไม่มี canvas impl)
    const makeCtx = () => new Proxy({}, {
      get(target, prop) {
        if (prop === "canvas") return null;
        if (prop === "measureText") return () => ({ width: 8 });
        if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => ({ addColorStop() {} });
        if (prop === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
        if (!(prop in target)) {
          target[prop] = () => {};
        }
        return target[prop];
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    });
    window.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
    window.HTMLCanvasElement.prototype.toDataURL = function () { return "data:image/png;base64,x"; };
    window.addEventListener("error", (e) => {
      errors.push((e.error && (e.error.stack || e.error.message)) || e.message);
    });
    window.addEventListener("unhandledrejection", (e) => {
      errors.push("UNHANDLED REJECTION: " + ((e.reason && (e.reason.stack || e.reason.message)) || String(e.reason)));
    });
    const origErr = window.console.error.bind(window.console);
    window.console.error = (...args) => {
      consoleErrors.push(args.map((a) => (a && a.stack) || String(a)).join(" "));
      origErr(...args);
    };
  },
});

const { window } = dom;
const doc = window.document;

function fire(el, type) {
  el.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true }));
}

await new Promise((r) => setTimeout(r, 300)); // ให้ init เสร็จ (pickStore ฯลฯ)

console.log("== หลัง init ==");
console.log("errors ณ init:", errors.length, errors.slice(0, 3));
console.log("console.error ณ init:", consoleErrors.length, consoleErrors.slice(0, 2));

// เริ่มเกมใหม่ (ค่าเริ่มต้นใน input อยู่แล้ว)
doc.getElementById("btn-new").click();
await new Promise((r) => setTimeout(r, 50));
doc.getElementById("btn-start").click();
await new Promise((r) => setTimeout(r, 500)); // ให้ loop รัน ~30 เฟรม

const hud = doc.getElementById("hud");
const quick = doc.getElementById("quick-bar");
const mini = doc.getElementById("hud") ? true : false;

console.log("");
console.log("== หลังกดเริ่มเกม + 500ms ==");
console.log("hud.playing:", hud?.className);
console.log("quick-bar slots:", quick?.children.length ?? -1);
console.log("errors:", errors.length);
for (const e of errors.slice(0, 5)) console.log("  ERR:", e.split("\n").slice(0, 4).join("\n  "));
console.log("console.error:", consoleErrors.length);
for (const e of consoleErrors.slice(0, 3)) console.log("  CE:", String(e).split("\n").slice(0, 4).join("\n  "));

// ไล่เวลาอีกหน่อยให้ spawn/event/อุณหภูมิทำงาน + จำลองเดินหน้า
const key = (type, k) => window.dispatchEvent(new window.KeyboardEvent(type, { key: k, bubbles: true }));
key("keydown", "w");
await new Promise((r) => setTimeout(r, 1200));
key("keyup", "w");
// กดโจมตี (setupButton ฟัง touchstart/mousedown)
fire(doc.getElementById("btn-attack"), "mousedown");
await new Promise((r) => setTimeout(r, 800));

console.log("");
console.log("== หลังรันรวม ~2.5s + เดิน + โจมตี ==");
console.log("quick-bar slots:", quick?.children.length ?? -1);
const hudHp = doc.getElementById("hud-hp")?.textContent;
const hudLevel = doc.getElementById("hud-level")?.textContent;
console.log("hud hp/level:", hudHp, "/", hudLevel);
console.log("errors:", errors.length);
for (const e of errors.slice(0, 5)) console.log("  ERR:", e.split("\n").slice(0, 5).join("\n  "));
console.log("console.error:", consoleErrors.length);
for (const e of consoleErrors.slice(0, 3)) console.log("  CE:", String(e).split("\n").slice(0, 3).join("\n  "));

const ok = errors.length === 0 && consoleErrors.length === 0 && (quick?.children.length ?? 0) === 6;
console.log("");
console.log(ok ? "SMOKE PASS ✅" : "SMOKE FAIL ❌");
process.exit(ok ? 0 : 1);

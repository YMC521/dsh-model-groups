const fs = require("fs");
const path = require("path").join(__dirname, "..", "lib", "client.js");
const src = fs.readFileSync(path, "utf8");
const styles = [];
let registration = null;
globalThis.window = { __ModuleLoader__: { load(reg) { registration = reg; } } };
globalThis.document = {
  createElement: () => ({ dataset: {}, appendChild() {}, textContent: "" }),
  head: { appendChild(node) { styles.push(node.dataset); } },
  querySelector: () => null,
  documentElement: { dataset: {} }
};
const deepProxy = (label) => new Proxy(function () {}, {
  get(_t, k) {
    if (k === Symbol.toPrimitive) return () => label;
    if (k === "then") return undefined;
    if (k === "prototype") return {};
    if (k === "__esModule") return true;
    return deepProxy(label + "." + String(k));
  },
  apply() { return deepProxy(label + "()"); },
  construct() { return deepProxy("new " + label); }
});
const reactStub = {
  useState: (v) => [typeof v === "function" ? v() : v, () => {}],
  useRef: (v) => ({ current: v }),
  useEffect: () => {},
  useLayoutEffect: () => {},
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useSyncExternalStore: (sub, get) => get(),
  createContext: (v) => ({ Provider: deepProxy("Provider"), Consumer: deepProxy("Consumer"), _v: v }),
  useContext: (c) => c && c._v,
  Fragment: deepProxy("Fragment"),
  memo: (c) => c,
  forwardRef: (c) => c,
  Children: deepProxy("Children"),
  isValidElement: () => false,
  createElement: (...a) => ({ type: a[0], props: a[1] })
};
const requireStub = (spec) => {
  if (spec === "react") return reactStub;
  if (spec === "react/jsx-runtime" || spec === "react/jsx-dev-runtime") return { jsx: () => null, jsxs: () => null, jsxDEV: () => null, Fragment: deepProxy("Fragment") };
  if (spec === "react-dom") return { createPortal: () => null, flushSync: (f) => f() };
  return deepProxy(spec);
};
requireStub.async = async () => ({});
eval(src);
if (!registration) { console.error("NO REGISTRATION"); process.exit(1); }
console.log("registered id:", registration.id);
const exports_ = registration.factory(requireStub);
console.log("exports keys:", Object.keys(exports_));
if (typeof exports_.apply !== "function") { console.error("NO APPLY"); process.exit(1); }
console.log("SMOKE_OK");

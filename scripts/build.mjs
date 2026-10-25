import fs from "node:fs";
import path from "node:path";

const SOURCE = process.env.MG_SOURCE;
const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "lib", "client.js");

if (SOURCE === undefined || SOURCE === "") {
	console.error([
		"缺少上游源码路径：请把 MG_SOURCE 指向官方包里的 client.js，例如",
		"  MG_SOURCE=C:/Users/<you>/AppData/Roaming/dsh-tauri/dependencies/dsh/node_modules/@deepseek-ai/dsh-client-ui-model-selection/lib/client.js \\",
		"  node scripts/build.mjs",
		"",
		"该文件随 DeepSeek Harness 发布；升级 DSH 后重新指一次并重新构建即可。"
	].join("\n"));
	process.exit(1);
}

const src = fs.readFileSync(SOURCE, "utf8");
const region = fs.readFileSync(path.join(ROOT, "src", "region.js"), "utf8");
const lines = src.split("\n");

const MARK_START = "//#region lib/types/client/ModelSelect.js";
const MARK_LOCALES = "//#region lib/types/client/locales.js";
const idxStart = lines.findIndex((line) => line.includes(MARK_START));
const idxLocales = lines.findIndex((line) => line.includes(MARK_LOCALES));
if (idxStart < 0 || idxLocales < 0) throw new Error("region markers not found");
let idxEnd = -1;
for (let i = idxLocales - 1; i > idxStart; i -= 1) {
	if (lines[i].trim() === "//#endregion") { idxEnd = i; break; }
}
if (idxEnd < 0) throw new Error("ModelSelect region end not found");

let out = [...lines.slice(0, idxStart), region, ...lines.slice(idxEnd + 1)].join("\n");

const swap = (from, to) => {
	if (out.includes(from) === false) throw new Error("missing: " + from.slice(0, 60));
	out = out.replace(from, to);
};

swap('"@deepseek-ai/dsh-client-ui-model-selection"', '"dsh-model-groups"');
swap('"@deepseek-ai/dsh-client-ui-model-selection/ModelSelect.module.css"', '"dsh-model-groups/ModelSelect.module.css"');
swap("}, ModelSelect));", "}, ModelGroupsSelect));");

const uiStart = out.indexOf('					ui: {\n						kind: "popupSelect",');
if (uiStart < 0) throw new Error("popupSelect ui block not found");
const uiEndMark = '\n					}\n				}), "ui-model-selection: /model contribution");';
const uiEnd = out.indexOf(uiEndMark, uiStart);
if (uiEnd < 0) throw new Error("popupSelect ui block end not found");
const replacement = [
	'					ui: {',
	'						kind: "action",',
	'						run: () => {',
	'							modelGroupsOpenRequests.request();',
	'						}'
].join("\n");
out = out.slice(0, uiStart) + replacement + out.slice(uiEnd);
out = out.replace('"ui-model-selection: /model contribution"', '"dsh-model-groups: /model contribution"');

const zhTail = '			"empty.efforts": "当前模型未提供推理等级。"';
const enTail = '			"empty.efforts": "This model provides no reasoning effort levels."';
swap(zhTail, zhTail + ',\n			"section.aria": "{name}，{count} 个模型",\n			"section.selectedBadge": "当前模型所在供应商"');
swap(enTail, enTail + ',\n			"section.aria": "{name}, {count} models",\n			"section.selectedBadge": "Provider of the current model"');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out);
console.log("wrote", OUT, out.split("\n").length, "lines");

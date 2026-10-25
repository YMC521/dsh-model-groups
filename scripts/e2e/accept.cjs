/**
 * 端到端验收：composer 模型菜单 + /model 命令。
 * 前置：DSH 已在 MG_URL（默认 http://127.0.0.1:3080）跑起来，且已安装本插件。
 * 运行：node scripts/e2e/accept.cjs
 * 可用环境变量覆盖：MG_URL / MG_CHROME / MG_PUPPETEER
 */
const path = require("path");

const PUPPETEER = process.env.MG_PUPPETEER || "puppeteer-core";
const CHROME = process.env.MG_CHROME || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL = process.env.MG_URL || "http://127.0.0.1:3080/";
const OUT = path.join(__dirname, "..", "..", "out");

const loadPuppeteer = () => {
	const candidates = [
		process.env.MG_PUPPETEER,
		"puppeteer-core",
		path.join(require("os").homedir(), ".dsh", "profiles", "web", "node_modules", "puppeteer-core")
	].filter(Boolean);
	for (const candidate of candidates) {
		try {
			return require(candidate);
		} catch (error) {
			/* try next */
		}
	}
	return null;
};
const puppeteer = loadPuppeteer();
if (puppeteer === null) {
	console.error("找不到 puppeteer-core。安装：npm i -D puppeteer-core；或设置 MG_PUPPETEER 指向已有模块。");
	process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SNAP = `(() => {
  const m = document.querySelector("[role=menu]");
  if (!m) return { open: false };
  const inp = m.querySelector("input");
  const secs = [...m.querySelectorAll("[aria-expanded]")].map((s) => ({
    name: s.textContent.replace(/\\d+$/, "").trim(),
    raw: s.textContent.trim(),
    expanded: s.getAttribute("aria-expanded") === "true",
    count: Number((s.textContent.trim().match(/(\\d+)$/) || [0, "0"])[1])
  }));
  const mods = [...m.querySelectorAll("[role=menuitemradio]")].map((s) => s.textContent.trim());
  return { open: true, query: inp ? inp.value : null, sections: secs, models: mods };
})()`;

const results = [];
const check = (name, ok, detail) => {
	results.push((ok ? "PASS " : "FAIL ") + name + (detail === undefined ? "" : "  :: " + JSON.stringify(detail)));
};

(async () => {
	const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--disable-gpu"], defaultViewport: { width: 1280, height: 900 } });
	const page = await browser.newPage();
	const errs = [];
	page.on("pageerror", (e) => errs.push(e.message));
	await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
	await sleep(5000);
	// 有些 profile 会先弹「用户须知」遮挡界面，点掉它
	await page.evaluate(() => {
		const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "我已知晓并继续");
		if (!b) return;
		const cb = document.querySelector("input[type=checkbox]");
		if (cb && !cb.checked) cb.click();
		setTimeout(() => {
			const b2 = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "我已知晓并继续");
			if (b2) b2.click();
		}, 300);
	});
	await sleep(1500);

	const triggerTitle = await page.evaluate(() => {
		const bs = [...document.querySelectorAll("button[aria-haspopup=menu]")];
		const b = bs[bs.length - 1];
		b.click();
		return b.title;
	});
	await sleep(1200);
	const s1 = await page.evaluate(SNAP);
	const openSections = s1.sections.filter((x) => x.expanded && !x.raw.includes("等级"));
	check("打开：菜单可见", s1.open === true);
	check("打开：搜索框常驻", typeof s1.query === "string");
	check("打开：恰好一个供应商展开", openSections.length === 1, { expanded: openSections.map((x) => x.raw) });
	check("打开：展开的供应商只显示当前模型", s1.models.length === 1, { models: s1.models, triggerTitle });
	check("打开：其余供应商全部收起", s1.sections.filter((x) => !x.raw.includes("等级")).length - openSections.length >= 10, { total: s1.sections.length });
	await page.screenshot({ path: path.join(OUT, "1-open.png") });

	const firstCollapsed = s1.sections.find((x) => !x.expanded && !x.raw.includes("等级"));
	await page.evaluate((name) => {
		const m = document.querySelector("[role=menu]");
		const s = [...m.querySelectorAll("[aria-expanded=false]")].find((x) => x.textContent.trim() === name);
		s.click();
	}, firstCollapsed.raw);
	await sleep(800);
	const s2 = await page.evaluate(SNAP);
	check("展开：点开供应商列出其全部模型", s2.models.length === firstCollapsed.count + 1, { clicked: firstCollapsed.raw, count: firstCollapsed.count, visible: s2.models.length });

	await page.evaluate((name) => {
		const m = document.querySelector("[role=menu]");
		const s = [...m.querySelectorAll("[aria-expanded=true]")].find((x) => x.textContent.trim() === name);
		s.click();
	}, firstCollapsed.raw);
	await sleep(700);
	const s3 = await page.evaluate(SNAP);
	check("收起：再点一次收回其模型", s3.models.length === 1, { visible: s3.models.length });

	await page.evaluate(() => { document.querySelector("[role=menu] input").focus(); });
	await page.keyboard.type("glm", { delay: 45 });
	await sleep(900);
	const s4 = await page.evaluate(SNAP);
	check("搜索：命中供应商自动展开", s4.sections.filter((x) => !x.raw.includes("等级")).every((x) => x.expanded), { sections: s4.sections.map((x) => x.raw) });
	check("搜索：只剩命中模型", s4.models.length > 0 && s4.models.every((mm) => /glm/i.test(mm.replace(/[^a-z0-9]/gi, "")) || /g.*l.*m/i.test(mm)), { sample: s4.models.slice(0, 6), total: s4.models.length });
	check("搜索：无命中的供应商隐藏", s4.sections.filter((x) => !x.raw.includes("等级")).length < s1.sections.filter((x) => !x.raw.includes("等级")).length, { before: s1.sections.length, after: s4.sections.length });
	await page.screenshot({ path: path.join(OUT, "2-search.png") });

	await page.keyboard.press("Escape");
	await sleep(700);
	const s5 = await page.evaluate(SNAP);
	check("Esc：第一次清空搜索、菜单还在", s5.open === true && s5.query === "", { open: s5.open, query: s5.query });
	await page.keyboard.press("Escape");
	await sleep(600);
	check("Esc：第二次关闭菜单", (await page.evaluate(SNAP)).open === false);
	check("composer 路径无运行时报错", errs.length === 0, errs.slice(0, 3));

	await sleep(500);
	const ed = await page.evaluate(() => {
		const el = document.querySelector("[contenteditable=true], textarea");
		if (!el) return false;
		el.focus();
		return true;
	});
	if (ed) {
		await page.keyboard.type("/model", { delay: 70 });
		await sleep(1400);
		await page.keyboard.press("Enter");
		await sleep(1500);
	}
	const s6 = await page.evaluate(SNAP);
	check("/model：打开同一套手风琴", s6.open === true && s6.sections.length > 5, { open: s6.open, sections: s6.sections ? s6.sections.length : 0 });
	check("/model：同样的默认折叠态", s6.models ? s6.models.length === 1 : false, { models: s6.models });
	await page.screenshot({ path: path.join(OUT, "3-model-command.png") });
	check("命令路径无运行时报错", errs.length === 0, errs.slice(0, 3));

	console.log(results.join("\n"));
	const passed = results.filter((r) => r.startsWith("PASS")).length;
	console.log("SUMMARY " + passed + "/" + results.length);
	await browser.close();
	if (passed !== results.length) process.exit(1);
})().catch((e) => {
	console.error("FAIL", e && e.message);
	process.exit(1);
});

/**
 * 端到端验收：推理等级固定条 + hover 侧栏面板 + 键盘可达性。
 * 前置：DSH 已在 MG_URL（默认 http://127.0.0.1:3080）跑起来，且已安装本插件。
 * 运行：node scripts/e2e/effort.cjs
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
const results = [];
const check = (name, ok, extra) => {
	results.push({ name, ok });
	console.log((ok ? "PASS " : "FAIL ") + name + (extra === undefined ? "" : "  << " + extra));
};

(async () => {
	const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--disable-gpu"], defaultViewport: { width: 1280, height: 900 } });
	const page = await browser.newPage();
	const errors = [];
	page.on("pageerror", (e) => errors.push(String(e && e.message)));
	await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
	await sleep(5000);
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
	await page.evaluate(() => {
		const bs = [...document.querySelectorAll("button[aria-haspopup=menu]")];
		bs[bs.length - 1].click();
	});
	await sleep(400);
	const opened = await page.evaluate(() => {
		const menu = document.querySelector("[role=menu]");
		if (!menu) return { menu: false };
		const active = document.activeElement;
		const cell = [...menu.querySelectorAll("button")].find((b) => b.getAttribute("aria-haspopup") === "menu");
		const groups = menu.querySelector(".mg_groups");
		return {
			menu: true,
			activeTag: active ? active.tagName : null,
			activeIsInput: active ? active.tagName === "INPUT" : false,
			cellText: cell ? cell.textContent : null,
			cellInGroups: cell && groups ? groups.contains(cell) : null,
			cellRect: cell ? cell.getBoundingClientRect().toJSON() : null,
			groupsRect: groups ? groups.getBoundingClientRect().toJSON() : null
		};
	});

	check("菜单打开", opened.menu === true);
	check("打开后搜索框自动聚焦", opened.activeIsInput === true, "active=" + opened.activeTag);
	check("等级条已渲染", typeof opened.cellText === "string" && opened.cellText.length > 0, opened.cellText);
	check("等级条在滚动列表之外", opened.cellInGroups === false);
	check("等级条固定在列表下方", !!(opened.cellRect && opened.groupsRect && opened.cellRect.top >= opened.groupsRect.bottom - 2), JSON.stringify({ cell: opened.cellRect && opened.cellRect.top, groupsBottom: opened.groupsRect && opened.groupsRect.bottom }));
	await page.screenshot({ path: path.join(OUT, "4-effort-pinned.png") });

	const cellBox = opened.cellRect;
	await page.mouse.move(cellBox.x + cellBox.width / 2, cellBox.y + cellBox.height / 2);
	await sleep(350);
	const fly = await page.evaluate(() => {
		const node = document.querySelector(".mg_flyout");
		if (!node) return { open: false };
		const r = node.getBoundingClientRect();
		const menu = document.querySelector("[role=menu]").getBoundingClientRect();
		const style = getComputedStyle(node);
		return {
			open: true,
			side: node.className.includes("mg_flyoutLeft") ? "left" : "right",
			rect: r.toJSON(),
			menuLeft: menu.left,
			menuRight: menu.right,
			opaque: style.backgroundColor.replace(/[^0-9.,]/g, "").split(",").length === 3 && style.backgroundImage === "none",
			items: [...node.querySelectorAll("button")].map((b) => ({ text: b.textContent, checked: b.getAttribute("aria-checked") }))
		};
	});

	check("悬停打开等级面板", fly.open === true);
	check("面板列出等级", fly.open && fly.items.length >= 2, fly.open ? fly.items.length : 0);
	const beside = fly.open === true && (fly.side === "right" ? fly.rect.left >= fly.menuRight - 1 : fly.rect.right <= fly.menuLeft + 1);
	check("面板贴在菜单外侧（不压菜单）", beside, fly.open ? JSON.stringify({ side: fly.side, left: fly.rect.left, right: fly.rect.right }) : "");
	check("面板是不透明实色", fly.open === true && fly.opaque === true);
	await page.screenshot({ path: path.join(OUT, "5-effort-panel.png") });

	await page.mouse.move(200, 200);
	await sleep(400);
	check("移开自动收起", (await page.evaluate(() => document.querySelector(".mg_flyout") === null)) === true);
	check("无页面报错", errors.length === 0, errors.slice(0, 3).join(" | "));

	await page.evaluate(() => {
		const menu = document.querySelector("[role=menu]");
		const cell = [...menu.querySelectorAll("button")].find((b) => b.getAttribute("aria-haspopup") === "menu");
		cell.click();
	});
	await sleep(300);
	check("点击等级条也能打开", (await page.evaluate(() => document.querySelector(".mg_flyout") !== null)) === true);
	await page.evaluate(() => {
		const menu = document.querySelector("[role=menu]");
		const cell = [...menu.querySelectorAll("button")].find((b) => b.getAttribute("aria-haspopup") === "menu");
		cell.focus();
	});
	await page.keyboard.press("ArrowDown");
	await sleep(200);
	check("ArrowDown 进入等级列表", (await page.evaluate(() => { const f = document.querySelector(".mg_flyout"); return f !== null && f.contains(document.activeElement); })) === true);

	await page.keyboard.press("Escape");
	await sleep(250);
	await page.keyboard.press("Escape");
	await sleep(350);
	check("Esc 逐级关闭菜单", (await page.evaluate(() => document.querySelector("[role=menu]") === null)) === true);

	await browser.close();
	const failed = results.filter((r) => !r.ok);
	console.log("SUMMARY " + (results.length - failed.length) + "/" + results.length);
	if (failed.length > 0) process.exit(1);
})().catch((e) => {
	console.error("FAIL", e && e.message);
	process.exit(1);
});

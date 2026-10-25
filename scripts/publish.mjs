#!/usr/bin/env node
/**
 * 一键发布到 GitHub。
 *
 *   node scripts/publish.mjs                    # 走 GitHub 设备授权：终端给出一次性代码，浏览器点同意
 *   GH_TOKEN=ghp_xxx node scripts/publish.mjs   # 或者直接给 token
 *   node scripts/publish.mjs --name dsh-model-groups --private
 *   node scripts/publish.mjs --force            # 强推（历史被重写时用）
 *   node scripts/publish.mjs --dry-run          # 不联网，只打印将要执行的动作
 *
 * 做了这些事：读 token 对应的 GitHub 登录名 → 回填 package.json 的 repository/homepage/bugs
 * → 建仓库（已存在则跳过）→ 打 tag 不需要，直接推送 main → 写仓库 description 与 topics。
 *
 * token 需要 repo 权限（classic: repo；fine-grained: Administration + Contents 读写）。
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const API = process.env.GH_API ?? "https://api.github.com";

const argv = process.argv.slice(2);
const arg = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const dryRun = argv.includes("--dry-run");
const repoName = arg("--name", "dsh-model-groups");
const isPrivate = argv.includes("--private");
const forcePush = argv.includes("--force");
const description =
  arg("--description", "DSH 插件：把模型选择列表按供应商折叠成手风琴，带搜索与推理等级侧栏面板") ||
  "DSH plugin: collapse the model picker into per-provider accordions";
const topics = ["dsh", "dsh-plugin", "deepseek-harness", "model-picker", "accordion", "ui-plugin"];

let token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
const CLIENT_ID = process.env.GH_CLIENT_ID ?? "178c6fc778ccc68e1d6a";
const OAUTH = "https://github.com/login";

async function deviceFlow() {
  let start = null;
  for (let attempt = 0; attempt < 5 && !start?.device_code; attempt++) {
    try {
      start = await fetch(OAUTH + "/device/code", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: CLIENT_ID, scope: "repo" })
      }).then((r) => r.json());
    } catch {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  if (!start?.device_code) {
    console.error("申请设备码失败：" + JSON.stringify(start));
    process.exit(1);
  }

  console.log("");
  console.log("  打开 " + start.verification_uri + " ，输入代码：" + start.user_code);
  console.log("  （浏览器里点 Authorize 即可，token 不会经过任何人）");
  console.log("");

  let interval = (start.interval ?? 5) * 1000;
  const deadline = Date.now() + (start.expires_in ?? 900) * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));
    let res;
    try {
      res = await fetch(OAUTH + "/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          device_code: start.device_code,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code"
        })
      }).then((r) => r.json());
    } catch {
      continue; // 网络抖动：继续等，别把整个流程打断
    }

    if (res.access_token) return res.access_token;
    if (res.error === "authorization_pending") continue;
    if (res.error === "slow_down") {
      interval += 5000;
      continue;
    }
    console.error("授权失败：" + (res.error_description || res.error));
    process.exit(1);
  }
  console.error("设备码已过期，重新执行一次。");
  process.exit(1);
}
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
const gitQuiet = (...args) => {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
};

function step(msg) {
  console.log(dryRun ? "· " + msg : "› " + msg);
}

async function api(method, route, body) {
  const res = await fetch(API + route, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  if (!token && !dryRun) {
    token = await deviceFlow();
    step("已拿到授权");
  }

  // 1) 本地仓库
  const hasRepo = gitQuiet("rev-parse", "--git-dir") !== null;
  if (!hasRepo) {
    step("git init -b main");
    if (!dryRun) git("init", "-b", "main");
  }
  const branch = gitQuiet("symbolic-ref", "--short", "HEAD") ?? "main";

  // 2) 登录名
  let login = process.env.GH_USER || "";
  if (!login) {
    if (dryRun) {
      login = "<github-login>";
      step("GET /user 取登录名");
    } else {
      const me = await api("GET", "/user");
      if (!me.ok) {
        console.error("取登录名失败：" + me.status + " " + JSON.stringify(me.json));
        console.error("→ token 无效或缺少 read:user 权限。");
        process.exit(1);
      }
      login = me.json.login;
      step("登录名：" + login);
    }
  }

  const repoUrl = "https://github.com/" + login + "/" + repoName;

  // 3) 回填 package.json
  const pkgPath = path.join(ROOT, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const wanted = {
    repository: { type: "git", url: "git+https://github.com/" + login + "/" + repoName + ".git" },
    homepage: repoUrl + "#readme",
    bugs: { url: repoUrl + "/issues" }
  };
  const changed = Object.keys(wanted).filter(
    (k) => JSON.stringify(pkg[k]) !== JSON.stringify(wanted[k])
  );
  if (changed.length) {
    step("package.json 回填 " + changed.join(", "));
    if (!dryRun) {
      Object.assign(pkg, wanted);
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    }
  }

  // 4) 建仓库
  if (dryRun) {
    step("POST /user/repos { name: " + repoName + ", private: " + isPrivate + " }");
  } else {
    const created = await api("POST", "/user/repos", {
      name: repoName,
      description,
      private: isPrivate,
      has_issues: true,
      has_wiki: false,
      has_projects: false
    });
    if (created.ok) step("已创建 " + created.json.html_url);
    else if (created.status === 422) step("仓库已存在，直接推送");
    else {
      console.error("建仓库失败：" + created.status + " " + JSON.stringify(created.json));
      process.exit(1);
    }
  }

  // 5) 提交
  const dirty = (gitQuiet("status", "--porcelain") ?? "x").length > 0;
  if (dirty) {
    step("git add -A && git commit");
    if (!dryRun) {
      git("add", "-A");
      git("commit", "-m", "chore: publish metadata");
    }
  }

  // 6) 推送：优先走 git 传输，连不上 github.com 时回退到 Git Data API
  const auth = Buffer.from("x-access-token:" + token).toString("base64");
  let pushed = false;
  if (!dryRun) {
    try {
      step("git push " + repoUrl);
      execFileSync(
        "git",
        [
          "-c",
          "http.extraheader=Authorization: Basic " + auth,
          "push",
          "--no-verify",
          ...(forcePush ? ["--force"] : []),
          "https://github.com/" + login + "/" + repoName + ".git",
          "HEAD:refs/heads/" + branch
        ],
        {
          cwd: ROOT,
          stdio: ["ignore", "inherit", "pipe"],
          env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0" }
        }
      );
      pushed = true;
    } catch (err) {
      const detail = (err?.stderr?.toString() || err?.message || "").trim().split("\n").slice(-2).join(" ");
      step("git 传输失败（" + detail.slice(0, 120) + "），改用 GitHub API 上传");
    }

    if (!pushed) await pushViaApi(login);

    try {
      git("remote", "get-url", "origin");
      git("remote", "set-url", "origin", repoUrl + ".git");
    } catch {
      git("remote", "add", "origin", repoUrl + ".git");
    }
    if (pushed) {
      try {
        git("branch", "--set-upstream-to=origin/" + branch, branch);
      } catch {
        /* 忽略 */
      }
    }

    const t = await api("PUT", "/repos/" + login + "/" + repoName + "/topics", { names: topics });
    if (t.ok) step("已设置 topics: " + topics.join(", "));
  } else {
    step("git push 或 API 上传 " + repoUrl);
  }

  console.log("");
  console.log("仓库地址：" + repoUrl);
}

/**
 * 用 Git Data API 提交整棵树（不依赖 git 传输通道，只需要 api.github.com 可达）。
 */
async function pushViaApi(login) {
  const files = git("ls-files", "-z").split("\u0000").filter(Boolean);
  step("API 上传 " + files.length + " 个文件");

  const tree = [];
  for (const rel of files) {
    const buf = readFileSync(path.join(ROOT, rel));
    const blob = await api("POST", "/repos/" + login + "/" + repoName + "/git/blobs", {
      content: buf.toString("base64"),
      encoding: "base64"
    });
    if (!blob.ok) {
      console.error("上传失败 " + rel + "：" + blob.status + " " + JSON.stringify(blob.json));
      process.exit(1);
    }
    tree.push({ path: rel, mode: "100644", type: "blob", sha: blob.json.sha });
  }

  const newTree = await api("POST", "/repos/" + login + "/" + repoName + "/git/trees", { tree });
  if (!newTree.ok) {
    console.error("建 tree 失败：" + newTree.status + " " + JSON.stringify(newTree.json));
    process.exit(1);
  }

  // 已有提交就接在后面，否则作为首个提交
  const refRes = await api("GET", "/repos/" + login + "/" + repoName + "/git/ref/heads/" + branch);
  const parents = refRes.ok && refRes.json?.object?.sha ? [refRes.json.object.sha] : [];

  const commit = await api("POST", "/repos/" + login + "/" + repoName + "/git/commits", {
    message: git("log", "-1", "--pretty=%s") || "init",
    tree: newTree.json.sha,
    parents
  });
  if (!commit.ok) {
    console.error("建 commit 失败：" + commit.status + " " + JSON.stringify(commit.json));
    process.exit(1);
  }

  const refPath = "/repos/" + login + "/" + repoName + "/git/refs/heads/" + branch;
  const setRef = parents.length
    ? await api("PATCH", "/repos/" + login + "/" + repoName + "/git/refs/heads/" + branch, {
        sha: commit.json.sha,
        force: forcePush
      })
    : await api("POST", "/repos/" + login + "/" + repoName + "/git/refs", { ref: "refs/heads/" + branch, sha: commit.json.sha });
  if (!setRef.ok) {
    console.error("更新分支失败：" + setRef.status + " " + JSON.stringify(setRef.json));
    process.exit(1);
  }
  step("已通过 API 推送 " + branch + "（" + files.length + " 个文件）");
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
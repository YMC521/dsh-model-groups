# 发布到 GitHub

仓库已经是一个干净的 git 仓库（无 node_modules）。发布只需要一次 GitHub 授权，剩下交给脚本。

## 方式 A：设备码授权（推荐，不用手工造 token）

```bash
node scripts/publish.mjs
```

终端会打印一个一次性代码，打开 https://github.com/login/device 输入并点 Authorize，脚本自己拿到 token、建仓库、推送、设置 topics。需要 github.com/login 可访问。

## 方式 B：用自己的 token

```bash
# 生成：https://github.com/settings/tokens → New token (classic) → 勾 repo
GH_TOKEN=ghp_xxx node scripts/publish.mjs
```

Windows PowerShell：`$env:GH_TOKEN="ghp_xxx"; node scripts/publish.mjs`

## 脚本做了什么

1. 读登录名 → 回填 `package.json` 的 `repository` / `homepage` / `bugs`
2. `POST /user/repos` 建同名仓库（已存在则跳过）
3. 推送 `main`：优先 `git push`（token 走 `http.extraheader`，不落进 `.git/config`）；git 传输不通时自动回退到 **Git Data API**（`git/blobs` → `git/trees` → `git/commits` → `git/refs`，只要求 `api.github.com` 可达）
4. 写入仓库描述与 topics

常用参数：`--name <repo>`（默认 `dsh-model-groups`）、`--private`、`--description "..."`、`--dry-run`（不联网，只打印动作）。

## 手动发布

```bash
# 在 https://github.com/new 建一个空仓库（不要勾 README / .gitignore）
git remote add origin https://github.com/<you>/dsh-model-groups.git
git push -u origin main
```

> 国内网络下 `github.com:443` 时常不通，而 `api.github.com` 通常可达；这种情况下让脚本走 API 上传（方式 B + 自动回退）比折腾 git 代理更省事。注意 `~/.gitconfig` 里的 `url.<mirror>.insteadOf=https://github.com/` 会把 push 也改写到镜像，脚本在 git 步骤里用 `GIT_CONFIG_GLOBAL=/dev/null` 绕开它。

## 发布后建议

- 仓库 About 填：`dsh`、`dsh-plugin`、`deepseek-harness`、`model-picker`、`accordion`。
- README 顶部截图在 `docs/`，GitHub 会直接渲染。
- 打 tag：`git tag v1.0.0 && git push origin v1.0.0`。

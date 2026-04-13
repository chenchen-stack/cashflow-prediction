/**
 * Vercel / CI：把 frontend 同步到 public/frontend，并写入 public/index.html，
 * 与 vercel.json 的 outputDirectory: public 配合，避免「根 index 不进产物」与仅 public 为空的问题。
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const pub = path.join(root, "public");
const fe = path.join(root, "frontend");

if (!fs.existsSync(fe)) {
  console.error("vercel-build-static: missing frontend/", fe);
  process.exit(1);
}

fs.rmSync(pub, { recursive: true, force: true });
fs.mkdirSync(pub, { recursive: true });
fs.cpSync(fe, path.join(pub, "frontend"), { recursive: true });

const landing = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>现金流预测 Agent</title>
  <meta http-equiv="refresh" content="0;url=/frontend/index.html" />
  <script>
    location.replace("/frontend/index.html" + (location.search || "") + (location.hash || ""));
  </script>
</head>
<body>
  <p style="font-family: system-ui, sans-serif; padding: 2rem;">
    <a href="/frontend/index.html">进入应用</a>
  </p>
</body>
</html>
`;

fs.writeFileSync(path.join(pub, "index.html"), landing, "utf8");
console.log("vercel-build-static: wrote public/index.html and public/frontend/");

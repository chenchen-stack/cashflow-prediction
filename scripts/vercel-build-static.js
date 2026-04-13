/**
 * Vercel / CI：生成 public/ 作为唯一发布目录。
 * - 保留 public/frontend/ 供 /frontend/* 访问；
 * - 将 css、js、app.html、index.html 同步到 public 根目录，使地址栏为 /app 时相对路径 css/、js/ 解析为 /css、/js（与本地 FastAPI 根挂载一致）。
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

fs.cpSync(path.join(fe, "css"), path.join(pub, "css"), { recursive: true });
fs.cpSync(path.join(fe, "js"), path.join(pub, "js"), { recursive: true });
fs.copyFileSync(path.join(fe, "app.html"), path.join(pub, "app.html"));
fs.copyFileSync(path.join(fe, "index.html"), path.join(pub, "index.html"));

console.log(
  "vercel-build-static: public/{frontend,css,js,app.html,index.html} ready"
);

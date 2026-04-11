const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { safeExists, safeReaddir, safeStat, wait } = require("../utils/fsSafe");

function pad3(num) {
  return String(num).padStart(3, "0");
}

function sanitizeBaseName(name) {
  return String(name || "document")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
}

function buildOutputPrefix(pdfPath) {
  const dir = path.dirname(pdfPath);
  const base = sanitizeBaseName(path.parse(pdfPath).name);
  return {
    dir,
    base,
    prefix: path.join(dir, `${base}__page`),
  };
}

function uniqueFilePath(dirPath, fileName) {
  const parsed = path.parse(fileName);
  let candidate = path.join(dirPath, fileName);
  let count = 2;
  while (safeExists(candidate)) {
    candidate = path.join(dirPath, `${parsed.name}-${count}${parsed.ext}`);
    count += 1;
  }
  return candidate;
}

function runPdftoppm(pdfPath, outputPrefix, dpi) {
  return new Promise((resolve, reject) => {
    const args = ["-png", "-r", String(dpi), pdfPath, outputPrefix];
    const proc = spawn("pdftoppm", args, { windowsHide: true });
    let stderr = "";

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => {
      if (err?.code === "ENOENT") {
        reject(
          new Error(
            "PDF conversion tool (pdftoppm) not found. Install Poppler and add it to PATH."
          )
        );
        return;
      }
      reject(err);
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`PDF conversion failed: ${stderr || "pdftoppm error"}`));
        return;
      }
      resolve();
    });
  });
}

async function convertPdfToImages(pdfPath, options = {}) {
  const dpi = Number(options.dpi || 150) || 150;
  if (!safeExists(pdfPath)) return [];

  const stat = safeStat(pdfPath, { retries: 3 });
  if (!stat?.isFile?.()) return [];

  const { dir, base, prefix } = buildOutputPrefix(pdfPath);
  await runPdftoppm(pdfPath, prefix, dpi);

  // Give the OS a moment to release file handles on Windows.
  await wait(80);

  const generated = safeReaddir(dir)
    .filter((name) => name.startsWith(`${base}__page-`) && name.endsWith(".png"))
    .map((name) => path.join(dir, name));

  if (!generated.length) {
    throw new Error("PDF conversion produced no pages.");
  }

  generated.sort((a, b) => {
    const matchA = a.match(/-(\d+)\.png$/);
    const matchB = b.match(/-(\d+)\.png$/);
    return Number(matchA?.[1] || 0) - Number(matchB?.[1] || 0);
  });

  const finalFiles = [];
  for (const full of generated) {
    const pageMatch = full.match(/-(\d+)\.png$/);
    const pageNo = Number(pageMatch?.[1] || 0);
    const targetName = `${base}__page-${pad3(pageNo)}.png`;
    const targetPath = uniqueFilePath(dir, targetName);

    if (full !== targetPath) {
      try {
        fs.renameSync(full, targetPath);
      } catch {
        // If rename fails, keep original.
        finalFiles.push(full);
        continue;
      }
    }
    finalFiles.push(targetPath);
  }

  try {
    fs.rmSync(pdfPath, { force: true });
  } catch {
  }

  return finalFiles;
}

module.exports = { convertPdfToImages };

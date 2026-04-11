const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function getBuildVersion(date = new Date()) {
  return "1.0.0";
}

function writeBuildMeta(serverDir, version) {
  const metaPath = path.join(serverDir, "installer", "build-meta.json");
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        version,
        createdAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
}

function resolvePkgCommand(serverDir) {
  const localPkgCli = path.join(serverDir, "node_modules", "pkg", "lib-es5", "bin.js");
  if (fs.existsSync(localPkgCli)) {
    return {
      command: process.execPath,
      args: [localPkgCli],
    };
  }

  return process.platform === "win32"
    ? { command: "npx.cmd", args: ["pkg"] }
    : { command: "npx", args: ["pkg"] };
}

function buildExe(serverDir, version) {
  const { command, args } = resolvePkgCommand(serverDir);
  const outputName = "NVA-SignagePlayerTV.exe";
  const result = spawnSync(
    command,
    [...args, ".", "--targets", "node18-win-x64", "--output", outputName],
    {
      cwd: serverDir,
      stdio: "inherit",
      shell: false,
    }
  );

  if (result.error) {
    console.error(`Failed to start pkg build: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }

  const sourceExe = path.join(serverDir, outputName);
  if (!fs.existsSync(sourceExe)) {
    console.error(`Build finished without output file: ${sourceExe}`);
    process.exit(1);
  }

  console.log(`Build version: ${version}`);
  console.log(`EXE: ${path.basename(sourceExe)}`);
}

function main() {
  const mode = process.argv[2] || "print";
  const serverDir = path.resolve(__dirname, "..");
  const version = getBuildVersion();
  writeBuildMeta(serverDir, version);

  if (mode === "print") {
    process.stdout.write(version);
    return;
  }

  if (mode === "build-exe") {
    buildExe(serverDir, version);
    return;
  }

  console.error(`Unknown mode: ${mode}`);
  process.exit(1);
}

main();

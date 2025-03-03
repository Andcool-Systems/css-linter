#!/usr/bin/env node
const { join } = require("path");
const { execFileSync } = require("child_process");
const os = require("os");

const binaries = {
    linux: "css-linter-linux",
    darwin: "css-linter-macos",
    win32: "css-linter-win.exe",
};

const platform = os.platform();
const binary = binaries[platform];

if (!binary) {
    console.error(`Unsupported platform: ${platform}`);
    process.exit(1);
}

const binaryPath = join(__dirname, "bin", binary);

try {
    execFileSync(binaryPath, process.argv.slice(2), { stdio: 'inherit' });
} catch (err) {
    console.error(err.message);
    process.exit(1);
}

const { writeFileSync, chmodSync, mkdirSync } = require("fs");
const { join } = require("path");
const { get } = require("https");
const os = require("os");
var pjson = require('../package.json');

const binaries = {
    linux: "css-linter-linux",
    darwin: "css-linter-macos",
    win32: "css-linter-win.exe",
};

let exe_ver = pjson.version.split('.').slice(0, 2).join('.');

const urls = {
    linux: `https://github.com/Andcool-Systems/css-linter/releases/download/v${exe_ver}/css-linter-linux`,
    darwin: `https://github.com/Andcool-Systems/css-linter/releases/download/v${exe_ver}/css-linter-macos`,
    win32: `https://github.com/Andcool-Systems/css-linter/releases/download/v${exe_ver}/css-linter-win.exe`,
};

const platform = os.platform();
const binary = binaries[platform];
const url = urls[platform];

if (!binary || !url) {
    console.error(`Unsupported platform: ${platform}`);
    process.exit(1);
}

const binPath = join(__dirname, "bin", binary);
mkdirSync(join(__dirname, "bin"), { recursive: true });

const downloadFile = (url, binPath) => {
    get(url, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
            const redirectUrl = res.headers.location;
            console.log(`Redirecting to ${redirectUrl}`);
            downloadFile(redirectUrl, binPath);
            return;
        }

        if (res.statusCode !== 200) {
            console.error(`Failed to download binary: ${res.statusCode}`);
            process.exit(1);
        }

        const file = [];
        res.on("data", (chunk) => file.push(chunk));
        res.on("end", () => {
            writeFileSync(binPath, Buffer.concat(file));
            chmodSync(binPath, 0o755);
            console.log(`Binary installed: ${binPath}`);
        });
    }).on('error', (err) => {
        console.error(`Error during download: ${err.message}`);
        process.exit(1);
    });
}

downloadFile(url, binPath);

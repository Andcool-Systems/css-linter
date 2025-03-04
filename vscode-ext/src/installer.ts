import { chmod, chmodSync, createWriteStream, existsSync, mkdirSync } from 'fs';
import os from 'os';
import path from 'path';
import axios from 'axios';

export const binaries: { [key: string]: string } = {
    linux: "css-linter-linux",
    darwin: "css-linter-macos",
    win32: "css-linter-win.exe",
};

const url = `https://github.com/Andcool-Systems/css-linter/releases/download`;

const download = (file_path: string, file_name: string): Promise<void> => new Promise<void>((resolve, reject) => {
    axios.get(file_path, {responseType: 'stream'})
        .then((response) => {
            const writer = createWriteStream(file_name);
            response.data.pipe(writer);
            writer.on("finish", resolve);
            writer.on("error", reject);
        })
        .catch(reject);
});


export const install = async (version: string) => {
    let exe_ver = version.split('.').slice(0, 2).join('.');

    const platform = os.platform();
    const binary = binaries[platform];
    const bin_url = `${url}/v${exe_ver}/${binary}`;

    if (!binary) {
        throw Error(`[CSS-linter][ERROR]: Unsupported platform`);
    }

    const homedir = os.homedir();
    const exec_path = path.join(homedir, '.css-linter', binary);
    if (!existsSync(exec_path)) {
        mkdirSync(path.join(homedir, '.css-linter'), { recursive: true });

        await download(bin_url, exec_path);
        chmodSync(exec_path, 0o755);
    }
};
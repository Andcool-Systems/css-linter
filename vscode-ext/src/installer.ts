import { chmodSync, createWriteStream, existsSync, mkdirSync, unlink, unlinkSync } from 'fs';
import os from 'os';
import path from 'path';
import axios from 'axios';
import { exec } from 'child_process';

export const binaries: { [key: string]: string } = {
    linux: 'css-linter-linux',
    darwin: 'css-linter-macos',
    win32: 'css-linter-win.exe'
};
const remote_repo = 'Andcool-Systems/css-linter';
const url = `https://github.com/${remote_repo}/releases/latest/download`;
const version_api_url = `https://api.github.com/repos/${remote_repo}/releases/latest`;

const getLatestVer = async (): Promise<string> => {
    const response = await axios.get(version_api_url);

    if (response.status !== 200) {
        throw Error('[CSS-linter][ERROR]: Got unexpected status code');
    }

    return response.data.tag_name;
};

const getCurrVer = (exec_path: string): Promise<string> =>
    new Promise((resolve, reject) => {
        exec(`${exec_path} -v`, (error, stdout, stderr) => {
            if (error || stderr) reject(error || stderr);
            resolve(stdout.trim());
        });
    });

const download = (file_path: string, file_name: string): Promise<void> =>
    new Promise<void>((resolve, reject) => {
        axios
            .get(file_path, { responseType: 'stream' })
            .then(response => {
                const writer = createWriteStream(file_name);
                response.data.pipe(writer);
                writer.on('finish', () => {
                    chmodSync(file_name, 0o755);
                    resolve();
                });
                writer.on('error', reject);
            })
            .catch(reject);
    });

export const install = async () => {
    const platform = os.platform();
    const binary = binaries[platform];
    const bin_url = `${url}/${binary}`;

    if (!binary) {
        throw Error(`[CSS-linter][ERROR]: Unsupported platform`);
    }

    const homedir = os.homedir();
    const exec_path = path.join(homedir, '.css-linter', binary);
    if (!existsSync(exec_path)) {
        mkdirSync(path.join(homedir, '.css-linter'), { recursive: true });

        await download(bin_url, exec_path);
    } else {
        const current_ver = await getCurrVer(exec_path);
        const latest_ver = await getLatestVer();

        console.info(
            `[CSS-linter][INFO]: Current version: ${current_ver} Remote version: ${latest_ver}`
        );

        if (current_ver === latest_ver) {
            return;
        }

        unlinkSync(exec_path);
        await download(bin_url, exec_path);
    }
};

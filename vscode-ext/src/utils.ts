import { exec, ExecOptions } from 'child_process';
import os from 'os';
import { binaries } from './installer';
import path from 'path';

export const execAsync = (command: string, opt?: ExecOptions): Promise<string> => {
    return new Promise((resolve, reject) =>
        exec(command, opt, (error, stdout, stderr) => {
            if (error || stderr) {
                reject(error || stderr);
            }
            resolve(stdout as string);
        })
    );
};

export const getExecPath = () => {
    const platform = os.platform();
    const binary = binaries[platform];
    const homedir = os.homedir();
    return path.join(homedir, '.css-linter', binary);
};

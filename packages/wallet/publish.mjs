// create a json file
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

// read the file and return as json
export async function readJsonFile(filename) {
    const filePath = path.join(process.cwd(), filename);
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
}

export async function readFile(filename) {
    const filePath = path.join(process.cwd(), filename);
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return fileContents;
}

// create a function to write to file
export async function writeJsonFile(filename, content) {
    const filePath = path.join(process.cwd(), filename);
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
}

export async function writeFile(filename, content) {
    const filePath = path.join(process.cwd(), filename);
    fs.writeFileSync(filePath, content);
}

// run a command
export async function runCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout.trim());
        });
    });
}

// wait 1 second
export async function wait() {
    return new Promise((resolve) => {
        setTimeout(resolve, 500);
    });
}


const json = await readJsonFile('package.json');

delete json.funding;
delete json.ethereum;
delete json.scripts;
delete json.sideEffects;
delete json.tarballHash;
delete json.repository;

json.name = 'pkp-eth-signer';
json.keywords.push('Lit Protocol');
json.keywords.push('PKP');
json.author = `${json.author} & modified by Anson (Lit Protocol)`;
json.description = `PKP Signer for ethers.`;

let version = await readFile('version.txt');
// bump version
version = version.replace(/(\d+)$/, (match, p1) => {
    return parseInt(p1) + 1;
});

await writeFile('version.txt', version);

json.version = version;

await writeJsonFile('pkp-package.json', json);
await writeJsonFile('check.json', json);
await wait();

await runCommand('mv package.json package.json.bak');
await wait();

await runCommand('mv pkp-package.json package.json');
await wait();

// await runCommand('cd ../../ && yarn build-all');
// await wait();

await runCommand('tsc --build ./tsconfig.json');
await wait();

await runCommand('npm publish --access public');
await wait();

await runCommand('rm package.json');
await wait();

await runCommand('mv package.json.bak package.json');

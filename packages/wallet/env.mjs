import path from 'path';
import fs from 'fs';
import { exit } from 'process';

// accept arguments from the command line
const args = process.argv.slice(2);
const env = args[0];

if ( env !== 'node' && env !== 'browser'){
    console.log('\x1b[31m%s\x1b[0m', 'Please specify the environment: "node" or "browser"');
    exit();
}

// remove a string from a file
export async function removeStringFromFile(filename, stringToRemove) {
    const filePath = path.join(process.cwd(), filename);
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const newFileContents = fileContents.replace(stringToRemove, '');
    fs.writeFileSync(filePath, newFileContents);
}

// add a string to a file after a given string
export async function addStringToFileAfter(filename, stringToAdd, stringToFind) {
    const filePath = path.join(process.cwd(), filename);
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const newFileContents = fileContents.replace(stringToFind, stringToFind + stringToAdd);
    fs.writeFileSync(filePath, newFileContents);
}

// replace a string in a file
export async function replaceStringInFile(filename, stringToReplace, stringToFind) {
    const filePath = path.join(process.cwd(), filename);
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const newFileContents = fileContents.replaceAll(stringToFind, stringToReplace);
    fs.writeFileSync(filePath, newFileContents);
}

const FILENAME = './src.ts/index.ts';
const README = 'README.md';
const NODE_README = 'pkp-eth-signer-node';
const BROWSER_README = 'pkp-eth-signer';
const BROWSER_FILE = 'import * as LitJsSdk from "lit-js-sdk"';
const NODE_FILE = 'import * as LitJsSdk from "lit-js-sdk/build/index.node.js";';

if ( env === 'node'){
    replaceStringInFile(FILENAME, NODE_FILE, BROWSER_FILE);
    replaceStringInFile(README, NODE_README, BROWSER_README);
    exit();
}

if ( env === 'browser'){
    replaceStringInFile(FILENAME, BROWSER_FILE, NODE_FILE);
    replaceStringInFile(README, BROWSER_README, NODE_README);
    exit();
}
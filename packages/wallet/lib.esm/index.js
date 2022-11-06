"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { getAddress } from "@ethersproject/address";
import { Provider } from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { arrayify, concat, hexDataSlice, isHexString, joinSignature } from "@ethersproject/bytes";
import { hashMessage, _TypedDataEncoder } from "@ethersproject/hash";
import { defaultPath, HDNode, entropyToMnemonic } from "@ethersproject/hdnode";
import { keccak256 } from "@ethersproject/keccak256";
import { defineReadOnly, resolveProperties } from "@ethersproject/properties";
import { randomBytes } from "@ethersproject/random";
import { SigningKey } from "@ethersproject/signing-key";
import { decryptJsonWallet, decryptJsonWalletSync, encryptKeystore } from "@ethersproject/json-wallets";
import { computeAddress, recoverAddress, serialize } from "@ethersproject/transactions";
// -- For node.js only --
// import * as LitJsSdk from "lit-js-sdk/build/index.node.js";
// -- For React etc, use the following instead --
// @ts-ignore
import * as LitJsSdk from "lit-js-sdk";
import { Logger } from "@ethersproject/logger";
import { version } from "./_version";
import { ethers } from 'ethers';
const logger = new Logger(version);
function isAccount(value) {
    return (value != null && isHexString(value.privateKey, 32) && value.address != null);
}
function hasMnemonic(value) {
    const mnemonic = value.mnemonic;
    return (mnemonic && mnemonic.phrase);
}
export class PKPWallet extends Signer {
    constructor(prop) {
        var _a, _b;
        super();
        this.pkpWalletProp = prop;
        this.litNodeClient = new LitJsSdk.LitNodeClient({
            litNetwork: (_a = prop.litNetwork) !== null && _a !== void 0 ? _a : 'serrano',
            debug: (_b = prop.debug) !== null && _b !== void 0 ? _b : false,
        });
        this.rpcProvider = new ethers.providers.JsonRpcBatchProvider(this.pkpWalletProp.provider);
    }
    runLitAction(toSign, sigName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.pkpWalletProp.controllerAuthSig || !this.pkpWalletProp.pkpPubKey) {
                throw new Error("controllerAuthSig and pkpPubKey are required");
            }
            const res = yield this.litNodeClient.executeJs({
                code: `
            (async () => {
                const sigShare = await LitActions.signEcdsa({ toSign, publicKey, sigName });
            })();`,
                authSig: this.pkpWalletProp.controllerAuthSig,
                jsParams: {
                    toSign,
                    publicKey: this.pkpWalletProp.pkpPubKey,
                    sigName,
                },
            });
            return res.signatures[sigName];
        });
    }
    get mnemonic() {
        throw new Error("There's no mnemonic for a PKPWallet");
    }
    ;
    get privateKey() {
        throw new Error("There's no private key for a PKPWallet. (Can you imagine!?)");
    }
    get publicKey() {
        return this.pkpWalletProp.pkpPubKey;
    }
    getAddress() {
        const addr = computeAddress(this.publicKey);
        return Promise.resolve(addr);
    }
    connect(provider) {
        throw new Error("PKPWallet cannot be connected to a provider");
        // return new Wallet(this, provider);
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.litNodeClient.connect();
        });
    }
    signTransaction(transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const addr = yield this.getAddress();
            if (!transaction['nonce']) {
                transaction.nonce = yield this.rpcProvider.getTransactionCount(addr);
            }
            if (!transaction['chainId']) {
                transaction.chainId = (yield this.rpcProvider.getNetwork()).chainId;
            }
            if (!transaction['gasPrice']) {
                transaction.gasPrice = yield this.rpcProvider.getGasPrice();
            }
            if (!transaction['gasLimit']) {
                transaction.gasLimit = 150000;
            }
            return resolveProperties(transaction).then((tx) => __awaiter(this, void 0, void 0, function* () {
                if (tx.from != null) {
                    if (getAddress(tx.from) !== this.address) {
                        logger.throwArgumentError("transaction from address mismatch", "transaction.from", transaction.from);
                    }
                    delete tx.from;
                }
                const serializedTx = serialize(tx);
                const unsignedTxn = keccak256(serializedTx);
                // -- lit action --
                const toSign = arrayify(unsignedTxn);
                const signature = (yield this.runLitAction(toSign, 'pkp-eth-sign-tx')).signature;
                // -- original code --
                // const signature = this._signingKey().signDigest(unsignedTxn);
                console.log("signature", signature);
                return serialize(tx, signature);
            }));
        });
    }
    signMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            // return joinSignature(this._signingKey().signDigest(hashMessage(message)));
            const toSign = arrayify(hashMessage(message));
            const signature = yield this.runLitAction(toSign, 'pkp-eth-sign-message');
            return joinSignature({
                r: '0x' + signature.r,
                s: '0x' + signature.s,
                v: signature.recid,
            });
            ;
        });
    }
    _signTypedData(domain, types, value) {
        return __awaiter(this, void 0, void 0, function* () {
            // Populate any ENS names
            const populated = yield _TypedDataEncoder.resolveNames(domain, types, value, (name) => {
                if (this.provider == null) {
                    logger.throwError("cannot resolve ENS names without a provider", Logger.errors.UNSUPPORTED_OPERATION, {
                        operation: "resolveName",
                        value: name
                    });
                }
                return this.provider.resolveName(name);
            });
            return joinSignature(this._signingKey().signDigest(_TypedDataEncoder.hash(populated.domain, types, populated.value)));
        });
    }
    encrypt(password, options, progressCallback) {
        if (typeof (options) === "function" && !progressCallback) {
            progressCallback = options;
            options = {};
        }
        if (progressCallback && typeof (progressCallback) !== "function") {
            throw new Error("invalid callback");
        }
        if (!options) {
            options = {};
        }
        return encryptKeystore(this, password, options, progressCallback);
    }
    sendTransaction(transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.rpcProvider.sendTransaction(transaction);
        });
    }
    ;
    /**
     *  Static methods to create Wallet instances.
     */
    static createRandom(options) {
        let entropy = randomBytes(16);
        if (!options) {
            options = {};
        }
        if (options.extraEntropy) {
            entropy = arrayify(hexDataSlice(keccak256(concat([entropy, options.extraEntropy])), 0, 16));
        }
        const mnemonic = entropyToMnemonic(entropy, options.locale);
        return Wallet.fromMnemonic(mnemonic, options.path, options.locale);
    }
    static fromEncryptedJson(json, password, progressCallback) {
        return decryptJsonWallet(json, password, progressCallback).then((account) => {
            return new Wallet(account);
        });
    }
    static fromEncryptedJsonSync(json, password) {
        return new Wallet(decryptJsonWalletSync(json, password));
    }
    static fromMnemonic(mnemonic, path, wordlist) {
        if (!path) {
            path = defaultPath;
        }
        return new Wallet(HDNode.fromMnemonic(mnemonic, null, wordlist).derivePath(path));
    }
}
export class Wallet extends Signer {
    constructor(privateKey, provider) {
        super();
        if (isAccount(privateKey)) {
            const signingKey = new SigningKey(privateKey.privateKey);
            defineReadOnly(this, "_signingKey", () => signingKey);
            defineReadOnly(this, "address", computeAddress(this.publicKey));
            if (this.address !== getAddress(privateKey.address)) {
                logger.throwArgumentError("privateKey/address mismatch", "privateKey", "[REDACTED]");
            }
            if (hasMnemonic(privateKey)) {
                const srcMnemonic = privateKey.mnemonic;
                defineReadOnly(this, "_mnemonic", () => ({
                    phrase: srcMnemonic.phrase,
                    path: srcMnemonic.path || defaultPath,
                    locale: srcMnemonic.locale || "en"
                }));
                const mnemonic = this.mnemonic;
                const node = HDNode.fromMnemonic(mnemonic.phrase, null, mnemonic.locale).derivePath(mnemonic.path);
                if (computeAddress(node.privateKey) !== this.address) {
                    logger.throwArgumentError("mnemonic/address mismatch", "privateKey", "[REDACTED]");
                }
            }
            else {
                defineReadOnly(this, "_mnemonic", () => null);
            }
        }
        else {
            if (SigningKey.isSigningKey(privateKey)) {
                /* istanbul ignore if */
                if (privateKey.curve !== "secp256k1") {
                    logger.throwArgumentError("unsupported curve; must be secp256k1", "privateKey", "[REDACTED]");
                }
                defineReadOnly(this, "_signingKey", () => privateKey);
            }
            else {
                // A lot of common tools do not prefix private keys with a 0x (see: #1166)
                if (typeof (privateKey) === "string") {
                    if (privateKey.match(/^[0-9a-f]*$/i) && privateKey.length === 64) {
                        privateKey = "0x" + privateKey;
                    }
                }
                const signingKey = new SigningKey(privateKey);
                defineReadOnly(this, "_signingKey", () => signingKey);
            }
            defineReadOnly(this, "_mnemonic", () => null);
            defineReadOnly(this, "address", computeAddress(this.publicKey));
        }
        /* istanbul ignore if */
        if (provider && !Provider.isProvider(provider)) {
            logger.throwArgumentError("invalid provider", "provider", provider);
        }
        defineReadOnly(this, "provider", provider || null);
    }
    get mnemonic() { return this._mnemonic(); }
    get privateKey() { return this._signingKey().privateKey; }
    get publicKey() { return this._signingKey().publicKey; }
    getAddress() {
        return Promise.resolve(this.address);
    }
    connect(provider) {
        return new Wallet(this, provider);
    }
    signTransaction(transaction) {
        return resolveProperties(transaction).then((tx) => __awaiter(this, void 0, void 0, function* () {
            if (tx.from != null) {
                if (getAddress(tx.from) !== this.address) {
                    logger.throwArgumentError("transaction from address mismatch", "transaction.from", transaction.from);
                }
                delete tx.from;
            }
            const serializedTx = serialize(tx);
            const unsignedTxn = keccak256(serializedTx);
            // -- lit action --
            // const toSign = arrayify(unsignedTxn);
            // const signature = (await this.runLitAction(toSign)).signature;
            // -- original code --
            const signature = this._signingKey().signDigest(unsignedTxn);
            console.log("signature", signature);
            return serialize(tx, signature);
        }));
    }
    signMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            return joinSignature(this._signingKey().signDigest(hashMessage(message)));
        });
    }
    _signTypedData(domain, types, value) {
        return __awaiter(this, void 0, void 0, function* () {
            // Populate any ENS names
            const populated = yield _TypedDataEncoder.resolveNames(domain, types, value, (name) => {
                if (this.provider == null) {
                    logger.throwError("cannot resolve ENS names without a provider", Logger.errors.UNSUPPORTED_OPERATION, {
                        operation: "resolveName",
                        value: name
                    });
                }
                return this.provider.resolveName(name);
            });
            return joinSignature(this._signingKey().signDigest(_TypedDataEncoder.hash(populated.domain, types, populated.value)));
        });
    }
    encrypt(password, options, progressCallback) {
        if (typeof (options) === "function" && !progressCallback) {
            progressCallback = options;
            options = {};
        }
        if (progressCallback && typeof (progressCallback) !== "function") {
            throw new Error("invalid callback");
        }
        if (!options) {
            options = {};
        }
        return encryptKeystore(this, password, options, progressCallback);
    }
    /**
     *  Static methods to create Wallet instances.
     */
    static createRandom(options) {
        let entropy = randomBytes(16);
        if (!options) {
            options = {};
        }
        if (options.extraEntropy) {
            entropy = arrayify(hexDataSlice(keccak256(concat([entropy, options.extraEntropy])), 0, 16));
        }
        const mnemonic = entropyToMnemonic(entropy, options.locale);
        return Wallet.fromMnemonic(mnemonic, options.path, options.locale);
    }
    static fromEncryptedJson(json, password, progressCallback) {
        return decryptJsonWallet(json, password, progressCallback).then((account) => {
            return new Wallet(account);
        });
    }
    static fromEncryptedJsonSync(json, password) {
        return new Wallet(decryptJsonWalletSync(json, password));
    }
    static fromMnemonic(mnemonic, path, wordlist) {
        if (!path) {
            path = defaultPath;
        }
        return new Wallet(HDNode.fromMnemonic(mnemonic, null, wordlist).derivePath(path));
    }
}
export function verifyMessage(message, signature) {
    return recoverAddress(hashMessage(message), signature);
}
export function verifyTypedData(domain, types, value, signature) {
    return recoverAddress(_TypedDataEncoder.hash(domain, types, value), signature);
}
//# sourceMappingURL=index.js.map
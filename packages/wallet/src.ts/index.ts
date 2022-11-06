"use strict";

import { getAddress } from "@ethersproject/address";
import { Provider, TransactionRequest } from "@ethersproject/abstract-provider";
import { ExternallyOwnedAccount, Signer, TypedDataDomain, TypedDataField, TypedDataSigner } from "@ethersproject/abstract-signer";
import { arrayify, Bytes, BytesLike, concat, hexDataSlice, isHexString, joinSignature, SignatureLike } from "@ethersproject/bytes";
import { hashMessage, _TypedDataEncoder } from "@ethersproject/hash";
import { defaultPath, HDNode, entropyToMnemonic, Mnemonic } from "@ethersproject/hdnode";
import { keccak256 } from "@ethersproject/keccak256";
import { defineReadOnly, resolveProperties } from "@ethersproject/properties";
import { randomBytes } from "@ethersproject/random";
import { SigningKey } from "@ethersproject/signing-key";
import { decryptJsonWallet, decryptJsonWalletSync, encryptKeystore, ProgressCallback } from "@ethersproject/json-wallets";
import { computeAddress, recoverAddress, serialize, UnsignedTransaction } from "@ethersproject/transactions";
import { Wordlist } from "@ethersproject/wordlists";

// -- For node.js only --
// import * as LitJsSdk from "lit-js-sdk/build/index.node.js";

// -- For React etc, use the following instead --
// @ts-ignore
import * as LitJsSdk from "lit-js-sdk";

import { Logger } from "@ethersproject/logger";
import { version } from "./_version";

import { ethers } from 'ethers'

const logger = new Logger(version);

function isAccount(value: any): value is ExternallyOwnedAccount {
    return (value != null && isHexString(value.privateKey, 32) && value.address != null);
}

function hasMnemonic(value: any): value is { mnemonic: Mnemonic } {
    const mnemonic = value.mnemonic;
    return (mnemonic && mnemonic.phrase);
}

export interface PKPWalletProp{
    pkpPubKey: string;
    controllerAuthSig: any;
    provider: string;
    litNetwork?: any;
    debug?: boolean;
}

export interface PKPSigner{
    initPKP(prop: PKPWalletProp): any;
    runLitAction(toSign: Uint8Array | BytesLike): Promise<any>
}

export class PKPWallet extends Signer implements ExternallyOwnedAccount, TypedDataSigner{

    readonly address: string;
    readonly provider: Provider;
    pkpWalletProp: PKPWalletProp;
    litNodeClient: any;
    rpcProvider: any;

    // Wrapping the _signingKey and _mnemonic in a getter function prevents
    // leaking the private key in console.log; still, be careful! :)
    readonly _signingKey: () => SigningKey;
    readonly _mnemonic: () => Mnemonic;

    async runLitAction(toSign: Uint8Array | BytesLike, sigName: string): Promise<any> {

        if ( ! this.pkpWalletProp.controllerAuthSig || ! this.pkpWalletProp.pkpPubKey) {
            throw new Error("controllerAuthSig and pkpPubKey are required");
        }

        const res = await this.litNodeClient.executeJs({
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
        
        return res.signatures[sigName]
    }

    constructor(prop?: PKPWalletProp) {
        super();

        this.pkpWalletProp = prop;

        this.litNodeClient = new LitJsSdk.LitNodeClient({ 
            litNetwork: prop.litNetwork ?? 'serrano',
            debug: prop.debug ?? false,
        });

        this.rpcProvider = new ethers.providers.JsonRpcBatchProvider(this.pkpWalletProp.provider);
    }

    get mnemonic() { 
        throw new Error("There's no mnemonic for a PKPWallet");
    };

    get privateKey(): string {
        throw new Error("There's no private key for a PKPWallet. (Can you imagine!?)");
    }
     
    get publicKey(): string { 
        return this.pkpWalletProp.pkpPubKey;
     }

    getAddress(): Promise<string> {
        const addr = computeAddress(this.publicKey);
        return Promise.resolve(addr);
    }

    connect(provider: Provider): Wallet {
        throw new Error("PKPWallet cannot be connected to a provider");
        // return new Wallet(this, provider);
    }

    async init(){
        await this.litNodeClient.connect();
    }

    async signTransaction(transaction: TransactionRequest): Promise<string> {

        const addr = await this.getAddress();

        if ( ! transaction['nonce'] ) {
            transaction.nonce = await this.rpcProvider.getTransactionCount(addr);
        }

        if ( ! transaction['chainId'] ) {
            transaction.chainId = (await this.rpcProvider.getNetwork()).chainId;
        }

        if ( ! transaction['gasPrice'] ) {
            transaction.gasPrice = await this.rpcProvider.getGasPrice();
        }

        if ( ! transaction['gasLimit'] ) {
            transaction.gasLimit = 150000;
        }

        return resolveProperties(transaction).then(async (tx) => {

            if (tx.from != null) {
                if (getAddress(tx.from) !== this.address) {
                    logger.throwArgumentError("transaction from address mismatch", "transaction.from", transaction.from);
                }
                delete tx.from;
            }

            const serializedTx = serialize(<UnsignedTransaction>tx);
            const unsignedTxn = keccak256(serializedTx);

            // -- lit action --
            const toSign = arrayify(unsignedTxn);
            const signature = (await this.runLitAction(toSign, 'pkp-eth-sign-tx')).signature;

            // -- original code --
            // const signature = this._signingKey().signDigest(unsignedTxn);

            console.log("signature", signature);

            return serialize(<UnsignedTransaction>tx, signature);
        });
    }

    async signMessage(message: Bytes | string): Promise<string> {

        // return joinSignature(this._signingKey().signDigest(hashMessage(message)));

        const toSign = arrayify(hashMessage(message));

        const signature = await this.runLitAction(toSign, 'pkp-eth-sign-message');

        return joinSignature({
            r: '0x' + signature.r,
            s: '0x' + signature.s,
            v: signature.recid,
        });
;
    }

    async _signTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, value: Record<string, any>): Promise<string> {
        // Populate any ENS names
        const populated = await _TypedDataEncoder.resolveNames(domain, types, value, (name: string) => {
            if (this.provider == null) {
                logger.throwError("cannot resolve ENS names without a provider", Logger.errors.UNSUPPORTED_OPERATION, {
                    operation: "resolveName",
                    value: name
                });
            }
            return this.provider.resolveName(name);
        });

        return joinSignature(this._signingKey().signDigest(_TypedDataEncoder.hash(populated.domain, types, populated.value)));
    }

    encrypt(password: Bytes | string, options?: any, progressCallback?: ProgressCallback): Promise<string> {
        if (typeof(options) === "function" && !progressCallback) {
            progressCallback = options;
            options = {};
        }

        if (progressCallback && typeof(progressCallback) !== "function") {
            throw new Error("invalid callback");
        }

        if (!options) { options = {}; }

        return encryptKeystore(this, password, options, progressCallback);
    }

    async sendTransaction(transaction: TransactionRequest | any): Promise<any> {
        return await this.rpcProvider.sendTransaction(transaction);
    };


    /**
     *  Static methods to create Wallet instances.
     */
    static createRandom(options?: any): Wallet {
        let entropy: Uint8Array = randomBytes(16);

        if (!options) { options = { }; }

        if (options.extraEntropy) {
            entropy = arrayify(hexDataSlice(keccak256(concat([ entropy, options.extraEntropy ])), 0, 16));
        }

        const mnemonic = entropyToMnemonic(entropy, options.locale);
        return Wallet.fromMnemonic(mnemonic, options.path, options.locale);
    }

    static fromEncryptedJson(json: string, password: Bytes | string, progressCallback?: ProgressCallback): Promise<Wallet> {
        return decryptJsonWallet(json, password, progressCallback).then((account) => {
            return new Wallet(account);
        });
    }

    static fromEncryptedJsonSync(json: string, password: Bytes | string): Wallet {
        return new Wallet(decryptJsonWalletSync(json, password));
    }

    static fromMnemonic(mnemonic: string, path?: string, wordlist?: Wordlist): Wallet {
        if (!path) { path = defaultPath; }
        return new Wallet(HDNode.fromMnemonic(mnemonic, null, wordlist).derivePath(path));
    }
}



export class Wallet extends Signer implements ExternallyOwnedAccount, TypedDataSigner {

    readonly address: string;
    readonly provider: Provider;
    pkpWalletProp: PKPWalletProp;
    litNodeClient: any;

    // Wrapping the _signingKey and _mnemonic in a getter function prevents
    // leaking the private key in console.log; still, be careful! :)
    readonly _signingKey: () => SigningKey;
    readonly _mnemonic: () => Mnemonic;

    constructor(privateKey?: BytesLike | ExternallyOwnedAccount | SigningKey, provider?: Provider) {
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
                defineReadOnly(this, "_mnemonic", () => (
                    {
                        phrase: srcMnemonic.phrase,
                        path: srcMnemonic.path || defaultPath,
                        locale: srcMnemonic.locale || "en"
                    }
                ));
                const mnemonic = this.mnemonic;
                const node = HDNode.fromMnemonic(mnemonic.phrase, null, mnemonic.locale).derivePath(mnemonic.path);
                if (computeAddress(node.privateKey) !== this.address) {
                    logger.throwArgumentError("mnemonic/address mismatch", "privateKey", "[REDACTED]");
                }
            } else {
                defineReadOnly(this, "_mnemonic", (): Mnemonic => null);
            }


        } else {
            if (SigningKey.isSigningKey(privateKey)) {
                /* istanbul ignore if */
                if (privateKey.curve !== "secp256k1") {
                    logger.throwArgumentError("unsupported curve; must be secp256k1", "privateKey", "[REDACTED]");
                }
                defineReadOnly(this, "_signingKey", () => (<SigningKey>privateKey));

            } else {
                // A lot of common tools do not prefix private keys with a 0x (see: #1166)
                if (typeof(privateKey) === "string") {
                    if (privateKey.match(/^[0-9a-f]*$/i) && privateKey.length === 64) {
                        privateKey = "0x" + privateKey;
                    }
                }

                const signingKey = new SigningKey(privateKey);
                defineReadOnly(this, "_signingKey", () => signingKey);
            }

            defineReadOnly(this, "_mnemonic", (): Mnemonic => null);
            defineReadOnly(this, "address", computeAddress(this.publicKey));
        }

        /* istanbul ignore if */
        if (provider && !Provider.isProvider(provider)) {
            logger.throwArgumentError("invalid provider", "provider", provider);
        }

        defineReadOnly(this, "provider", provider || null);
    }

    get mnemonic(): Mnemonic { return this._mnemonic(); }
    get privateKey(): string { return this._signingKey().privateKey; }
    get publicKey(): string { return this._signingKey().publicKey; }

    getAddress(): Promise<string> {
        return Promise.resolve(this.address);
    }

    connect(provider: Provider): Wallet {
        return new Wallet(this, provider);
    }

    signTransaction(transaction: TransactionRequest): Promise<string> {

        return resolveProperties(transaction).then(async (tx) => {

            if (tx.from != null) {
                if (getAddress(tx.from) !== this.address) {
                    logger.throwArgumentError("transaction from address mismatch", "transaction.from", transaction.from);
                }
                delete tx.from;
            }

            const serializedTx = serialize(<UnsignedTransaction>tx);
            const unsignedTxn = keccak256(serializedTx);

            // -- lit action --
            // const toSign = arrayify(unsignedTxn);
            // const signature = (await this.runLitAction(toSign)).signature;

            // -- original code --
            const signature = this._signingKey().signDigest(unsignedTxn);

            console.log("signature", signature);

            return serialize(<UnsignedTransaction>tx, signature);

        });
    }

    async signMessage(message: Bytes | string): Promise<string> {
        return joinSignature(this._signingKey().signDigest(hashMessage(message)));
    }

    async _signTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, value: Record<string, any>): Promise<string> {
        // Populate any ENS names
        const populated = await _TypedDataEncoder.resolveNames(domain, types, value, (name: string) => {
            if (this.provider == null) {
                logger.throwError("cannot resolve ENS names without a provider", Logger.errors.UNSUPPORTED_OPERATION, {
                    operation: "resolveName",
                    value: name
                });
            }
            return this.provider.resolveName(name);
        });

        return joinSignature(this._signingKey().signDigest(_TypedDataEncoder.hash(populated.domain, types, populated.value)));
    }

    encrypt(password: Bytes | string, options?: any, progressCallback?: ProgressCallback): Promise<string> {
        if (typeof(options) === "function" && !progressCallback) {
            progressCallback = options;
            options = {};
        }

        if (progressCallback && typeof(progressCallback) !== "function") {
            throw new Error("invalid callback");
        }

        if (!options) { options = {}; }

        return encryptKeystore(this, password, options, progressCallback);
    }


    /**
     *  Static methods to create Wallet instances.
     */
    static createRandom(options?: any): Wallet {
        let entropy: Uint8Array = randomBytes(16);

        if (!options) { options = { }; }

        if (options.extraEntropy) {
            entropy = arrayify(hexDataSlice(keccak256(concat([ entropy, options.extraEntropy ])), 0, 16));
        }

        const mnemonic = entropyToMnemonic(entropy, options.locale);
        return Wallet.fromMnemonic(mnemonic, options.path, options.locale);
    }

    static fromEncryptedJson(json: string, password: Bytes | string, progressCallback?: ProgressCallback): Promise<Wallet> {
        return decryptJsonWallet(json, password, progressCallback).then((account) => {
            return new Wallet(account);
        });
    }

    static fromEncryptedJsonSync(json: string, password: Bytes | string): Wallet {
        return new Wallet(decryptJsonWalletSync(json, password));
    }

    static fromMnemonic(mnemonic: string, path?: string, wordlist?: Wordlist): Wallet {
        if (!path) { path = defaultPath; }
        return new Wallet(HDNode.fromMnemonic(mnemonic, null, wordlist).derivePath(path));
    }
}

export function verifyMessage(message: Bytes | string, signature: SignatureLike): string {
    return recoverAddress(hashMessage(message), signature);
}

export function verifyTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, value: Record<string, any>, signature: SignatureLike): string {
    return recoverAddress(_TypedDataEncoder.hash(domain, types, value), signature);
}

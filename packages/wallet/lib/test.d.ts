import { Provider, TransactionRequest } from "@ethersproject/abstract-provider";
import { ExternallyOwnedAccount, Signer, TypedDataDomain, TypedDataField, TypedDataSigner } from "@ethersproject/abstract-signer";
import { Bytes, BytesLike, SignatureLike } from "@ethersproject/bytes";
import { Mnemonic } from "@ethersproject/hdnode";
import { SigningKey } from "@ethersproject/signing-key";
import { ProgressCallback } from "@ethersproject/json-wallets";
import { Wordlist } from "@ethersproject/wordlists";
export interface PKPWalletProp {
    pkpPubKey: string;
    controllerAuthSig: any;
    provider: string;
    litNetwork?: any;
    debug?: boolean;
}
export interface PKPSigner {
    initPKP(prop: PKPWalletProp): any;
    runLitAction(toSign: Uint8Array | BytesLike): Promise<any>;
}
export declare class PKPWallet extends Signer implements ExternallyOwnedAccount, TypedDataSigner {
    readonly address: string;
    readonly provider: Provider;
    pkpWalletProp: PKPWalletProp;
    litNodeClient: any;
    rpcProvider: any;
    readonly _signingKey: () => SigningKey;
    readonly _mnemonic: () => Mnemonic;
    runLitAction(toSign: Uint8Array | BytesLike, sigName: string): Promise<any>;
    constructor(prop?: PKPWalletProp);
    get mnemonic(): void;
    get privateKey(): string;
    get publicKey(): string;
    getAddress(): Promise<string>;
    connect(provider: Provider): Wallet;
    init(): Promise<void>;
    signTransaction(transaction: TransactionRequest): Promise<string>;
    signMessage(message: Bytes | string): Promise<string>;
    _signTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, value: Record<string, any>): Promise<string>;
    encrypt(password: Bytes | string, options?: any, progressCallback?: ProgressCallback): Promise<string>;
    sendTransaction(transaction: TransactionRequest | any): Promise<any>;
    /**
     *  Static methods to create Wallet instances.
     */
    static createRandom(options?: any): Wallet;
    static fromEncryptedJson(json: string, password: Bytes | string, progressCallback?: ProgressCallback): Promise<Wallet>;
    static fromEncryptedJsonSync(json: string, password: Bytes | string): Wallet;
    static fromMnemonic(mnemonic: string, path?: string, wordlist?: Wordlist): Wallet;
}
export declare class Wallet extends Signer implements ExternallyOwnedAccount, TypedDataSigner {
    readonly address: string;
    readonly provider: Provider;
    pkpWalletProp: PKPWalletProp;
    litNodeClient: any;
    readonly _signingKey: () => SigningKey;
    readonly _mnemonic: () => Mnemonic;
    constructor(privateKey?: BytesLike | ExternallyOwnedAccount | SigningKey, provider?: Provider);
    get mnemonic(): Mnemonic;
    get privateKey(): string;
    get publicKey(): string;
    getAddress(): Promise<string>;
    connect(provider: Provider): Wallet;
    signTransaction(transaction: TransactionRequest): Promise<string>;
    signMessage(message: Bytes | string): Promise<string>;
    _signTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, value: Record<string, any>): Promise<string>;
    encrypt(password: Bytes | string, options?: any, progressCallback?: ProgressCallback): Promise<string>;
    /**
     *  Static methods to create Wallet instances.
     */
    static createRandom(options?: any): Wallet;
    static fromEncryptedJson(json: string, password: Bytes | string, progressCallback?: ProgressCallback): Promise<Wallet>;
    static fromEncryptedJsonSync(json: string, password: Bytes | string): Wallet;
    static fromMnemonic(mnemonic: string, path?: string, wordlist?: Wordlist): Wallet;
}
export declare function verifyMessage(message: Bytes | string, signature: SignatureLike): string;
export declare function verifyTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, value: Record<string, any>, signature: SignatureLike): string;
//# sourceMappingURL=test.d.ts.map
import { ethers, Wallet, PKPWallet } from "ethers";

/** ========== Configuration ========== */
const provider = new ethers.providers.JsonRpcBatchProvider("https://matic-mumbai.chainstacklabs.com");
const CONTROLLER_ETH_ADDRESS = '0x1cD4147AF045AdCADe6eAC4883b9310FD286d95a';
const CONTROLLER_AUTHSIG = { "sig": "0xa5def1db6704f7fa95536a428421afd6ab5e81aafb44e677e1de743b7d6f78ce4b6c4d2eeb8421de5e89810a5f65c035ac3016cad55680df7cdf2ffa2dc8b4971c", "derivedVia": "web3.eth.personal.sign", "signedMessage": "localhost:3002 wants you to sign in with your Ethereum account:\n0x1cD4147AF045AdCADe6eAC4883b9310FD286d95a\n\n\nURI: http://localhost:3002/\nVersion: 1\nChain ID: 80001\nNonce: 5wd09QoRpKdJIR2SC\nIssued At: 2022-11-05T02:07:56.151Z\nExpiration Time: 2022-11-12T02:07:52.692Z", "address": "0x1cD4147AF045AdCADe6eAC4883b9310FD286d95a" };

const PKP_PUBKEY = '0x04801522b72d539344feeb2f5ffcb55e5fafbc39a608eb5843b3db16d2f56d6fde730ef49d282c4eb33729e6041bd54b932febb80ce3030d5e17ba06c2256d491e';
const PKP_ETH_ADDRESS = '0xe7A288418Cbf00F0141CEe91342cC8911Bc5a265';


// ----- Main -----
(async () => {

    const pkpWallet = new PKPWallet({
        pkpPubKey: PKP_PUBKEY,
        controllerAuthSig: CONTROLLER_AUTHSIG,
    });

    await pkpWallet.init();

    const tx = {
        to: CONTROLLER_ETH_ADDRESS,
        // value: ethers.utils.parseEther("0.000000000000000001"),
        value: 0,
        chainId: (await provider.getNetwork()).chainId,
        nonce: await provider.getTransactionCount(PKP_ETH_ADDRESS),
        gasPrice: await provider.getGasPrice(),
        gasLimit: 150000,
    };

    const signedTx = await pkpWallet.signTransaction(tx);
    console.log('signedTx:', signedTx);

    const sentTx = await provider.sendTransaction(signedTx);
    console.log("sentTx:", sentTx);

    // const signedMsg = await pkpWallet.signMessage("Secret Message.. shh!");
    // console.log('signedMsg:', signedMsg);

})();
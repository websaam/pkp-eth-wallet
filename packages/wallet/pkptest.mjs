import { PKPWallet } from "ethers";

/** ========== Configuration ========== */
const CONTROLLER_AUTHSIG = {};
const PKP_PUBKEY = '';

// -- TEST
const SEND_TO_ADDRESS = '';
const AMOUNT = 1; // 1 wei

// ----- Main -----
(async () => {

    const pkpWallet = new PKPWallet({
        pkpPubKey: PKP_PUBKEY,
        controllerAuthSig: CONTROLLER_AUTHSIG,
        provider: "https://rpc-mumbai.matic.today",
    });

    await pkpWallet.init();

    const tx = {
        to: SEND_TO_ADDRESS,
        value: AMOUNT, // 1 wei
        // value: ethers.utils.parseEther("0.000000000000000001"), // 1 wei
    };

    const signedTx = await pkpWallet.signTransaction(tx);
    console.log('signedTx:', signedTx);

    const sentTx = await pkpWallet.sendTransaction(signedTx);
    console.log("sentTx:", sentTx);

    // const signedMsg = await pkpWallet.signMessage("Secret Message.. shh!");
    // console.log('signedMsg:', signedMsg);

})();
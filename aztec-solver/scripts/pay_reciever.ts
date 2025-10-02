import {
  AztecAddress,
  ContractFunctionInteraction,
  createPXEClient,
  Fr,
  ProtocolContractAddress,
  TxStatus,
} from "@aztec/aztec.js";
import { getInitialTestAccountsManagers } from "@aztec/accounts/testing";
import { TokenContract } from "../artifacts/Token";
import {
  tokenAddress as tokenContractAddressString,
  privatePaymentAddress as privatePaymentContractAddressString,
} from "./deployment.json";
import { PrivatePaymentContract } from "../artifacts/PrivatePayment";
import { isConstructSignatureDeclaration } from "typescript";

const main = async () => {
  const NODE_URL = process.env.NODE_URL || "http://localhost:8080";

  const tokenContractAddress = AztecAddress.fromString(
    tokenContractAddressString,
  );

  const privatePaymentContractAddress = AztecAddress.fromString(
    privatePaymentContractAddressString,
  );

  const pxe = createPXEClient(NODE_URL);

  const wallets = await Promise.all(
    (await getInitialTestAccountsManagers(pxe)).map((manager) => {
      return manager.register();
    }),
  );

  const deployer = wallets[0];
  if (!deployer) throw new Error("Deployer wallet not found");

  const deployerAddress = deployer.getAddress();

  const recepient = wallets[1];
  if (!recepient) throw new Error("Recipient wallet not found");

  const mintAmount = 100;

  const recipientAddress = recepient.getAddress();

  const tokenContract = await TokenContract.at(tokenContractAddress, recepient);
  const privatePaymentContract = await PrivatePaymentContract.at(
    privatePaymentContractAddress,
    recepient,
  );

  const nonce = Fr.random();
  const authwit = await recepient.createAuthWit({
    caller: privatePaymentContractAddress,
    action: tokenContract
      .withWallet(recepient)
      .methods.transfer_private_to_private(
        recipientAddress,
        privatePaymentContractAddress,
        mintAmount,
        nonce,
      ),
  });

  const { status } = await privatePaymentContract
    .withWallet(recepient)
    .methods.complete_order(nonce)
    .with({ authWitnesses: [authwit] })
    .send({
      from: recipientAddress,
    })
    .wait();

  if (status === TxStatus.SUCCESS) {
    console.log("Order filled successfully");
  } else {
    console.log("Order filling failed");
    console.log("Error:", status);
    process.exit(1);
  }
};

main();

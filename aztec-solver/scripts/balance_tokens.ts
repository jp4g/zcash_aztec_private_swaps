import {
  AztecAddress,
  createPXEClient,
  ProtocolContractAddress,
  TxStatus,
} from "@aztec/aztec.js";
import { getInitialTestAccountsManagers } from "@aztec/accounts/testing";
import { TokenContract } from "../artifacts/Token";
import { tokenAddress as tokenContractAddressString } from "../deployment.json";
import { isConstructSignatureDeclaration } from "typescript";

const main = async () => {
  const NODE_URL = process.env.NODE_URL || "http://localhost:8080";
  const tokenContractAddress = AztecAddress.fromString(
    tokenContractAddressString,
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

  const tokenContract = await TokenContract.at(tokenContractAddress, deployer);

  const deployerBalance = await tokenContract.methods
    .balance_of_private(deployerAddress)
    .simulate({
      from: deployerAddress,
    });

  const recipientBalance = await tokenContract
    .withWallet(recepient)
    .methods.balance_of_private(recipientAddress)
    .simulate({
      from: recipientAddress,
    });

  console.log(`Deployer balance: ${deployerBalance}`);
  console.log(`Recipient balance: ${recipientBalance}`);
};

main();

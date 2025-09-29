import { AztecAddress, createPXEClient } from "@aztec/aztec.js";
import { getInitialTestAccountsManagers } from "@aztec/accounts/testing";
import { TokenContract } from "../deps/aztec-standards/artifacts/Token";
import { address as tokenContractAddressString } from "./deployment.json";

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

  const recipientAddress = recepient.getAddress();

  const tokenContract = await TokenContract.at(tokenContractAddress, deployer);

  const result = await tokenContract.methods
    .initialize_transfer_commitment(
      deployerAddress,
      recipientAddress,
      deployerAddress,
    )
    .prove({
      from: deployerAddress,
    });

  console.log("proven data", result.data);
};

main();

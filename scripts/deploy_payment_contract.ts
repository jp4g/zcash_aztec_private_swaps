import { writeFileSync } from "node:fs";

import { AztecAddress, createPXEClient } from "@aztec/aztec.js";
import { getInitialTestAccountsManagers } from "@aztec/accounts/testing";
import { PrivatePaymentContract } from "./artifacts/PrivatePayment";

import { tokenAddress as TokenAddressString } from "./deployment.json";

// this script deploys a defi-wonderland token contract
// it also mints
const main = async () => {
  const NODE_URL = process.env.NODE_URL || "http://localhost:8080";

  const pxe = createPXEClient(NODE_URL);

  const wallets = await Promise.all(
    (await getInitialTestAccountsManagers(pxe)).map((manager) => {
      return manager.register();
    }),
  );

  const deployWallet = wallets[0];
  if (!deployWallet) throw new Error("No deploy wallet found");

  const deployerAddress = deployWallet.getAddress();

  const tokenAddress = AztecAddress.fromString(TokenAddressString);
  const tokenAmount = 100;

  const { status, contract } = await PrivatePaymentContract.deployWithOpts(
    {
      wallet: deployWallet,
      method: "constructor",
    },
    tokenAddress,
    tokenAmount,
  )
    .send({
      from: deployerAddress,
    })
    .wait();

  if (status) {
    console.log(`Private payment contract deployed at ${contract.address}`);
    console.log(`Private payment contract status: ${status}`);

    writeFileSync(
      "./deployment.json",
      JSON.stringify({
        tokenAddress: TokenAddressString,
        privatePaymentAddress: contract.address,
      }),
    );
  } else {
    console.log(`Private payment contract deployment failed`);
    console.log(`Error: ${status}`);
    process.exit(1);
  }
};
main();

import { writeFileSync } from "node:fs";

import { createPXEClient } from "@aztec/aztec.js";
import { getInitialTestAccountsManagers } from "@aztec/accounts/testing";
import { TokenContract, TokenContractArtifact } from "../artifacts/Token";

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

  const tokenName = "USDC";
  const tokenSymbol = "USDC";
  const decimals = 18;

  const { status, contract } = await TokenContract.deployWithOpts(
    {
      wallet: deployWallet,
      method: "constructor_with_minter",
    },
    tokenName,
    tokenSymbol,
    decimals,
    deployerAddress,
    deployerAddress,
  )
    .send({
      from: deployerAddress,
    })
    .wait();

  if (status) {
    console.log(`Token contract deployed at ${contract.address}`);
    console.log(`Token contract status: ${status}`);

    writeFileSync(
      "./deployment.json",
      JSON.stringify({ tokenAddress: contract.address }),
    );
  } else {
    console.log(`Token contract deployment failed`);
    console.log(`Error: ${status}`);
    process.exit(1);
  }
};
main();

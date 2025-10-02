import express from "express"

import { AztecAddress, createPXEClient, deriveKeys, Fr, TxStatus } from "@aztec/aztec.js";
import { getInitialTestAccountsManagers } from "@aztec/accounts/testing";

import { PrivatePaymentContract } from "../artifacts/PrivatePayment"
import {tokenAddress as TokenAddressString} from "../deployment.json"
import { computePartialAddress } from "@aztec/stdlib/contract";
import { TokenContract } from "../artifacts/Token";

const main = async () => {
  const app = express();
  const PORT = process.env.PORT || 4000;

  const NODE_URL = process.env.NODE_URL || "http://localhost:8080";

  const pxe = createPXEClient(NODE_URL);

  const wallets = await Promise.all(
    (await getInitialTestAccountsManagers(pxe)).map((manager) => {
      return manager.register();
    }),
  );

  const deployWallet = wallets[0];
  if (!deployWallet) throw new Error("No deploy wallet found");

  const recepient = wallets[1];
  if (!recepient) throw new Error("Recipient wallet not found");

const deployerAddress = deployWallet.getAddress();
const recipientAddress = recepient.getAddress();


  const tokenName = "USDC";
  const tokenSymbol = "USDC";
  const decimals = 18;

  // Middleware
  app.use(express.json());

  app.post("/deploy_escrow", async (req: Request, res: Response) => {

    const { amount } = req.body;
    if (!amount) throw new Error("Amount is required");

    const tokenAddress = AztecAddress.fromString(TokenAddressString);
    const tokenAmount = amount;

    const contractSecretKey = Fr.random();
    const contractPublicKeys = (await deriveKeys(contractSecretKey)).publicKeys;

    const { status, contract } =
      await PrivatePaymentContract.deployWithPublicKeys(
        contractPublicKeys,
        deployWallet,
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

      const partialAddress = await computePartialAddress(contract.instance);
      await pxe.registerAccount(contractSecretKey, partialAddress);


      await res.json({
        contractAddress: contract.address.toString()
      });

    } else {
      console.log(`Private payment contract deployment failed`);
      console.log(`Error: ${status}`);
      res.status(500).json({ error: "Contract deployment failed" });
    }
  });

  app.post("/solve", async (req: Request, res: Response) => {
    let { contractAddress, amount } = req.body;
    if (!contractAddress) throw new Error("Contract address is required");

    const tokenContractAddress = AztecAddress.fromString(TokenAddressString);

  const tokenContract = await TokenContract.at(tokenContractAddress, recepient);
  const privatePaymentContract = await PrivatePaymentContract.at(
    contractAddress,
    recepient,
  );

  console.log("reques to solve contract address:", contractAddress);
  console.log("amount:", amount);

  contractAddress = AztecAddress.fromString(contractAddress);
  amount = Number(amount);
  if (!amount || amount <= 0) throw new Error("Amount must be greater than 0");

  const nonce = Fr.random();
  const authwit = await recepient.createAuthWit({
    caller: contractAddress,
    action: tokenContract
      .withWallet(recepient)
      .methods.transfer_private_to_private(
        recipientAddress,
        contractAddress,
        amount,
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
    res.json({message: "Order filled successfully"});
  } else {
    console.log("Order filling failed");
    console.log("Error:", status);
    res.status(500).json({ error: "Order filling failed" });
  }
  })

  app.get("/balance", async (req: Request, res: Response) => {
    const tokenAddress = AztecAddress.fromString(TokenAddressString);
    
    const tokenContract = await TokenContract.at(tokenAddress, recepient);
    const balance = await tokenContract
    .withWallet(deployWallet)
    .methods.balance_of_private(deployerAddress)
    .simulate({
      from: deployerAddress,
    });

    res.json({ balance: balance.toString() });
  });

  // Routes
  app.get("/", (req: Request, res: Response) => {
    res.json({ message: "Aztec Solver API" });
  });

  app.get("/health", (req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`Aztec Solver listening on http://localhost:${PORT}`);
  });
};

main();

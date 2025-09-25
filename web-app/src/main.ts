import initWasm, {initThreadPool, WebWallet} from "@chainsafe/webzjs-wallet"

  await initWasm();

const main = async () => {

  await initThreadPool(4);

  const wallet = new WebWallet("main", "https://zcash-mainnet.chainsafe.dev", 1);

  console.log("latest block",await wallet.get_latest_block());

}

main();
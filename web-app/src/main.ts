import initWasm, {initThreadPool, WebWallet} from "@chainsafe/webzjs-wallet"

await initWasm();

const main = async () => {

  await initThreadPool(4);

  const wallet = new WebWallet("main", "https://zcash-mainnet.chainsafe.dev", 1);

  const seedPhrase = import.meta.env.VITE_SEED_PHRASE;
  if(!seedPhrase) {
    throw new Error("VITE_SEED_PHRASE is not set");
  }

  const birthdayHeight = import.meta.env.VITE_BIRTHDAY_HEIGHT;
  if(!birthdayHeight) {
    throw new Error("VITE_BIRTHDAY_HEIGHT is not set");
  }

  const accountId = await wallet.create_account("account-0", seedPhrase, 1, parseInt(birthdayHeight));


  await wallet.sync();

  console.log("latest block",await wallet.get_latest_block());

}

main();
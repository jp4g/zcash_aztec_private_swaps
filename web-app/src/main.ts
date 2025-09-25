import initWasm, {initThreadPool, WebWallet} from "@chainsafe/webzjs-wallet"
import './style.css'

await initWasm();

// Helper functions to update UI
const showLoading = () => {
  const loading = document.getElementById('loading');
  const walletInfo = document.getElementById('wallet-info');
  const error = document.getElementById('error');
  
  if (loading) loading.style.display = 'block';
  if (walletInfo) walletInfo.style.display = 'none';
  if (error) error.style.display = 'none';
};

const showWalletInfo = (address: string, blockHeight: number) => {
  const loading = document.getElementById('loading');
  const walletInfo = document.getElementById('wallet-info');
  const paymentSection = document.getElementById('payment-section');
  const addressElement = document.getElementById('wallet-address');
  const headerBlockHeight = document.getElementById('header-block-height');
  const blockStatus = document.getElementById('block-status');
  const syncStatus = document.getElementById('sync-status');
  
  if (loading) loading.style.display = 'none';
  if (walletInfo) walletInfo.style.display = 'block';
  if (paymentSection) paymentSection.style.display = 'block';
  if (addressElement) addressElement.textContent = address;
  if (headerBlockHeight) headerBlockHeight.textContent = blockHeight.toString();
  if (blockStatus) blockStatus.style.display = 'flex';
  if (syncStatus) syncStatus.style.display = 'flex';
};

const showError = (message: string) => {
  const loading = document.getElementById('loading');
  const walletInfo = document.getElementById('wallet-info');
  const error = document.getElementById('error');
  const errorMessage = document.querySelector('.error-message');
  
  if (loading) loading.style.display = 'none';
  if (walletInfo) walletInfo.style.display = 'none';
  if (error) error.style.display = 'block';
  if (errorMessage) errorMessage.textContent = `Error: ${message}`;
};

// Copy to clipboard function
(window as any).copyToClipboard = (elementId: string) => {
  const element = document.getElementById(elementId);
  if (element && element.textContent) {
    navigator.clipboard.writeText(element.textContent).then(() => {
      // Show copy feedback
      const copyBtn = document.querySelector('.copy-btn') as HTMLButtonElement;
      if (copyBtn) {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        copyBtn.style.background = 'linear-gradient(135deg, var(--success-color), var(--primary-accent))';
        setTimeout(() => {
          copyBtn.textContent = originalText;
          copyBtn.style.background = 'linear-gradient(135deg, var(--primary-accent), var(--secondary-accent))';
        }, 2000);
      }
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  }
};

// Payment form handler
const handlePayment = async (recipientAddress: string, amountZatoshis: number, partialNote?: string) => {
  const payBtn = document.querySelector('.pay-btn') as HTMLButtonElement;
  const btnText = document.querySelector('.btn-text');
  const btnLoading = document.querySelector('.btn-loading');
  
  if (payBtn && btnText && btnLoading) {
    // Show loading state
    payBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'flex';
    
    try {
      // TODO: Implement actual payment logic with wallet
      console.log('Sending payment:', { recipientAddress, amountZatoshis, partialNote });
      
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // For now, just show success message
      const zecAmount = (amountZatoshis / 100000000).toFixed(8);
      const noteInfo = partialNote ? ` with partial note: ${partialNote}` : '';
      alert(`Payment of ${amountZatoshis} zatoshis (${zecAmount} ZEC) to ${recipientAddress}${noteInfo} initiated successfully!`);
      
      // Reset form
      const form = document.getElementById('payment-form') as HTMLFormElement;
      if (form) form.reset();
      
    } catch (error) {
      console.error('Payment failed:', error);
      showError(error instanceof Error ? error.message : 'Payment failed');
    } finally {
      // Reset button state
      payBtn.disabled = false;
      btnText.style.display = 'inline';
      btnLoading.style.display = 'none';
    }
  }
};

const main = async () => {
  try {
    showLoading();

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

    // Get wallet address and current block height
    const walletAddress = await wallet.get_current_address(accountId);
    const latestBlock = await wallet.get_latest_block();

    console.log("Wallet Address:", walletAddress);
    console.log("Latest Block:", latestBlock);

    // Display the information in the UI
    showWalletInfo(walletAddress, latestBlock);

    // Set up payment form event listener
    const paymentForm = document.getElementById('payment-form') as HTMLFormElement;
    if (paymentForm) {
      paymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const recipientInput = document.getElementById('recipient-address') as HTMLInputElement;
        const amountInput = document.getElementById('amount') as HTMLInputElement;
        const partialNoteInput = document.getElementById('partial-note') as HTMLInputElement;
        
        if (recipientInput && amountInput) {
          const recipientAddress = recipientInput.value.trim();
          const amountZatoshis = parseInt(amountInput.value);
          const partialNote = partialNoteInput?.value.trim() || undefined;
          
          // Validate zatoshi amount (must be positive integer)
          if (recipientAddress && amountZatoshis > 0 && Number.isInteger(amountZatoshis)) {
            // Validate hex string if provided
            if (partialNote && !/^[0-9a-fA-F]*$/.test(partialNote)) {
              showError('Partial note must be a valid hex string');
              return;
            }
            
            await handlePayment(recipientAddress, amountZatoshis, partialNote);
          } else {
            showError('Please enter a valid recipient address and positive zatoshi amount');
          }
        }
      });
    }

  } catch (error) {
    console.error("Error initializing wallet:", error);
    showError(error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

main();
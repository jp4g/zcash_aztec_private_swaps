import './style.css'

const API_BASE_URL = 'http://localhost:3000';

// Helper functions to update UI
const showLoading = () => {
  const loading = document.getElementById('loading');
  const walletInfo = document.getElementById('wallet-info');
  const error = document.getElementById('error');
  const success = document.getElementById('success-section');

  if (loading) loading.style.display = 'block';
  if (walletInfo) walletInfo.style.display = 'none';
  if (error) error.style.display = 'none';
  if (success) success.style.display = 'none';
};

const showWalletInfo = (address: string) => {
  const loading = document.getElementById('loading');
  const walletInfo = document.getElementById('wallet-info');
  const addressElement = document.getElementById('wallet-address');

  if (loading) loading.style.display = 'none';
  if (walletInfo) walletInfo.style.display = 'block';
  if (addressElement) addressElement.textContent = address;
};

const showSuccess = () => {
  const loading = document.getElementById('loading');
  const walletInfo = document.getElementById('wallet-info');
  const error = document.getElementById('error');
  const success = document.getElementById('success-section');

  if (loading) loading.style.display = 'none';
  if (walletInfo) walletInfo.style.display = 'none';
  if (error) error.style.display = 'none';
  if (success) success.style.display = 'block';
};

const showError = (message: string) => {
  const loading = document.getElementById('loading');
  const walletInfo = document.getElementById('wallet-info');
  const error = document.getElementById('error');
  const success = document.getElementById('success-section');
  const errorMessage = document.querySelector('.error-message');

  if (loading) loading.style.display = 'none';
  if (walletInfo) walletInfo.style.display = 'none';
  if (error) error.style.display = 'block';
  if (success) success.style.display = 'none';
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

// API functions
const getAddress = async (): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/get_address`);
  if (!response.ok) {
    throw new Error('Failed to get address');
  }
  return await response.text();
};

const createJob = async (): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/create_job`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to create job');
  }
  const data = await response.json();
  return data.job_id;
};

const getJobStatus = async (jobId: string): Promise<boolean> => {
  const response = await fetch(`${API_BASE_URL}/job_status/${jobId}`);
  if (!response.ok) {
    throw new Error('Failed to get job status');
  }
  const data = await response.json();
  return data.status === 'Completed';
};

// Poll job status until completed
const pollJobStatus = async (jobId: string): Promise<void> => {
  while (true) {
    const isCompleted = await getJobStatus(jobId);
    if (isCompleted) {
      break;
    }
    // Wait 2 seconds before polling again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
};

// Escrow form handler
const handleEscrowSubmission = async (partialAddress: string) => {
  const payBtn = document.querySelector('.pay-btn') as HTMLButtonElement;
  const btnText = document.querySelector('.btn-text');
  const btnLoading = document.querySelector('.btn-loading');

  if (payBtn && btnText && btnLoading) {
    // Show loading state
    payBtn.disabled = true;
    btnText.textContent = 'Creating job...';
    btnText.style.display = 'inline';
    btnLoading.style.display = 'none';

    try {
      console.log('Partial escrow address:', partialAddress);

      // Create job
      const jobId = await createJob();
      console.log('Job created:', jobId);

      // Update button to show polling status
      btnText.textContent = 'Waiting for confirmation...';

      // Poll job status until completed
      await pollJobStatus(jobId);

      // Show success message
      showSuccess();

    } catch (error) {
      console.error('Escrow submission failed:', error);
      showError(error instanceof Error ? error.message : 'Escrow submission failed');
      // Reset button state on error
      payBtn.disabled = false;
      btnText.textContent = 'Submit';
    }
  }
};

const main = async () => {
  try {
    showLoading();

    // Get address from server
    const address = await getAddress();
    console.log("Wallet Address:", address);

    // Display the information in the UI
    showWalletInfo(address);

    // Set up escrow form event listener
    const paymentForm = document.getElementById('payment-form') as HTMLFormElement;
    if (paymentForm) {
      paymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const partialAddressInput = document.getElementById('partial-address') as HTMLInputElement;

        if (partialAddressInput) {
          const partialAddress = partialAddressInput.value.trim();

          if (partialAddress) {
            await handleEscrowSubmission(partialAddress);
          } else {
            showError('Please enter a valid partial escrow address');
          }
        }
      });
    }

  } catch (error) {
    console.error("Error initializing app:", error);
    showError(error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

main();
import { ESCROW_CONTRACT_EVENT, getEscrowContract } from '../storage.ts'

const ZCASH_API_BASE_URL = 'http://localhost:3000'

type ZcashElements = {
  loading: HTMLElement | null
  walletInfo: HTMLElement | null
  walletAddress: HTMLElement | null
  paymentForm: HTMLFormElement | null
  partialAddress: HTMLInputElement | null
  amount: HTMLInputElement | null
  payButton: HTMLButtonElement | null
  btnText: HTMLElement | null
  btnLoading: HTMLElement | null
  successSection: HTMLElement | null
  errorSection: HTMLElement | null
  errorMessage: HTMLElement | null
  escrowInfo: HTMLElement | null
  copyButton: HTMLButtonElement | null
}

const getElements = (): ZcashElements => {
  const panel = document.getElementById('zcash-view')

  return {
    loading: document.getElementById('zcash-loading'),
    walletInfo: document.getElementById('zcash-wallet-info'),
    walletAddress: document.getElementById('zcash-wallet-address'),
    paymentForm: document.getElementById('zcash-payment-form') as HTMLFormElement | null,
    partialAddress: document.getElementById('zcash-partial-address') as HTMLInputElement | null,
    amount: document.getElementById('zcash-amount') as HTMLInputElement | null,
    payButton: panel?.querySelector<HTMLButtonElement>('.pay-btn') ?? null,
    btnText: panel?.querySelector('.btn-text') as HTMLElement | null,
    btnLoading: panel?.querySelector('.btn-loading') as HTMLElement | null,
    successSection: document.getElementById('zcash-success-section'),
    errorSection: document.getElementById('zcash-error'),
    errorMessage: document.querySelector('#zcash-error .error-message') as HTMLElement | null,
    escrowInfo: document.getElementById('zcash-escrow-info'),
    copyButton: panel?.querySelector<HTMLButtonElement>('.copy-btn') ?? null,
  }
}

const showLoading = (elements: ZcashElements) => {
  if (elements.loading) elements.loading.style.display = 'block'
  if (elements.walletInfo) elements.walletInfo.style.display = 'none'
  if (elements.errorSection) elements.errorSection.style.display = 'none'
  if (elements.successSection) elements.successSection.style.display = 'none'
}

const showWalletInfo = (elements: ZcashElements, address: string) => {
  if (elements.loading) elements.loading.style.display = 'none'
  if (elements.walletInfo) elements.walletInfo.style.display = 'block'
  if (elements.walletAddress) elements.walletAddress.textContent = address
}

const showSuccess = (elements: ZcashElements) => {
  if (elements.loading) elements.loading.style.display = 'none'
  if (elements.walletInfo) elements.walletInfo.style.display = 'none'
  if (elements.errorSection) elements.errorSection.style.display = 'none'
  if (elements.successSection) elements.successSection.style.display = 'block'
}

const showError = (elements: ZcashElements, message: string) => {
  if (elements.loading) elements.loading.style.display = 'none'
  if (elements.walletInfo) elements.walletInfo.style.display = 'none'
  if (elements.successSection) elements.successSection.style.display = 'none'
  if (elements.errorSection) elements.errorSection.style.display = 'block'
  if (elements.errorMessage) elements.errorMessage.textContent = `Error: ${message}`
}

const showEscrowInfo = (elements: ZcashElements) => {
  if (elements.escrowInfo) {
    elements.escrowInfo.style.display = 'block'
  }
}

const hideEscrowInfo = (elements: ZcashElements) => {
  if (elements.escrowInfo) {
    elements.escrowInfo.style.display = 'none'
  }
}

const applyEscrowContract = (elements: ZcashElements, address: string | null) => {
  if (elements.partialAddress) {
    elements.partialAddress.value = address ?? ''
  }

  if (address) {
    hideEscrowInfo(elements)
  } else {
    showEscrowInfo(elements)
  }
}

const getAddress = async (contract: string = "default"): Promise<string> => {
  const response = await fetch(`${ZCASH_API_BASE_URL}/get_address/${contract}`)
  if (!response.ok) {
    throw new Error('Failed to get address')
  }
  return response.text()
}

const createJob = async (contractAddress: string, amount: number): Promise<string> => {
  const response = await fetch(`${ZCASH_API_BASE_URL}/create_job`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contract_address: contractAddress,
      amount,
    }),
  })
  if (!response.ok) {
    throw new Error('Failed to create job')
  }
  const data = await response.json()
  return data.job_id
}

const getJobStatus = async (jobId: string): Promise<boolean> => {
  const response = await fetch(`${ZCASH_API_BASE_URL}/job_status/${jobId}`)
  if (!response.ok) {
    throw new Error('Failed to get job status')
  }
  const data = await response.json()
  return data.status === 'Completed'
}

const pollJobStatus = async (jobId: string): Promise<void> => {
  while (true) {
    const isCompleted = await getJobStatus(jobId)
    if (isCompleted) {
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
}

const handleEscrowSubmission = async (
  elements: ZcashElements,
  contractAddress: string,
  amount: number,
) => {
  const payBtn = elements.payButton
  const btnText = elements.btnText
  const btnLoading = elements.btnLoading

  if (payBtn && btnText && btnLoading) {
    payBtn.disabled = true
    btnText.textContent = 'Creating job...'
    btnText.style.display = 'inline'
    btnLoading.style.display = 'none'

    try {
      const jobId = await createJob(contractAddress, amount)
      btnText.textContent = 'Waiting for confirmation...'
      await pollJobStatus(jobId)
      showSuccess(elements)
    } catch (error) {
      console.error('Escrow submission failed:', error)
      showError(elements, error instanceof Error ? error.message : 'Escrow submission failed')
      payBtn.disabled = false
      btnText.textContent = 'Submit'
    }
  }
}

const setupCopyButton = (elements: ZcashElements) => {
  const button = elements.copyButton
  const addressElement = elements.walletAddress

  if (!button || !addressElement) {
    return
  }

  button.addEventListener('click', async () => {
    const address = addressElement.textContent ?? ''
    if (!address) {
      return
    }

    try {
      await navigator.clipboard.writeText(address)
      const originalText = button.textContent ?? 'Copy'
      button.textContent = 'Copied!'
      button.style.background = 'linear-gradient(135deg, var(--success-color), var(--primary-accent))'
      setTimeout(() => {
        button.textContent = originalText
        button.style.background = 'linear-gradient(135deg, var(--primary-accent), var(--secondary-accent))'
      }, 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  })
}

export const initZcashView = async () => {
  const elements = getElements()

  if (!elements.paymentForm || !elements.partialAddress || !elements.amount) {
    console.warn('Zcash view elements not found; skipping initialization')
    return
  }

  try {
    showLoading(elements)

    const address = await getAddress()
    showWalletInfo(elements, address)

    elements.paymentForm.setAttribute('novalidate', 'true')
    setupCopyButton(elements)

    const syncEscrowContract = (address: string | null) => {
      applyEscrowContract(elements, address)
    }

    syncEscrowContract(getEscrowContract())

    const handleEscrowUpdate = (event: Event) => {
      const { address: updatedAddress } = (event as CustomEvent<{ address: string }>).detail
      syncEscrowContract(updatedAddress)
    }

    window.addEventListener(ESCROW_CONTRACT_EVENT, handleEscrowUpdate)

    elements.partialAddress.addEventListener('input', () => {
      const inputValue = elements.partialAddress?.value.trim() ?? ''
      if (inputValue) {
        hideEscrowInfo(elements)
      } else if (!getEscrowContract()) {
        showEscrowInfo(elements)
      }
    })

    elements.paymentForm.addEventListener('submit', async (event) => {
      event.preventDefault()

      const contractAddress = elements.partialAddress?.value.trim()
      const amountValue = parseInt(elements.amount?.value ?? '0', 10)

      if (!contractAddress) {
        showEscrowInfo(elements)
        return
      }

      if (amountValue > 0) {
        hideEscrowInfo(elements)
        await handleEscrowSubmission(elements, contractAddress, amountValue)
      } else {
        showError(elements, 'Please enter a valid amount')
      }
    })
  } catch (error) {
    console.error('Error initializing Zcash view:', error)
    showError(elements, error instanceof Error ? error.message : 'Unknown error occurred')
  }
}

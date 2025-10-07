import './style.css'

type ViewName = 'zcash' | 'aztec'

const ZCASH_API_BASE_URL = 'http://localhost:3000'
const AZTEC_API_URL = 'http://localhost:4000'

const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab-button'))
const zcashPanel = document.getElementById('zcash-view') as HTMLElement | null
const aztecPanel = document.getElementById('aztec-view') as HTMLElement | null

const setActiveView = (view: ViewName) => {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.view === view
    button.classList.toggle('active', isActive)
  })

  if (zcashPanel && aztecPanel) {
    const panels: Record<ViewName, HTMLElement> = {
      zcash: zcashPanel,
      aztec: aztecPanel,
    }

    ;(Object.keys(panels) as ViewName[]).forEach((key) => {
      const panel = panels[key]
      const isActive = key === view
      panel.classList.toggle('active', isActive)
      if (isActive) {
        panel.removeAttribute('hidden')
      } else {
        panel.setAttribute('hidden', 'true')
      }
    })
  }
}

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const view = button.dataset.view as ViewName | undefined
    if (view) {
      setActiveView(view)
    }
  })
})

/* ------------------------------ Zcash view ------------------------------ */

const zcashElements = {
  loading: document.getElementById('zcash-loading'),
  walletInfo: document.getElementById('zcash-wallet-info'),
  walletAddress: document.getElementById('zcash-wallet-address'),
  paymentForm: document.getElementById('zcash-payment-form') as HTMLFormElement | null,
  partialAddress: document.getElementById('zcash-partial-address') as HTMLInputElement | null,
  amount: document.getElementById('zcash-amount') as HTMLInputElement | null,
  payButton: zcashPanel?.querySelector<HTMLButtonElement>('.pay-btn') ?? null,
  btnText: zcashPanel?.querySelector('.btn-text') as HTMLElement | null,
  btnLoading: zcashPanel?.querySelector('.btn-loading') as HTMLElement | null,
  successSection: document.getElementById('zcash-success-section'),
  errorSection: document.getElementById('zcash-error'),
  errorMessage: document.querySelector('#zcash-error .error-message') as HTMLElement | null,
  copyButton: zcashPanel?.querySelector<HTMLButtonElement>('.copy-btn') ?? null,
}

const showZcashLoading = () => {
  if (zcashElements.loading) zcashElements.loading.style.display = 'block'
  if (zcashElements.walletInfo) zcashElements.walletInfo.style.display = 'none'
  if (zcashElements.errorSection) zcashElements.errorSection.style.display = 'none'
  if (zcashElements.successSection) zcashElements.successSection.style.display = 'none'
}

const showZcashWalletInfo = (address: string) => {
  if (zcashElements.loading) zcashElements.loading.style.display = 'none'
  if (zcashElements.walletInfo) zcashElements.walletInfo.style.display = 'block'
  if (zcashElements.walletAddress) zcashElements.walletAddress.textContent = address
}

const showZcashSuccess = () => {
  if (zcashElements.loading) zcashElements.loading.style.display = 'none'
  if (zcashElements.walletInfo) zcashElements.walletInfo.style.display = 'none'
  if (zcashElements.errorSection) zcashElements.errorSection.style.display = 'none'
  if (zcashElements.successSection) zcashElements.successSection.style.display = 'block'
}

const showZcashError = (message: string) => {
  if (zcashElements.loading) zcashElements.loading.style.display = 'none'
  if (zcashElements.walletInfo) zcashElements.walletInfo.style.display = 'none'
  if (zcashElements.successSection) zcashElements.successSection.style.display = 'none'
  if (zcashElements.errorSection) zcashElements.errorSection.style.display = 'block'
  if (zcashElements.errorMessage) zcashElements.errorMessage.textContent = `Error: ${message}`
}

const getZcashAddress = async (): Promise<string> => {
  const response = await fetch(`${ZCASH_API_BASE_URL}/get_address`)
  if (!response.ok) {
    throw new Error('Failed to get address')
  }
  return response.text()
}

const createZcashJob = async (contractAddress: string, amount: number): Promise<string> => {
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

const getZcashJobStatus = async (jobId: string): Promise<boolean> => {
  const response = await fetch(`${ZCASH_API_BASE_URL}/job_status/${jobId}`)
  if (!response.ok) {
    throw new Error('Failed to get job status')
  }
  const data = await response.json()
  return data.status === 'Completed'
}

const pollZcashJobStatus = async (jobId: string): Promise<void> => {
  while (true) {
    const isCompleted = await getZcashJobStatus(jobId)
    if (isCompleted) {
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
}

const handleZcashEscrowSubmission = async (contractAddress: string, amount: number) => {
  const payBtn = zcashElements.payButton
  const btnText = zcashElements.btnText
  const btnLoading = zcashElements.btnLoading

  if (payBtn && btnText && btnLoading) {
    payBtn.disabled = true
    btnText.textContent = 'Creating job...'
    btnText.style.display = 'inline'
    btnLoading.style.display = 'none'

    try {
      const jobId = await createZcashJob(contractAddress, amount)
      btnText.textContent = 'Waiting for confirmation...'
      await pollZcashJobStatus(jobId)
      showZcashSuccess()
    } catch (error) {
      console.error('Escrow submission failed:', error)
      showZcashError(error instanceof Error ? error.message : 'Escrow submission failed')
      payBtn.disabled = false
      btnText.textContent = 'Submit'
    }
  }
}

const setupZcashCopyButton = () => {
  const button = zcashElements.copyButton
  const addressElement = zcashElements.walletAddress

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

const initZcashView = async () => {
  try {
    showZcashLoading()

    const address = await getZcashAddress()
    showZcashWalletInfo(address)

    setupZcashCopyButton()

    const form = zcashElements.paymentForm
    if (form && zcashElements.partialAddress && zcashElements.amount) {
      form.addEventListener('submit', async (event) => {
        event.preventDefault()

        const contractAddress = zcashElements.partialAddress?.value.trim()
        const amountValue = parseInt(zcashElements.amount?.value ?? '0', 10)

        if (contractAddress && amountValue > 0) {
          await handleZcashEscrowSubmission(contractAddress, amountValue)
        } else {
          showZcashError('Please enter a valid contract address and amount')
        }
      })
    }
  } catch (error) {
    console.error('Error initializing Zcash view:', error)
    showZcashError(error instanceof Error ? error.message : 'Unknown error occurred')
  }
}

/* ------------------------------ Aztec view ------------------------------ */

const aztecElements = {
  balance: document.getElementById('aztec-balance'),
  amount: document.getElementById('aztec-amount') as HTMLInputElement | null,
  deployBtn: document.getElementById('aztec-deploy-btn') as HTMLButtonElement | null,
  contractResult: document.getElementById('aztec-contract-result'),
  contractAddress: document.getElementById('aztec-contract-address'),
  copyHint: aztecPanel?.querySelector('.copy-hint') as HTMLElement | null,
  error: document.getElementById('aztec-error'),
}

let aztecBalanceInterval: number | undefined
let aztecErrorTimeout: number | undefined

const showAztecError = (message: string) => {
  if (!aztecElements.error) {
    return
  }
  aztecElements.error.textContent = message
  aztecElements.error.classList.add('show')
  if (aztecErrorTimeout) {
    window.clearTimeout(aztecErrorTimeout)
  }
  aztecErrorTimeout = window.setTimeout(() => {
    aztecElements.error?.classList.remove('show')
  }, 5000)
}

const clearAztecError = () => {
  if (!aztecElements.error) {
    return
  }
  aztecElements.error.classList.remove('show')
  if (aztecErrorTimeout) {
    window.clearTimeout(aztecErrorTimeout)
    aztecErrorTimeout = undefined
  }
}

const updateAztecBalance = (value: string) => {
  if (aztecElements.balance) {
    aztecElements.balance.textContent = value
  }
}

const fetchAztecBalance = async () => {
  try {
    const response = await fetch(`${AZTEC_API_URL}/balance`)
    if (!response.ok) {
      throw new Error('Failed to fetch balance. Make sure the API is running.')
    }
    const data = await response.json()
    updateAztecBalance(data.balance)
    clearAztecError()
  } catch (error) {
    console.error('Error fetching balance:', error)
    updateAztecBalance('ERROR')
    showAztecError('Failed to fetch balance. Make sure the API is running.')
  }
}

const deployAztecEscrow = async (amount: number): Promise<string> => {
  const response = await fetch(`${AZTEC_API_URL}/deploy_escrow`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount }),
  })

  if (!response.ok) {
    throw new Error('Deployment failed')
  }

  const data = await response.json()
  return data.contractAddress
}

const showAztecContractResult = (contractAddress: string) => {
  if (aztecElements.contractAddress && aztecElements.contractResult) {
    aztecElements.contractAddress.textContent = contractAddress
    aztecElements.contractResult.classList.add('show')
    clearAztecError()
  }
}

const setupAztecCopyHandler = () => {
  if (!aztecElements.contractAddress || !aztecElements.copyHint) {
    return
  }

  aztecElements.contractAddress.addEventListener('click', async () => {
    const address = aztecElements.contractAddress?.textContent ?? ''
    if (!address) {
      return
    }

    try {
      await navigator.clipboard.writeText(address)
      const originalText = aztecElements.copyHint?.textContent ?? 'Click to copy'
      if (aztecElements.copyHint) {
        aztecElements.copyHint.textContent = 'Copied!'
        aztecElements.copyHint.style.color = '#00ff00'
        setTimeout(() => {
          if (aztecElements.copyHint) {
            aztecElements.copyHint.textContent = originalText
            aztecElements.copyHint.style.color = '#666'
          }
        }, 2000)
      }
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  })
}

const setupAztecDeployHandler = () => {
  if (!aztecElements.deployBtn || !aztecElements.amount) {
    return
  }

  aztecElements.deployBtn.addEventListener('click', async () => {
    const amountValue = parseInt(aztecElements.amount?.value ?? '0', 10)

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      showAztecError('Please enter a valid amount')
      return
    }

    const button = aztecElements.deployBtn
    const originalText = button.innerHTML
    button.disabled = true
    button.innerHTML = 'DEPLOYING<span class="loading"></span>'

    try {
      const contractAddress = await deployAztecEscrow(amountValue)
      showAztecContractResult(contractAddress)
      fetchAztecBalance()
    } catch (error) {
      console.error('Error deploying escrow:', error)
      showAztecError('Failed to deploy escrow. Check console for details.')
    } finally {
      button.disabled = false
      button.innerHTML = originalText
    }
  })
}

const initAztecView = () => {
  setupAztecCopyHandler()
  setupAztecDeployHandler()
  fetchAztecBalance()

  if (aztecBalanceInterval) {
    window.clearInterval(aztecBalanceInterval)
  }
  aztecBalanceInterval = window.setInterval(fetchAztecBalance, 5000)
}

const bootstrap = () => {
  setActiveView('zcash')
  void initZcashView()
  initAztecView()
}

bootstrap()

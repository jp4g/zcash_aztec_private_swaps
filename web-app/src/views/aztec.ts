import { getEscrowContract, saveEscrowContract } from '../storage.ts'

const AZTEC_API_URL = 'http://localhost:4000'

type AztecElements = {
  balance: HTMLElement | null
  amount: HTMLInputElement | null
  deployBtn: HTMLButtonElement | null
  contractResult: HTMLElement | null
  contractAddress: HTMLElement | null
  copyHint: HTMLElement | null
  error: HTMLElement | null
}

const getElements = (): AztecElements => {
  const panel = document.getElementById('aztec-view')

  return {
    balance: document.getElementById('aztec-balance'),
    amount: document.getElementById('aztec-amount') as HTMLInputElement | null,
    deployBtn: document.getElementById('aztec-deploy-btn') as HTMLButtonElement | null,
    contractResult: document.getElementById('aztec-contract-result'),
    contractAddress: document.getElementById('aztec-contract-address'),
    copyHint: panel?.querySelector('.copy-hint') as HTMLElement | null,
    error: document.getElementById('aztec-error'),
  }
}

let balanceInterval: number | undefined
let errorTimeout: number | undefined

const showError = (elements: AztecElements, message: string) => {
  if (!elements.error) {
    return
  }
  elements.error.textContent = message
  elements.error.classList.add('show')
  if (errorTimeout) {
    window.clearTimeout(errorTimeout)
  }
  errorTimeout = window.setTimeout(() => {
    elements.error?.classList.remove('show')
  }, 5000)
}

const clearError = (elements: AztecElements) => {
  if (!elements.error) {
    return
  }
  elements.error.classList.remove('show')
  if (errorTimeout) {
    window.clearTimeout(errorTimeout)
    errorTimeout = undefined
  }
}

const updateBalance = (elements: AztecElements, value: string) => {
  if (elements.balance) {
    elements.balance.textContent = value
  }
}

const fetchBalance = async (elements: AztecElements) => {
  try {
    const response = await fetch(`${AZTEC_API_URL}/balance`)
    if (!response.ok) {
      throw new Error('Failed to fetch balance. Make sure the API is running.')
    }
    const data = await response.json()
    updateBalance(elements, data.balance)
    clearError(elements)
  } catch (error) {
    console.error('Error fetching balance:', error)
    updateBalance(elements, 'ERROR')
    showError(elements, 'Failed to fetch balance. Make sure the API is running.')
  }
}

const deployEscrow = async (amount: number): Promise<string> => {
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

const showContractResult = (elements: AztecElements, contractAddress: string) => {
  if (elements.contractAddress && elements.contractResult) {
    elements.contractAddress.textContent = contractAddress
    elements.contractResult.classList.add('show')
    clearError(elements)
  }
}

const setupCopyHandler = (elements: AztecElements) => {
  if (!elements.contractAddress || !elements.copyHint) {
    return
  }

  elements.contractAddress.addEventListener('click', async () => {
    const address = elements.contractAddress?.textContent ?? ''
    if (!address) {
      return
    }

    try {
      await navigator.clipboard.writeText(address)
      const originalText = elements.copyHint?.textContent ?? 'Click to copy'
      if (elements.copyHint) {
        elements.copyHint.textContent = 'Copied!'
        elements.copyHint.style.color = '#00ff00'
        setTimeout(() => {
          if (elements.copyHint) {
            elements.copyHint.textContent = originalText
            elements.copyHint.style.color = '#666'
          }
        }, 2000)
      }
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  })
}

const setupDeployHandler = (elements: AztecElements) => {
  if (!elements.deployBtn || !elements.amount) {
    return
  }

  elements.deployBtn.addEventListener('click', async () => {
    const amountValue = parseInt(elements.amount?.value ?? '0', 10)

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      showError(elements, 'Please enter a valid amount')
      return
    }

    const button = elements.deployBtn
    const originalText = button.innerHTML
    button.disabled = true
    button.innerHTML = 'DEPLOYING<span class="loading"></span>'

    try {
      const contractAddress = await deployEscrow(amountValue)
      saveEscrowContract(contractAddress)
      showContractResult(elements, contractAddress)
      fetchBalance(elements)
    } catch (error) {
      console.error('Error deploying escrow:', error)
      showError(elements, 'Failed to deploy escrow. Check console for details.')
    } finally {
      button.disabled = false
      button.innerHTML = originalText
    }
  })
}

export const initAztecView = () => {
  const elements = getElements()

  if (!elements.deployBtn || !elements.amount) {
    console.warn('Aztec view elements not found; skipping initialization')
    return
  }

  setupCopyHandler(elements)
  setupDeployHandler(elements)
  fetchBalance(elements)

  const storedContract = getEscrowContract()
  if (storedContract) {
    showContractResult(elements, storedContract)
  }

  if (balanceInterval) {
    window.clearInterval(balanceInterval)
  }
  balanceInterval = window.setInterval(() => fetchBalance(elements), 5000)
}

const ESCROW_CONTRACT_KEY = 'escrow contract'
export const ESCROW_CONTRACT_EVENT = 'escrow:updated'

export const getEscrowContract = (): string | null => {
  try {
    return window.localStorage.getItem(ESCROW_CONTRACT_KEY)
  } catch {
    return null
  }
}

export const saveEscrowContract = (address: string) => {
  try {
    window.localStorage.setItem(ESCROW_CONTRACT_KEY, address)
  } catch (error) {
    console.error('Failed to persist escrow contract address:', error)
  }

  window.dispatchEvent(
    new CustomEvent(ESCROW_CONTRACT_EVENT, {
      detail: { address },
    }),
  )
}

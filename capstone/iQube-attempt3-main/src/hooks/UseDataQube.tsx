import { useState, useEffect } from 'react'
import PolygonNFTInterface from '../utilities/MetaContract'
import { ABI } from '../utilities/ABI'

const CONTRACT_ADDRESS = '0x9FDbDa9040e9334bC31086562ED31f55E60be175'

const useNFTInterface = () => {
  const [nftInterface, setNftInterface] = useState<PolygonNFTInterface | null>(
    null,
  )
  const [account, setAccount] = useState<string>('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const initNFTInterface = async () => {
      try {
        const _interface = new PolygonNFTInterface(CONTRACT_ADDRESS, ABI)
        const accounts = await _interface.connectToMetaMask()
        setNftInterface(_interface)
        setAccount(accounts[0])
      } catch (error) {
        setError('Failed to initialize NFT interface')
        console.error('Initialization error:', error)
      }
    }
    initNFTInterface()
  }, [])

  return { nftInterface, account, error }
}

export default useNFTInterface

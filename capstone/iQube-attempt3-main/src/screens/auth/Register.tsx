import { FormEvent, useState } from 'react'
import InputField from '../../components/InputField'
import Btn from '../../components/Btn'
import {
  EOSPubKeyToFIOPubKey,
  buyFIOHandle,
} from '../../utilities/fioTransactionUtilsII'
import { MetaKeep } from 'metakeep'

const Signup = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [btnMessage, setBtnMessage] = useState('Register')
  const [btnClr, setBtnClr] = useState('bg-[#000]')
  const [FIOPubKey, setFIOPubKey] = useState('unknown')
  const [publicETHAddress, setPublicETHAddress] = useState('unknown')
  const [buyHandleResponse] = useState(null)

  const [email, setEmail] = useState('')
  const [fioHandle, setFioAddress] = useState('')
  const [errorMsg, setErrMsg] = useState('')

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()

    console.log('submitting')
    // Show the loader
    setIsLoading(true)
    setBtnMessage('Registering...')
    setBtnClr('bg-[#030303]')
    try {
      // Initialize the MetaKeep SDK
      const sdk = new MetaKeep({
        appId: 'bd7ce5a8-b8ed-4634-9d38-c679e7686c16',
        user: { email },
      })
      const wallet = await sdk.getWallet()
      console.log(wallet)

      setPublicETHAddress(wallet.wallet.ethAddress)

      const fioPubKey = EOSPubKeyToFIOPubKey(wallet.wallet.eosAddress)

      setFIOPubKey(fioPubKey)

      const buyHandleResponse = await buyFIOHandle({ fioHandle, fioPubKey })
      console.log(buyHandleResponse)

      if (!buyHandleResponse?.success)
        setErrMsg(`${email}:${buyHandleResponse?.error}`)
      else {
        // redirect.
      }
      window.location.href = '/dashboard'
    } catch (error) {
      window.location.href = '/dashboard'

      // alert(error.status ?? error.message)
    } finally {
      setIsLoading(false)
      setBtnMessage('Register')
      setBtnClr('bg-[#000]')
    }
  }

  return (
    <div className="flex justify-center items-center h-[100%] w-[100%] fixed">
      <div className="bg-[#fff] w-[600px] h-[600px] p-[40px] rounded-[10px]">
        <h4 className="mb-[10px]">Create Account</h4>
        <hr />

        <form action="" onSubmit={handleRegister}>
          <InputField
            placeholder="Email"
            value={email}
            setValue={setEmail}
            label="Provide your email"
          />

          <InputField
            placeholder="Fio Handle"
            value={fioHandle}
            setValue={setFioAddress}
            label="Enter your preferred handle (e.g. janedoe@knyt)"
          />

          <Btn btnText={btnMessage} btnClr={btnClr} />
        </form>

        <p className="text-[red] text-center">{errorMsg}</p>

        <p className="block text-[11px] text-[blue]">
          Your Public FIO Key: {FIOPubKey}
        </p>
        <p className="block text-[11px] text-[blue]">
          Your Public ETH Address: {publicETHAddress} {isLoading}
        </p>
        {buyHandleResponse && <span>Response: {buyHandleResponse}</span>}
      </div>
    </div>
    // <div className="form-container">
    //   <h2>Sign Up</h2>
    //   <form onSubmit={handleSubmit}>
    //     <input
    //       type="text"
    //       // placeholder="FIO Address"
    //       placeholder="Enter Username"
    //       value={userName}
    //       onChange={(e) => setUserName(e.target.value)}
    //       required
    //     />
    //     <input
    //       type="text"
    //       placeholder="Public Key"
    //       value={publicKey}
    //       onChange={(e) => setPublicKey(e.target.value)}
    //       required
    //     />
    //     <button type="submit">Sign Up</button>
    //   </form>

    //   <h4>{message.message}</h4>
    //   {message.response.wallet && (
    //     <h3>
    //       Wallet : {message.response.wallet} | fioAddress :{' '}
    //       {message.response.fioAddress}
    //     </h3>
    //   )}
    // </div>
  )
}

export default Signup

import Web3 from "web3";
// import { Avalanche } from "avalanche";
import { Contract } from "web3-eth-contract";
import { AbiItem } from "web3-utils";
import BN from "bn.js";

declare global {
 interface Window {
  ethereum: any;
 }
}

class AvalancheNFTInterfaceII {
 private web3: Web3;
 private contract: Contract<AbiItem[]>;

 constructor(contractAddress: string, abi: AbiItem[]) {
  if (typeof window.ethereum === "undefined") {
   throw new Error("MetaMask not detected");
  }

  this.web3 = new Web3(window.ethereum);
  this.contract = new this.web3.eth.Contract(abi, contractAddress);

  // Initialize Avalanche
  // this.avalanche = new Avalanche("api.avax-test.network", 1, "https", 43114);
 }

 async connectToMetaMask(): Promise<string[]> {
  try {
   const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
   });
   return accounts;
  } catch (error) {
   console.error("Failed to connect to MetaMask", error);
   throw error;
  }
 }

 async mintQube(uri: string, encryptionKey: string): Promise<any> {
  try {
   const accounts = await this.connectToMetaMask();
   const from = accounts[0];

   const gasPrice = await this.web3.eth.getGasPrice();
   const estimatedGas = await this.contract.methods
    .mintQube(uri, encryptionKey)
    .estimateGas({ from });

   const tx = await this.contract.methods.mintQube(uri, encryptionKey).send({
    from,
    gas: Math.floor(Number(estimatedGas) * 1.2).toString(), // Convert to string
    maxFeePerGas: gasPrice.toString(),
    maxPriorityFeePerGas: new BN(gasPrice.toString())
     .muln(10)
     .divn(100)
     .toString(),
   });

   return tx;
  } catch (error) {
   console.error("Error in mintQube:", error);
   throw error;
  }
 }

 async getBlakQube(tokenId: string): Promise<string> {
  return await this.contract.methods.getMetaQubeLocation(tokenId).call();
 }

 async getEncryptionKey(tokenId: string): Promise<string> {
  try {
   const accounts = await this.connectToMetaMask();
   return await this.contract.methods
    .getEncryptionKey(tokenId)
    .call({ from: accounts[0] });
  } catch (error) {
   throw error;
  }
 }

 async transferQube(to: string, tokenId: string): Promise<any> {
  const accounts = await this.connectToMetaMask();
  return await this.contract.methods
   .transferQube(to, tokenId)
   .send({ from: accounts[0] });
 }

 async tokenURI(tokenId: number): Promise<string> {
  return await this.contract.methods.tokenURI(tokenId).call();
 }

 async owner(): Promise<string> {
  return await this.contract.methods.owner().call();
 }

 async contractName(): Promise<string> {
  return await this.contract.methods.name().call();
 }

 async transferOwnership(newOwner: string): Promise<any> {
  const accounts = await this.connectToMetaMask();
  return await this.contract.methods
   .transferOwnership(newOwner)
   .send({ from: accounts[0] });
 }

 async getTokenIdFromReceipt(receipt: any): Promise<string | null> {
  const transferEvent = receipt.events.Transfer;
  if (transferEvent) {
   return transferEvent.returnValues.tokenId;
  }
  return null;
 }

 async getTotalSupply(): Promise<number> {
  try {
   const totalSupply = await this.contract.methods.totalSupply().call();
   return Number(totalSupply);
  } catch (error) {
   console.error("Error getting total supply:", error);
   throw error;
  }
 }

 async ownerOf(tokenId: string): Promise<string> {
  try {
   return await this.contract.methods.ownerOf(tokenId).call();
  } catch (error) {
   console.error("Error checking token ownership:", error);
   throw error;
  }
 }

 async balanceOf(address: string): Promise<number> {
  try {
   const balance = await this.contract.methods.balanceOf(address).call();
   return Number(balance);
  } catch (error) {
   console.error("Error getting balance:", error);
   throw error;
  }
 }

 async approve(to: string, tokenId: string): Promise<any> {
  try {
   const accounts = await this.connectToMetaMask();
   return await this.contract.methods
    .approve(to, tokenId)
    .send({ from: accounts[0] });
  } catch (error) {
   console.error("Error approving address:", error);
   throw error;
  }
 }

 async supportsInterface(interfaceId: string): Promise<boolean> {
  try {
   return await this.contract.methods.supportsInterface(interfaceId).call();
  } catch (error) {
   console.error("Error checking interface support:", error);
   throw error;
  }
 }
}

export default AvalancheNFTInterfaceII;

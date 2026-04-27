import Web3 from "web3";

declare global {
 interface Window {
  ethereum: any;
 }
}

class PolygonNFTInterface {
 private web3: Web3;
 private contract: any;

 constructor(contractAddress: string, abi: any) {
  if (typeof window.ethereum !== "undefined") {
   // Use MetaMask provider
   this.web3 = new Web3(window.ethereum);
  } else {
   throw new Error("MetaMask not detected");
  }
  this.contract = new this.web3.eth.Contract(abi, contractAddress);
 }

 async connectToMetaMask(): Promise<string[]> {
  try {
   // Request account access
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
   if (accounts.length === 0) {
    throw new Error("No accounts found. Make sure MetaMask is connected.");
   }

   const from = accounts[0];

   const networkId = await this.web3.eth.net.getId();
   const supportsEIP1559 = [1, 3, 4, 5].includes(Number(networkId));

   let txParams: any = { from };

   if (!supportsEIP1559) {
    console.log(
     "Network does not support EIP-1559, using legacy transaction type",
    );
    const gasPrice = await this.web3.eth.getGasPrice();
    txParams.gasPrice = gasPrice;
   } else {
    const gasPrice = await this.web3.eth.getGasPrice();
    txParams.maxFeePerGas = gasPrice;
    txParams.maxPriorityFeePerGas =
     (BigInt(gasPrice) * BigInt(10)) / BigInt(100);
   }

   // Estimate gas
   const estimatedGas = await this.contract.methods
    .mintQube(uri, encryptionKey)
    .estimateGas(txParams);

   // Convert estimatedGas to a regular number and add 20% buffer
   txParams.gas = Math.floor(Number(estimatedGas) * 1.2);

   // Send transaction using MetaMask
   return await this.contract.methods
    .mintQube(uri, encryptionKey)
    .send(txParams);
  } catch (error) {
   console.error("Error in mintQube:", error);
   throw error;
  }
 }

 async getBlakQube(tokenId: string): Promise<string> {
  return await this.contract.methods.getMetaQubeLocation(tokenId).call();
 }

 async getEncKey(tokenId: string): Promise<string> {
  return await this.contract.methods.getEncryptionKey(tokenId).call();
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
  const transferEvent = receipt.logs.find(
   (log: any) =>
    log.topics[0] === this.web3.utils.sha3("Transfer(address,address,uint256)"),
  );

  if (transferEvent) {
   const tokenId = this.web3.utils.hexToNumber(transferEvent.topics[3]);
   return tokenId.toString();
  }
  return null;
 }

 // New method to get total supply
 async getTotalSupply(): Promise<number> {
  try {
   const totalSupply = await this.contract.methods.totalSupply().call();
   return Number(totalSupply);
  } catch (error) {
   console.error("Error getting total supply:", error);
   throw error;
  }
 }

 // New method to check if an address owns a specific token
 async ownerOf(tokenId: string): Promise<string> {
  try {
   return await this.contract.methods.ownerOf(tokenId).call();
  } catch (error) {
   console.error("Error checking token ownership:", error);
   throw error;
  }
 }

 // New method to get the balance of NFTs for an address
 async balanceOf(address: string): Promise<number> {
  try {
   const balance = await this.contract.methods.balanceOf(address).call();
   return Number(balance);
  } catch (error) {
   console.error("Error getting balance:", error);
   throw error;
  }
 }

 // New method to approve another address to transfer a token
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

 // New method to check if a contract implements an interface
 async supportsInterface(interfaceId: string): Promise<boolean> {
  try {
   return await this.contract.methods.supportsInterface(interfaceId).call();
  } catch (error) {
   console.error("Error checking interface support:", error);
   throw error;
  }
 }
}

export default PolygonNFTInterface;

// import Web3 from "web3";

// declare global {
//  interface Window {
//   ethereum: any;
//  }
// }

// class PolygonNFTInterface {
//  private web3: Web3;
//  private contract: any;

//  constructor(contractAddress: string, abi: any) {
//   if (typeof window.ethereum !== "undefined") {
//    // Use MetaMask provider
//    this.web3 = new Web3(window.ethereum);
//   } else {
//    throw new Error("MetaMask not detected");
//   }
//   this.contract = new this.web3.eth.Contract(abi, contractAddress);
//  }

//  async connectToMetaMask(): Promise<string[]> {
//   try {
//    // Request account access
//    const accounts = await window.ethereum.request({
//     method: "eth_requestAccounts",
//    });
//    return accounts;
//   } catch (error) {
//    console.error("Failed to connect to MetaMask", error);
//    throw error;
//   }
//  }

//  async mintQube(to: string, uri: string, encryptionKey: string): Promise<any> {
//   try {
//    const accounts = await this.connectToMetaMask();
//    if (accounts.length === 0) {
//     throw new Error("No accounts found. Make sure MetaMask is connected.");
//    }

//    const from = accounts[0];

//    const networkId = await this.web3.eth.net.getId();
//    const supportsEIP1559 = [1, 3, 4, 5].includes(Number(networkId));

//    let txParams: any = { from };

//    if (!supportsEIP1559) {
//     console.log(
//      "Network does not support EIP-1559, using legacy transaction type",
//     );
//     const gasPrice = await this.web3.eth.getGasPrice();
//     txParams.gasPrice = gasPrice;
//    }

//    // Estimate gas
//    const estimatedGas = await this.contract.methods
//     .mintQube(to, uri, encryptionKey)
//     .estimateGas(txParams);

//    // Convert estimatedGas to a regular number and add 20% buffer
//    txParams.gas = Math.floor(Number(estimatedGas) * 1.2);

//    // Send transaction using MetaMask
//    return await this.contract.methods
//     .mintQube(to, uri, encryptionKey)
//     .send(txParams);
//   } catch (error) {
//    console.error("Error in mintQube:", error);
//    throw error;
//   }
//  }

//  async getBlakQube(tokenId: string): Promise<string> {
//   return await this.contract.methods.getMetaQubeLocation(tokenId).call();
//  }

//  async getEncryptionKey(tokenId: string): Promise<string> {
//   try {
//    const accounts = await this.connectToMetaMask();
//    return await this.contract.methods
//     .getEncryptionKey(tokenId)
//     .call({ from: accounts[0] });
//   } catch (error) {
//    throw error;
//   }
//  }

//  async transferQube(to: string, tokenId: string): Promise<any> {
//   const accounts = await this.connectToMetaMask();
//   return await this.contract.methods
//    .transferQube(to, tokenId)
//    .send({ from: accounts[0] });
//  }

//  async tokenURI(tokenId: number): Promise<string> {
//   return await this.contract.methods.tokenURI(tokenId).call();
//  }

//  async owner() {
//   return await this.contract.methods.owner().call();
//  }

//  async contractName() {
//   return await this.contract.methods.name().call();
//  }

//  async transferOwnership(newOwner: string) {
//   const accounts = await this.connectToMetaMask();
//   return await this.contract.methods
//    .transferOwnership(newOwner)
//    .send({ from: accounts[0] });
//  }

//  async getTokenIdFromReceipt(receipt: any): Promise<string | null> {
//   // Option 1: Parse logs for Transfer event
//   const transferEvent = receipt.logs.find(
//    (log: any) =>
//     log.topics[0] === Web3.utils.sha3("Transfer(address,address,uint256)"),
//   );

//   if (transferEvent) {
//    const tokenId = Web3.utils.hexToNumber(transferEvent.topics[3]);
//    return tokenId.toString();
//   }

//   // Option 2: Query the contract for the latest token (if applicable)
//   try {
//    const latestTokenId = await this.contract.methods.getLatestTokenId().call();
//    return latestTokenId.toString();
//   } catch (error) {
//    console.error("Error getting latest token ID:", error);
//   }

//   // If we couldn't get the token ID
//   return null;
//  }
// }

// export default PolygonNFTInterface;

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PolityOffchainResolver
 * @notice Minimal CCIP-Read (EIP-3668) ENS resolver for polity.eth.
 *
 * Forwards all wildcard subname lookups (e.g. first-citizen.polity.eth) to
 * the Polity Passport Bureau gateway, which serves signed records out of
 * the persona_ens_names DB. Signature is verified on-chain against the
 * Polity issuer address (POLITY_ISSUER_PRIVATE_KEY's public address).
 *
 * Modelled on ENS Labs' OffchainResolver reference:
 *   github.com/ensdomains/offchain-resolver
 *
 * Deploy with `scripts/deploy-polity-resolver.ts`:
 *   1. Deploy this contract with constructor(url, signer) where:
 *      - url   = "https://dev-beta.aigentz.me/api/ens/ccip-read/{sender}/{data}.json"
 *      - signer = the polity issuer EVM address from GET /api/polity-passport/issuer
 *   2. Set this contract as the resolver on polity.eth via the ENS app.
 *
 * After deploy + resolver-set, any ENS-aware tool resolving e.g.
 * first-citizen.polity.eth will receive the signed record from our gateway.
 */

interface IExtendedResolver {
    function resolve(bytes memory name, bytes memory data) external view returns (bytes memory);
}

interface ISupportsInterface {
    function supportsInterface(bytes4 interfaceID) external pure returns (bool);
}

error OffchainLookup(address sender, string[] urls, bytes callData, bytes4 callbackFunction, bytes extraData);

contract PolityOffchainResolver is IExtendedResolver, ISupportsInterface {
    string public url;
    address public signer;
    address public owner;

    event NewSigner(address indexed signer);
    event NewUrl(string url);

    constructor(string memory _url, address _signer) {
        url = _url;
        signer = _signer;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function setSigner(address _signer) external onlyOwner {
        signer = _signer;
        emit NewSigner(_signer);
    }

    function setUrl(string calldata _url) external onlyOwner {
        url = _url;
        emit NewUrl(_url);
    }

    /// @notice ENS resolve(bytes,bytes) entry point — always reverts with
    /// OffchainLookup pointing at our gateway. The full calldata is
    /// forwarded to the gateway so it can decode (name, data) and serve
    /// any of addr / addr+coin / text records.
    function resolve(bytes calldata, bytes calldata) external view override returns (bytes memory) {
        string[] memory urls = new string[](1);
        urls[0] = url;
        revert OffchainLookup(
            address(this),
            urls,
            msg.data,
            this.resolveWithProof.selector,
            msg.data
        );
    }

    /// @notice CCIP-Read callback. Verifies the signed response from the
    /// gateway and returns the result. The hash format mirrors
    /// services/identity/polityIssuer.ts on the server.
    /// hash = keccak256(0x1900 || resolver_addr || expires(uint64) || keccak256(request) || keccak256(result))
    function resolveWithProof(bytes calldata response, bytes calldata extraData) external view returns (bytes memory) {
        (bytes memory result, uint64 expires, bytes memory sig) = abi.decode(response, (bytes, uint64, bytes));
        require(expires >= block.timestamp, "signature expired");

        bytes32 hash = keccak256(
            abi.encodePacked(
                hex"1900",
                address(this),
                expires,
                keccak256(extraData),
                keccak256(result)
            )
        );
        address recovered = recoverSigner(hash, sig);
        require(recovered == signer, "bad sig");
        return result;
    }

    function supportsInterface(bytes4 interfaceID) external pure override returns (bool) {
        return
            interfaceID == this.resolve.selector ||
            interfaceID == this.supportsInterface.selector ||
            interfaceID == 0x9061b923; // IExtendedResolver
    }

    /// @notice ECDSA recover with v adjustment (v = 27 or 28).
    function recoverSigner(bytes32 hash, bytes memory sig) internal pure returns (address) {
        require(sig.length == 65, "bad sig len");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
        return ecrecover(hash, v, r, s);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ClaimManager {
    event ClaimRedeemed(bytes32 indexed claimId, address indexed to, uint256 amount, bytes32 srcTx);

    mapping(bytes32 => bool) public redeemed;

    function redeem(
        bytes32 claimId,
        address to,
        uint256 amount,
        bytes calldata /*dvnAttestation*/
    ) external {
        require(!redeemed[claimId], "already redeemed");
        redeemed[claimId] = true;
        // srcTx is placeholder zero for demo
        emit ClaimRedeemed(claimId, to, amount, bytes32(0));
    }

    function cancelExpired(bytes32 claimId) external {
        redeemed[claimId] = true;
    }
}

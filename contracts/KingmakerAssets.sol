// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// KINGMAKER multi-asset ownership contract template.
// Uses OpenZeppelin Contracts v5. Install @openzeppelin/contracts before compiling.
// This template is NOT audited and must not be deployed with real assets or funds
// until reviewed, tested, and configured for the selected production network.

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract KingmakerAssets is ERC1155, ERC1155Supply, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    struct AssetDefinition {
        uint128 maxSupply;
        bool exists;
    }

    mapping(uint256 => AssetDefinition) public assetDefinitions;

    error AssetAlreadyDefined(uint256 assetId);
    error UnknownAsset(uint256 assetId);
    error InvalidCap();
    error CapExceeded(uint256 assetId, uint256 requested, uint256 remaining);

    event AssetDefined(uint256 indexed assetId, uint256 maxSupply);
    event AssetMinted(address indexed recipient, uint256 indexed assetId, uint256 amount);

    constructor(string memory initialBaseURI, address admin)
        ERC1155(initialBaseURI)
    {
        require(admin != address(0), "admin is zero");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    function defineAsset(uint256 assetId, uint128 maxSupply)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (assetDefinitions[assetId].exists) revert AssetAlreadyDefined(assetId);
        if (maxSupply == 0) revert InvalidCap();
        assetDefinitions[assetId] = AssetDefinition({maxSupply: maxSupply, exists: true});
        emit AssetDefined(assetId, maxSupply);
    }

    function mint(address recipient, uint256 assetId, uint256 amount, bytes calldata data)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
    {
        AssetDefinition memory definition = assetDefinitions[assetId];
        if (!definition.exists) revert UnknownAsset(assetId);
        uint256 current = totalSupply(assetId);
        uint256 remaining = uint256(definition.maxSupply) - current;
        if (amount == 0 || amount > remaining) {
            revert CapExceeded(assetId, amount, remaining);
        }
        _mint(recipient, assetId, amount, data);
        emit AssetMinted(recipient, assetId, amount);
    }

    function mintBatch(
        address recipient,
        uint256[] calldata assetIds,
        uint256[] calldata amounts,
        bytes calldata data
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(assetIds.length == amounts.length, "length mismatch");
        for (uint256 i = 0; i < assetIds.length; i++) {
            AssetDefinition memory definition = assetDefinitions[assetIds[i]];
            if (!definition.exists) revert UnknownAsset(assetIds[i]);
            uint256 current = totalSupply(assetIds[i]);
            uint256 remaining = uint256(definition.maxSupply) - current;
            if (amounts[i] == 0 || amounts[i] > remaining) {
                revert CapExceeded(assetIds[i], amounts[i], remaining);
            }
            // Prevent duplicate IDs from bypassing the per-ID cap in one batch.
            for (uint256 j = 0; j < i; j++) {
                require(assetIds[j] != assetIds[i], "duplicate asset id");
            }
        }
        _mintBatch(recipient, assetIds, amounts, data);
        for (uint256 i = 0; i < assetIds.length; i++) {
            emit AssetMinted(recipient, assetIds[i], amounts[i]);
        }
    }

    function burn(address account, uint256 assetId, uint256 amount) external whenNotPaused {
        require(account == _msgSender() || isApprovedForAll(account, _msgSender()), "not owner/approved");
        _burn(account, assetId, amount);
    }

    function setBaseURI(string calldata newBaseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(newBaseURI);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override(ERC1155, ERC1155Supply)
        whenNotPaused
    {
        super._update(from, to, ids, values);
    }
}

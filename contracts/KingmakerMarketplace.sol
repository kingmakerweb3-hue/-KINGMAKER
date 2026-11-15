// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// KINGMAKER escrow marketplace prototype.
// Native-currency settlement only. NOT audited; do not deploy with valuable assets.
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

contract KingmakerMarketplace is IERC1155Receiver, ERC165, ReentrancyGuard {
    enum ListingStatus { None, Active, Sold, Cancelled }

    struct Listing {
        address seller;
        address assetContract;
        uint256 tokenId;
        uint256 amount;
        uint256 price;
        ListingStatus status;
    }

    uint256 public nextListingId = 1;
    mapping(uint256 => Listing) public listings;
    mapping(address => uint256) public pendingProceeds;

    error InvalidAddress();
    error InvalidAmountOrPrice();
    error ListingNotActive();
    error NotSeller();
    error IncorrectPayment(uint256 expected, uint256 received);
    error NothingToWithdraw();
    error TransferFailed();

    event ListingCreated(uint256 indexed listingId, address indexed seller, address indexed assetContract, uint256 tokenId, uint256 amount, uint256 price);
    event ListingCancelled(uint256 indexed listingId);
    event AssetPurchased(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 price);
    event ProceedsWithdrawn(address indexed seller, uint256 amount);

    function createListing(address assetContract, uint256 tokenId, uint256 amount, uint256 price)
        external nonReentrant returns (uint256 listingId)
    {
        if (assetContract == address(0)) revert InvalidAddress();
        if (amount == 0 || price == 0) revert InvalidAmountOrPrice();

        listingId = nextListingId++;
        listings[listingId] = Listing({
            seller: msg.sender,
            assetContract: assetContract,
            tokenId: tokenId,
            amount: amount,
            price: price,
            status: ListingStatus.Active
        });

        IERC1155(assetContract).safeTransferFrom(msg.sender, address(this), tokenId, amount, abi.encode(listingId));
        emit ListingCreated(listingId, msg.sender, assetContract, tokenId, amount, price);
    }

    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        if (listing.status != ListingStatus.Active) revert ListingNotActive();
        if (listing.seller != msg.sender) revert NotSeller();

        listing.status = ListingStatus.Cancelled;
        IERC1155(listing.assetContract).safeTransferFrom(address(this), listing.seller, listing.tokenId, listing.amount, "");
        emit ListingCancelled(listingId);
    }

    function purchase(uint256 listingId) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        if (listing.status != ListingStatus.Active) revert ListingNotActive();
        if (msg.value != listing.price) revert IncorrectPayment(listing.price, msg.value);

        listing.status = ListingStatus.Sold;
        pendingProceeds[listing.seller] += msg.value;
        IERC1155(listing.assetContract).safeTransferFrom(address(this), msg.sender, listing.tokenId, listing.amount, "");
        emit AssetPurchased(listingId, msg.sender, listing.seller, msg.value);
    }

    function withdrawProceeds() external nonReentrant {
        uint256 amount = pendingProceeds[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        pendingProceeds[msg.sender] = 0;
        (bool success,) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();
        emit ProceedsWithdrawn(msg.sender, amount);
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata)
        external pure returns (bytes4)
    {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external pure returns (bytes4)
    {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId || super.supportsInterface(interfaceId);
    }
}

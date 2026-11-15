const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("KingmakerMarketplace escrow prototype", function () {
  async function setup() {
    const [admin, seller, buyer, stranger] = await ethers.getSigners();
    const Assets = await ethers.getContractFactory("KingmakerAssets");
    const assets = await Assets.deploy("ipfs://kingmaker/{id}.json", admin.address);
    await assets.waitForDeployment();
    await assets.defineAsset(1, 100);
    await assets.mint(seller.address, 1, 10, "0x");

    const Market = await ethers.getContractFactory("KingmakerMarketplace");
    const market = await Market.deploy();
    await market.waitForDeployment();
    await assets.connect(seller).setApprovalForAll(await market.getAddress(), true);
    return { admin, seller, buyer, stranger, assets, market };
  }

  it("escrows ERC-1155 assets and sells them for exact native-currency payment", async function () {
    const { seller, buyer, assets, market } = await setup();
    const price = ethers.parseEther("0.25");
    await market.connect(seller).createListing(await assets.getAddress(), 1, 3, price);
    expect(await assets.balanceOf(await market.getAddress(), 1)).to.equal(3);
    await expect(market.connect(buyer).purchase(1, { value: price }))
      .to.emit(market, "AssetPurchased").withArgs(1, buyer.address, seller.address, price);
    expect(await assets.balanceOf(buyer.address, 1)).to.equal(3);
    expect(await assets.balanceOf(await market.getAddress(), 1)).to.equal(0);
    expect(await market.pendingProceeds(seller.address)).to.equal(price);
    await expect(market.connect(buyer).purchase(1, { value: price })).to.be.revertedWithCustomError(market, "ListingNotActive");
  });

  it("rejects underpayment and overpayment without changing escrow", async function () {
    const { seller, buyer, assets, market } = await setup();
    const price = ethers.parseEther("0.1");
    await market.connect(seller).createListing(await assets.getAddress(), 1, 2, price);
    await expect(market.connect(buyer).purchase(1, { value: price - 1n }))
      .to.be.revertedWithCustomError(market, "IncorrectPayment");
    await expect(market.connect(buyer).purchase(1, { value: price + 1n }))
      .to.be.revertedWithCustomError(market, "IncorrectPayment");
    expect(await assets.balanceOf(await market.getAddress(), 1)).to.equal(2);
  });

  it("allows only the seller to cancel and returns escrowed assets", async function () {
    const { seller, stranger, assets, market } = await setup();
    await market.connect(seller).createListing(await assets.getAddress(), 1, 4, 1000);
    await expect(market.connect(stranger).cancelListing(1)).to.be.revertedWithCustomError(market, "NotSeller");
    await market.connect(seller).cancelListing(1);
    expect(await assets.balanceOf(seller.address, 1)).to.equal(10);
    await expect(market.connect(seller).cancelListing(1)).to.be.revertedWithCustomError(market, "ListingNotActive");
  });

  it("pays sellers through a pull-withdrawal balance", async function () {
    const { seller, buyer, assets, market } = await setup();
    const price = ethers.parseEther("0.05");
    await market.connect(seller).createListing(await assets.getAddress(), 1, 1, price);
    await market.connect(buyer).purchase(1, { value: price });
    await expect(market.connect(seller).withdrawProceeds())
      .to.emit(market, "ProceedsWithdrawn").withArgs(seller.address, price);
    expect(await market.pendingProceeds(seller.address)).to.equal(0);
    await expect(market.connect(seller).withdrawProceeds()).to.be.revertedWithCustomError(market, "NothingToWithdraw");
  });

  it("rejects invalid listings and cannot purchase a missing listing", async function () {
    const { seller, assets, market } = await setup();
    await expect(market.connect(seller).createListing(ethers.ZeroAddress, 1, 1, 1))
      .to.be.revertedWithCustomError(market, "InvalidAddress");
    await expect(market.connect(seller).createListing(await assets.getAddress(), 1, 0, 1))
      .to.be.revertedWithCustomError(market, "InvalidAmountOrPrice");
    await expect(market.purchase(999, { value: 1 })).to.be.revertedWithCustomError(market, "ListingNotActive");
  });
});

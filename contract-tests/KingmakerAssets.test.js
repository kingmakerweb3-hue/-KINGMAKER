const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("KingmakerAssets", function () {
  async function deploy() {
    const [admin, minter, alice, bob, outsider] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("KingmakerAssets");
    const contract = await Factory.deploy("https://assets.kingmaker.game/{id}.json", admin.address);
    await contract.waitForDeployment();
    await contract.defineAsset(1, 100);
    await contract.defineAsset(2, 5);
    return { contract, admin, minter, alice, bob, outsider };
  }

  it("assigns admin and minter roles to the configured administrator", async function () {
    const { contract, admin } = await deploy();
    expect(await contract.hasRole(await contract.DEFAULT_ADMIN_ROLE(), admin.address)).to.equal(true);
    expect(await contract.hasRole(await contract.MINTER_ROLE(), admin.address)).to.equal(true);
  });

  it("rejects a zero administrator and zero asset cap", async function () {
    const Factory = await ethers.getContractFactory("KingmakerAssets");
    await expect(Factory.deploy("uri", ethers.ZeroAddress)).to.be.revertedWith("admin is zero");
    const { contract } = await deploy();
    await expect(contract.defineAsset(3, 0)).to.be.revertedWithCustomError(contract, "InvalidCap");
  });

  it("prevents unauthorized asset definition and minting", async function () {
    const { contract, outsider, alice } = await deploy();
    await expect(contract.connect(outsider).defineAsset(3, 10))
      .to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
    await expect(contract.connect(outsider).mint(alice.address, 1, 1, "0x"))
      .to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
  });

  it("mints within the cap and rejects zero or excess supply", async function () {
    const { contract, alice } = await deploy();
    await contract.mint(alice.address, 1, 60, "0x");
    expect(await contract.balanceOf(alice.address, 1)).to.equal(60);
    await expect(contract.mint(alice.address, 1, 41, "0x"))
      .to.be.revertedWithCustomError(contract, "CapExceeded");
    await expect(contract.mint(alice.address, 1, 0, "0x"))
      .to.be.revertedWithCustomError(contract, "CapExceeded");
    expect(await contract["totalSupply(uint256)"](1)).to.equal(60);
  });

  it("rejects undefined assets", async function () {
    const { contract, alice } = await deploy();
    await expect(contract.mint(alice.address, 99, 1, "0x"))
      .to.be.revertedWithCustomError(contract, "UnknownAsset");
  });

  it("batch mints distinct IDs and rejects duplicate IDs or mismatched arrays", async function () {
    const { contract, alice } = await deploy();
    await contract.mintBatch(alice.address, [1, 2], [10, 3], "0x");
    expect(await contract.balanceOf(alice.address, 1)).to.equal(10);
    expect(await contract.balanceOf(alice.address, 2)).to.equal(3);
    await expect(contract.mintBatch(alice.address, [1, 1], [1, 1], "0x"))
      .to.be.revertedWith("duplicate asset id");
    await expect(contract.mintBatch(alice.address, [1], [1, 2], "0x"))
      .to.be.revertedWith("length mismatch");
  });

  it("enforces the supply cap across separate batch mints", async function () {
    const { contract, alice } = await deploy();
    await contract.mintBatch(alice.address, [2], [5], "0x");
    await expect(contract.mintBatch(alice.address, [2], [1], "0x"))
      .to.be.revertedWithCustomError(contract, "CapExceeded");
  });

  it("pauses minting and transfers, then allows them after unpausing", async function () {
    const { contract, admin, alice, bob } = await deploy();
    await contract.mint(alice.address, 1, 10, "0x");
    await contract.pause();
    await expect(contract.mint(alice.address, 1, 1, "0x")).to.be.revertedWithCustomError(contract, "EnforcedPause");
    await expect(contract.connect(alice).safeTransferFrom(alice.address, bob.address, 1, 1, "0x"))
      .to.be.revertedWithCustomError(contract, "EnforcedPause");
    await expect(contract.connect(alice).burn(alice.address, 1, 1))
      .to.be.revertedWithCustomError(contract, "EnforcedPause");
    await expect(contract.connect(alice).unpause())
      .to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
    await contract.connect(admin).unpause();
    await contract.connect(alice).safeTransferFrom(alice.address, bob.address, 1, 2, "0x");
    expect(await contract.balanceOf(bob.address, 1)).to.equal(2);
  });

  it("supports approved operators and restricts burns to owners or approvals", async function () {
    const { contract, alice, bob, outsider } = await deploy();
    await contract.mint(alice.address, 1, 10, "0x");
    await expect(contract.connect(outsider).burn(alice.address, 1, 1))
      .to.be.revertedWith("not owner/approved");
    await contract.connect(alice).setApprovalForAll(bob.address, true);
    await contract.connect(bob).burn(alice.address, 1, 4);
    expect(await contract.balanceOf(alice.address, 1)).to.equal(6);
    expect(await contract["totalSupply(uint256)"](1)).to.equal(6);
  });

  it("updates the metadata URI and advertises ERC-1155 interfaces", async function () {
    const { contract, admin, outsider } = await deploy();
    expect(await contract.uri(1)).to.equal("https://assets.kingmaker.game/{id}.json");
    await expect(contract.connect(outsider).setBaseURI("https://evil.example/"))
      .to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
    await contract.connect(admin).setBaseURI("https://cdn.kingmaker.game/{id}.json");
    expect(await contract.uri(1)).to.equal("https://cdn.kingmaker.game/{id}.json");
    expect(await contract.supportsInterface("0xd9b67a26")).to.equal(true);
    expect(await contract.supportsInterface("0x01ffc9a7")).to.equal(true);
  });
});

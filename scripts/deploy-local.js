const { ethers } = require("hardhat");

async function main() {
  const [admin] = await ethers.getSigners();
  if (!admin) throw new Error("No deployer account is available on this network.");

  const Assets = await ethers.getContractFactory("KingmakerAssets");
  const assets = await Assets.deploy("ipfs://kingmaker/{id}.json", admin.address);
  await assets.waitForDeployment();

  const catalog = [
    { id: 1n, key: "founder-banner", maxSupply: 10000n },
    { id: 2n, key: "frontier-surveyor", maxSupply: 5000n },
    { id: 3n, key: "royal-blueprint", maxSupply: 2500n }
  ];
  for (const asset of catalog) {
    await (await assets.defineAsset(asset.id, asset.maxSupply)).wait();
  }

  const Marketplace = await ethers.getContractFactory("KingmakerMarketplace");
  const marketplace = await Marketplace.deploy();
  await marketplace.waitForDeployment();

  const deployment = {
    network: await ethers.provider.getNetwork().then(n => n.name),
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: admin.address,
    assetsContract: await assets.getAddress(),
    marketplaceContract: await marketplace.getAddress(),
    tokenIds: Object.fromEntries(catalog.map(asset => [asset.key, asset.id.toString()])),
    warning: "Local development deployment only. Not audited or approved for real funds."
  };
  process.stdout.write(JSON.stringify(deployment, null, 2) + "\n");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

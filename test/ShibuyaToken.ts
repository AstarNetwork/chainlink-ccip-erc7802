import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { ShibuyaToken } from "../typechain-types/contracts/Shibuya.v2.sol/ShibuyaToken";
import { ShibuyaToken__factory } from "../typechain-types/factories/contracts/Shibuya.v2.sol";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ShibuyaToken", function () {
  let shibuyaToken: ShibuyaToken;
  let owner: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let burner: HardhatEthersSigner;
  let user: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, minter, burner, user] = await ethers.getSigners();
    
    // Deploy the contract
    const ShibuyaTokenFactory = await ethers.getContractFactory("contracts/Shibuya.v0.sol:ShibuyaToken");
    const deployedContract = await upgrades.deployProxy(
      ShibuyaTokenFactory, 
      [owner.address], 
      {
        initializer: "initialize",
        kind: "uups",
      }
    );

    // Get the proper typed contract instance
    shibuyaToken = ShibuyaToken__factory.connect(
      await deployedContract.getAddress(),
      owner
    );
    
    await shibuyaToken.waitForDeployment();

    const ShibuyaTokenV1Factory = await ethers.getContractFactory("contracts/Shibuya.v1.sol:ShibuyaToken");

    await upgrades.upgradeProxy(
      await shibuyaToken.getAddress(),
      ShibuyaTokenV1Factory,
      {
        kind: "uups",
        call: {
          fn: "initializeV2",
          args: [owner.address],
        },
        unsafeAllow: ["missing-initializer"],
      }
    );

    const ShibuyaTokenV2Factory = await ethers.getContractFactory("contracts/Shibuya.v2.sol:ShibuyaToken");

    await upgrades.upgradeProxy(
      await shibuyaToken.getAddress(),
      ShibuyaTokenV2Factory,
      { 
        kind: "uups",
        call: {
          fn: "initializeV3",
          args: [owner.address],
        },
        unsafeAllow: ["missing-initializer"],
      }
    );

    shibuyaToken = ShibuyaToken__factory.connect(
      await shibuyaToken.getAddress(),
      owner
    );
  });

  describe("Initialization", function () {
    it("Should set the correct token name and symbol", async function () {
      expect(await shibuyaToken.name()).to.equal("Shibuya Token");
      expect(await shibuyaToken.symbol()).to.equal("SBY");
    });

    it("Should set the correct owner", async function () {
      expect(await shibuyaToken.owner()).to.equal(owner.address);
    });

    it("Should not initialize twice", async function () {
      expect(
        shibuyaToken.initializeV3(owner.address)
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  describe("Role Management", function () {
    it("Should allow owner to grant minter role", async function () {
      const MINTER_ROLE = await shibuyaToken.MINTER_ROLE();
      await shibuyaToken.connect(owner).grantMintRole(minter.address);
      expect(await shibuyaToken.hasRole(MINTER_ROLE, minter.address)).to.be.true;
    });

    it("Should allow owner to grant burner role", async function () {
      const BURNER_ROLE = await shibuyaToken.BURNER_ROLE();
      await shibuyaToken.connect(owner).grantBurnRole(burner.address);
      expect(await shibuyaToken.hasRole(BURNER_ROLE, burner.address)).to.be.true;
    });

    it("Should allow owner to grant both mint and burn roles", async function () {
      const [MINTER_ROLE, BURNER_ROLE] = await Promise.all([
        shibuyaToken.MINTER_ROLE(),
        shibuyaToken.BURNER_ROLE()
      ]);
      
      await shibuyaToken.connect(owner).grantMintAndBurnRoles(user.address);
      
      const [hasMinterRole, hasBurnerRole] = await Promise.all([
        shibuyaToken.hasRole(MINTER_ROLE, user.address),
        shibuyaToken.hasRole(BURNER_ROLE, user.address)
      ]);
      
      expect(hasMinterRole).to.be.true;
      expect(hasBurnerRole).to.be.true;
    });

    it("Should allow owner to revoke roles", async function () {
      const [MINTER_ROLE, BURNER_ROLE] = await Promise.all([
        shibuyaToken.MINTER_ROLE(),
        shibuyaToken.BURNER_ROLE()
      ]);

      await shibuyaToken.connect(owner).grantMintAndBurnRoles(user.address);
      await shibuyaToken.connect(owner).revokeMintAndBurnRoles(user.address);
      
      const [hasMinterRole, hasBurnerRole] = await Promise.all([
        shibuyaToken.hasRole(MINTER_ROLE, user.address),
        shibuyaToken.hasRole(BURNER_ROLE, user.address)
      ]);
      
      expect(hasMinterRole).to.be.false;
      expect(hasBurnerRole).to.be.false;
    });

    it("Should prevent non-owner from granting roles", async function () {
      await expect(
        shibuyaToken.connect(user).grantMintRole(minter.address)
      ).to.be.revertedWith("Caller is not the owner");
    });

    it("Should not allow non-owner to revoke roles", async function () {
      await shibuyaToken.connect(owner).grantMintRole(minter.address);
      await expect(
        shibuyaToken.connect(user).revokeMintRole(minter.address)
      ).to.be.revertedWith("Caller is not the owner");
    });
  
    it("Should not allow granting role to zero address", async function () {
      expect(
        shibuyaToken.connect(owner).grantMintRole(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid account address");
    });
  });

  describe("Minting", function () {
    beforeEach(async function () {
      await shibuyaToken.connect(owner).grantMintRole(minter.address);
    });

    it("Should allow minter to mint tokens", async function () {
      const mintAmount = 1000n;
      await shibuyaToken.connect(minter).mint(user.address, mintAmount);
      expect(await shibuyaToken.balanceOf(user.address)).to.equal(mintAmount);
    });

    it("Should prevent non-minter from minting tokens", async function () {
      const MINTER_ROLE = await shibuyaToken.MINTER_ROLE();
      expect(
        shibuyaToken.connect(user).mint(user.address, 1000n)
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${MINTER_ROLE}`
      );
    });

    it("Should not allow minting to zero address", async function () {
      await shibuyaToken.connect(owner).grantMintRole(minter.address);
      expect(
        shibuyaToken.connect(minter).mint(ethers.ZeroAddress, 1000n)
      ).to.be.revertedWith("ERC20: mint to the zero address");
    });

    it("Should emit Transfer event with correct parameters when minting", async function () {
      const mintAmount = 1000n;
      await expect(shibuyaToken.connect(minter).mint(user.address, mintAmount))
        .to.emit(shibuyaToken, "Transfer")
        .withArgs(ethers.ZeroAddress, user.address, mintAmount);
    });
  });

  describe("Burning", function () {
    const initialBalance = 2000n;
    const burnAmount = 1000n;

    beforeEach(async function () {
      await shibuyaToken.connect(owner).grantMintRole(minter.address);
      await shibuyaToken.connect(owner).grantBurnRole(burner.address);
      await shibuyaToken.connect(minter).mint(user.address, initialBalance);
    });

    it("Should allow burner to burn tokens", async function () {
      await shibuyaToken.connect(user).approve(burner.address, burnAmount);
      await shibuyaToken.connect(burner)["burn(address,uint256)"](user.address, burnAmount);
      expect(await shibuyaToken.balanceOf(user.address)).to.equal(initialBalance - burnAmount);
    });

    it("Should allow burner to burnFrom with allowance", async function () {
      await shibuyaToken.connect(user).approve(burner.address, burnAmount);

      await shibuyaToken.connect(burner).burnFrom(user.address, burnAmount);
      expect(await shibuyaToken.balanceOf(user.address)).to.equal(initialBalance - burnAmount);
    });

    it("Should prevent non-burner from burning tokens", async function () {
      const BURNER_ROLE = await shibuyaToken.BURNER_ROLE();
      expect(
        shibuyaToken.connect(user)["burn(address,uint256)"](user.address, burnAmount)
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${BURNER_ROLE}`
      );
    });

    it("Should not allow burning more than balance", async function () {
      await shibuyaToken.connect(owner).grantBurnRole(burner.address);
      expect(
        shibuyaToken.connect(burner)["burn(address,uint256)"](user.address, 1000n)
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });
  
    it("Should not allow burning without sufficient allowance", async function () {
      await shibuyaToken.connect(owner).grantBurnRole(burner.address);
      await shibuyaToken.connect(user).approve(burner.address, 500n);
      expect(
        shibuyaToken.connect(burner).burnFrom(user.address, 1000n)
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("Should emit Transfer event with correct parameters when burning", async function () {
      await shibuyaToken.connect(user).approve(burner.address, burnAmount);
      await expect(shibuyaToken.connect(burner)["burn(address,uint256)"](user.address, burnAmount))
        .to.emit(shibuyaToken, "Transfer")
        .withArgs(user.address, ethers.ZeroAddress, burnAmount);
    });

    it("Should emit Transfer event with correct parameters when burnFrom", async function () {
      await shibuyaToken.connect(user).approve(burner.address, burnAmount);
      await expect(shibuyaToken.connect(burner).burnFrom(user.address, burnAmount))
        .to.emit(shibuyaToken, "Transfer")
        .withArgs(user.address, ethers.ZeroAddress, burnAmount);
    });

    it("Should allow burner to burn own tokens", async function () {
      await shibuyaToken.connect(minter).mint(burner.address, initialBalance);
      await shibuyaToken.connect(burner)["burn(uint256)"](burnAmount);
      expect(await shibuyaToken.balanceOf(burner.address)).to.equal(initialBalance - burnAmount);
    });

    it("Should prevent non-burner from burning own tokens", async function () {
      const BURNER_ROLE = await shibuyaToken.BURNER_ROLE();
      await shibuyaToken.connect(minter).mint(user.address, initialBalance);
      await expect(
        shibuyaToken.connect(user)["burn(uint256)"](burnAmount)
      ).to.be.revertedWithCustomError(
        shibuyaToken,
        "AccessControlUnauthorizedAccount"
      ).withArgs(user.address, BURNER_ROLE);
    });

    it("Should emit Transfer event when burning own tokens", async function () {
      await shibuyaToken.connect(minter).mint(burner.address, initialBalance);
      await expect(shibuyaToken.connect(burner)["burn(uint256)"](burnAmount))
        .to.emit(shibuyaToken, "Transfer")
        .withArgs(burner.address, ethers.ZeroAddress, burnAmount);
    });

    it("Should not allow burning own tokens more than balance", async function () {
      await shibuyaToken.connect(minter).mint(burner.address, initialBalance);
      await expect(
        shibuyaToken.connect(burner)["burn(uint256)"](initialBalance + 1000n)
      ).to.be.revertedWithCustomError(
        shibuyaToken,
        "ERC20InsufficientBalance"
      ).withArgs(burner.address, initialBalance, initialBalance + 1000n);
    });
  });

  describe("Ownership", function () {
    it("Should allow owner to transfer ownership", async function () {
      await shibuyaToken.connect(owner).transferOwnership(user.address);
      expect(await shibuyaToken.owner()).to.equal(owner.address); // Still owner until accepted
    });

    it("Should complete ownership transfer after acceptance", async function () {
      await shibuyaToken.connect(owner).transferOwnership(user.address);
      await shibuyaToken.connect(user).acceptOwnership();
      expect(await shibuyaToken.owner()).to.equal(user.address);
    });

    it("Should prevent non-pending owner from accepting ownership", async function () {
      await shibuyaToken.connect(owner).transferOwnership(user.address);
      await expect(
        shibuyaToken.connect(burner).acceptOwnership()
      ).to.be.revertedWith("Must be proposed owner");
    });

    it("Should prevent transferring ownership to self", async function () {
      await expect(
        shibuyaToken.connect(owner).transferOwnership(owner.address)
      ).to.be.revertedWith("Cannot transfer to self");
    });

    it("Should not allow non-owner to initiate transfer", async function () {
      await expect(
        shibuyaToken.connect(user).transferOwnership(minter.address)
      ).to.be.revertedWith("Caller is not the owner");
    });
  
    it("Should not allow accepting ownership without pending transfer", async function () {
      await expect(
        shibuyaToken.connect(user).acceptOwnership()
      ).to.be.revertedWith("Must be proposed owner");
    });
  });

  describe("Events", function () {
    it("Should emit OwnershipTransferRequested event", async function () {
      await expect(shibuyaToken.connect(owner).transferOwnership(user.address))
        .to.emit(shibuyaToken, "OwnershipTransferRequested")
        .withArgs(owner.address, user.address);
    });

    it("Should emit OwnershipTransferred event", async function () {
      await shibuyaToken.connect(owner).transferOwnership(user.address);
      await expect(shibuyaToken.connect(user).acceptOwnership())
        .to.emit(shibuyaToken, "OwnershipTransferred")
        .withArgs(owner.address, user.address);
    });
  });

  describe("Upgrades", function () {
    let shibuyaTokenV2Factory: ShibuyaToken__factory;
  
    beforeEach(async function () {
      shibuyaTokenV2Factory = await ethers.getContractFactory("contracts/Shibuya.v2.sol:ShibuyaToken") as ShibuyaToken__factory;
    });
  
    it("Should allow owner to upgrade", async function () {
      const upgradedContract = ShibuyaToken__factory.connect(
        await shibuyaToken.getAddress(),
        owner
      );
      
      await upgrades.upgradeProxy(
        await shibuyaToken.getAddress(),
        shibuyaTokenV2Factory,
        {
          unsafeAllow: ["missing-initializer"],
        }
      );
  
      expect(await upgradedContract.getAddress()).to.equal(
        await shibuyaToken.getAddress()
      );
    });
  
    it("Should maintain state after upgrade", async function () {
      // Set up initial state
      await shibuyaToken.connect(owner).grantMintRole(minter.address);
      await shibuyaToken.connect(minter).mint(user.address, 1000n);
      
      // Perform upgrade
      const upgradedContract = ShibuyaToken__factory.connect(
        await shibuyaToken.getAddress(),
        owner
      );
      
      await upgrades.upgradeProxy(
        await shibuyaToken.getAddress(),
        shibuyaTokenV2Factory,
        {
          unsafeAllow: ["missing-initializer"],
        }
      );
      
      // Verify state is maintained
      const MINTER_ROLE = await upgradedContract.MINTER_ROLE();
      expect(await upgradedContract.hasRole(MINTER_ROLE, minter.address)).to.be.true;
      expect(await upgradedContract.balanceOf(user.address)).to.equal(1000n);
      expect(await upgradedContract.owner()).to.equal(owner.address);
    });
  
    it("Should not allow non-owner to upgrade", async function () {
      await expect(
        upgrades.upgradeProxy(
          await shibuyaToken.getAddress(),
          shibuyaTokenV2Factory.connect(user),
          {
            unsafeAllow: ["missing-initializer"],
          }
        )
      ).to.be.revertedWith("Caller is not the owner");
    });
  
    it("Should maintain total supply after upgrade", async function () {
      // Mint some tokens before upgrade
      await shibuyaToken.connect(owner).grantMintRole(minter.address);
      await shibuyaToken.connect(minter).mint(user.address, 1000n);
      const totalSupplyBefore = await shibuyaToken.totalSupply();
      
      // Upgrade
      const upgradedContract = ShibuyaToken__factory.connect(
        await shibuyaToken.getAddress(),
        owner
      );
      
      await upgrades.upgradeProxy(
        await shibuyaToken.getAddress(),
        shibuyaTokenV2Factory,
        {
          unsafeAllow: ["missing-initializer"],
        }
      );
      
      // Check total supply after upgrade
      expect(await upgradedContract.totalSupply()).to.equal(totalSupplyBefore);
    });
  
    it("Should maintain roles after upgrade", async function () {
      // Set up roles before upgrade
      const [MINTER_ROLE, BURNER_ROLE] = await Promise.all([
        shibuyaToken.MINTER_ROLE(),
        shibuyaToken.BURNER_ROLE()
      ]);
      
      await shibuyaToken.connect(owner).grantMintAndBurnRoles(minter.address);
      
      // Upgrade
      const upgradedContract = ShibuyaToken__factory.connect(
        await shibuyaToken.getAddress(),
        owner
      );
      
      await upgrades.upgradeProxy(
        await shibuyaToken.getAddress(),
        shibuyaTokenV2Factory,
        {
          unsafeAllow: ["missing-initializer"],
        }
      );
      
      // Verify roles are maintained
      const [hasMinterRole, hasBurnerRole] = await Promise.all([
        upgradedContract.hasRole(MINTER_ROLE, minter.address),
        upgradedContract.hasRole(BURNER_ROLE, minter.address)
      ]);
      
      expect(hasMinterRole).to.be.true;
      expect(hasBurnerRole).to.be.true;
    });
  
    it("Should allow functionality after upgrade", async function () {
      // Upgrade
      const upgradedContract = ShibuyaToken__factory.connect(
        await shibuyaToken.getAddress(),
        owner
      );
      
      await upgrades.upgradeProxy(
        await shibuyaToken.getAddress(),
        shibuyaTokenV2Factory,
        {
          unsafeAllow: ["missing-initializer"],
        }
      );
      
      // Test mint functionality
      await upgradedContract.connect(owner).grantMintRole(minter.address);
      await upgradedContract.connect(minter).mint(user.address, 1000n);
      expect(await upgradedContract.balanceOf(user.address)).to.equal(1000n);
    });
  });

  describe("ERC7802", function () {
    beforeEach(async function () {
      await shibuyaToken.connect(owner).grantMintRole(minter.address);
      await shibuyaToken.connect(owner).grantBurnRole(burner.address);
    });
  
    describe("Crosschain Minting", function () {
      it("Should allow minter to crosschain mint tokens", async function () {
        const mintAmount = 1000n;
        await expect(shibuyaToken.connect(minter).crosschainMint(user.address, mintAmount))
          .to.emit(shibuyaToken, "CrosschainMint")
          .withArgs(user.address, mintAmount, minter.address);
        
        expect(await shibuyaToken.balanceOf(user.address)).to.equal(mintAmount);
      });
  
      it("Should prevent non-minter from crosschain minting", async function () {
        const MINTER_ROLE = await shibuyaToken.MINTER_ROLE();
        await expect(
          shibuyaToken.connect(user).crosschainMint(user.address, 1000n)
        ).to.be.revertedWithCustomError(
          shibuyaToken,
          "AccessControlUnauthorizedAccount"
        ).withArgs(user.address, MINTER_ROLE);
      });
  
      it("Should not allow crosschain minting to zero address", async function () {
        await expect(
          shibuyaToken.connect(minter).crosschainMint(ethers.ZeroAddress, 1000n)
        ).to.be.revertedWithCustomError(
          shibuyaToken,
          "ERC20InvalidReceiver"
        ).withArgs(ethers.ZeroAddress);
      });

      it("Should emit both Transfer and CrosschainMint events when crosschain minting", async function () {
        const mintAmount = 1000n;
        await expect(shibuyaToken.connect(minter).crosschainMint(user.address, mintAmount))
          .to.emit(shibuyaToken, "Transfer")
          .withArgs(ethers.ZeroAddress, user.address, mintAmount)
          .and.to.emit(shibuyaToken, "CrosschainMint")
          .withArgs(user.address, mintAmount, minter.address);
      });
    });
  
    describe("Crosschain Burning", function () {
      const initialBalance = 2000n;
      const burnAmount = 1000n;
  
      beforeEach(async function () {
        // Mint initial tokens to user
        await shibuyaToken.connect(minter).mint(user.address, initialBalance);
      });
  
      it("Should allow burner to crosschain burn tokens", async function () {
        await expect(shibuyaToken.connect(burner).crosschainBurn(user.address, burnAmount))
          .to.emit(shibuyaToken, "CrosschainBurn")
          .withArgs(user.address, burnAmount, burner.address);
        
        expect(await shibuyaToken.balanceOf(user.address)).to.equal(initialBalance - burnAmount);
      });
  
      it("Should prevent non-burner from crosschain burning", async function () {
        const BURNER_ROLE = await shibuyaToken.BURNER_ROLE();
        await expect(
          shibuyaToken.connect(user).crosschainBurn(user.address, burnAmount)
        ).to.be.revertedWithCustomError(
          shibuyaToken,
          "AccessControlUnauthorizedAccount"
        ).withArgs(user.address, BURNER_ROLE);
      });
  
      it("Should not allow crosschain burning more than balance", async function () {
        await expect(
          shibuyaToken.connect(burner).crosschainBurn(user.address, initialBalance + 1000n)
        ).to.be.revertedWithCustomError(
          shibuyaToken,
          "ERC20InsufficientBalance"
        ).withArgs(user.address, initialBalance, initialBalance + 1000n);
      });
  
      it("Should not allow crosschain burning from zero address", async function () {
        await expect(
          shibuyaToken.connect(burner).crosschainBurn(ethers.ZeroAddress, burnAmount)
        ).to.be.revertedWithCustomError(
          shibuyaToken,
          "ERC20InvalidSender"
        ).withArgs(ethers.ZeroAddress);
      });

      it("Should emit both Transfer and CrosschainBurn events when crosschain burning", async function () {
        await expect(shibuyaToken.connect(burner).crosschainBurn(user.address, burnAmount))
          .to.emit(shibuyaToken, "Transfer")
          .withArgs(user.address, ethers.ZeroAddress, burnAmount)
          .and.to.emit(shibuyaToken, "CrosschainBurn")
          .withArgs(user.address, burnAmount, burner.address);
      });
    });
  
    describe("ERC165 Support", function () {
      it("Should support IERC7802 interface", async function () {
        // Calculate ERC7802 interface ID - crosschainMint and crosschainBurn function selectors
        const crosschainMintSelector = ethers.id("crosschainMint(address,uint256)").slice(0, 10);
        const crosschainBurnSelector = ethers.id("crosschainBurn(address,uint256)").slice(0, 10);
        
        // Convert selectors to BigInt, XOR them, and convert back to hex
        const interfaceId = BigInt(crosschainMintSelector) ^ BigInt(crosschainBurnSelector);
        const IERC7802_ID = ethers.dataSlice(ethers.zeroPadValue(ethers.toBeHex(interfaceId), 32), 28, 32);
        
        const supportsInterface = await shibuyaToken.supportsInterface(IERC7802_ID);
        expect(supportsInterface).to.be.true;
      });
    });
  });
});
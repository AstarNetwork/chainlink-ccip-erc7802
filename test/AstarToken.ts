import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { AstarToken, AstarToken__factory } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("AstarToken", function () {
  let astarToken: AstarToken;
  let owner: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let burner: HardhatEthersSigner;
  let user: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, minter, burner, user] = await ethers.getSigners();
    
    // Deploy the contract
    const AstarTokenFactory = await ethers.getContractFactory("AstarToken");
    const deployedContract = await upgrades.deployProxy(
      AstarTokenFactory, 
      [owner.address], 
      {
        initializer: "initialize",
        kind: "uups",
      }
    );

    // Get the proper typed contract instance
    astarToken = AstarToken__factory.connect(
      await deployedContract.getAddress(),
      owner
    );
    
    await astarToken.waitForDeployment();
  });

  describe("Initialization", function () {
    it("Should set the correct token name and symbol", async function () {
      expect(await astarToken.name()).to.equal("Astar Token");
      expect(await astarToken.symbol()).to.equal("ASTR");
    });

    it("Should set the correct owner", async function () {
      expect(await astarToken.owner()).to.equal(owner.address);
    });

    it("Should not initialize twice", async function () {
      expect(
        astarToken.initialize(owner.address)
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("Should not allow initializing with zero address admin", async function () {
      const AstarTokenFactory = await ethers.getContractFactory("AstarToken");
      await expect(
        upgrades.deployProxy(
          AstarTokenFactory,
          [ethers.ZeroAddress],
          {
            initializer: "initialize",
            kind: "uups",
          }
        )
      ).to.be.revertedWith("Cannot set the default admin to zero address");
    });
  });

  describe("Role Management", function () {
    it("Should allow owner to grant minter role", async function () {
      const MINTER_ROLE = await astarToken.MINTER_ROLE();
      await astarToken.connect(owner).grantMintRole(minter.address);
      expect(await astarToken.hasRole(MINTER_ROLE, minter.address)).to.be.true;
    });

    it("Should allow owner to grant burner role", async function () {
      const BURNER_ROLE = await astarToken.BURNER_ROLE();
      await astarToken.connect(owner).grantBurnRole(burner.address);
      expect(await astarToken.hasRole(BURNER_ROLE, burner.address)).to.be.true;
    });

    it("Should allow owner to grant both mint and burn roles", async function () {
      const [MINTER_ROLE, BURNER_ROLE] = await Promise.all([
        astarToken.MINTER_ROLE(),
        astarToken.BURNER_ROLE()
      ]);
      
      await astarToken.connect(owner).grantMintAndBurnRoles(user.address);
      
      const [hasMinterRole, hasBurnerRole] = await Promise.all([
        astarToken.hasRole(MINTER_ROLE, user.address),
        astarToken.hasRole(BURNER_ROLE, user.address)
      ]);
      
      expect(hasMinterRole).to.be.true;
      expect(hasBurnerRole).to.be.true;
    });

    it("Should allow owner to revoke roles", async function () {
      const [MINTER_ROLE, BURNER_ROLE] = await Promise.all([
        astarToken.MINTER_ROLE(),
        astarToken.BURNER_ROLE()
      ]);

      await astarToken.connect(owner).grantMintAndBurnRoles(user.address);
      await astarToken.connect(owner).revokeMintAndBurnRoles(user.address);
      
      const [hasMinterRole, hasBurnerRole] = await Promise.all([
        astarToken.hasRole(MINTER_ROLE, user.address),
        astarToken.hasRole(BURNER_ROLE, user.address)
      ]);
      
      expect(hasMinterRole).to.be.false;
      expect(hasBurnerRole).to.be.false;
    });

    it("Should prevent non-owner from granting roles", async function () {
      await expect(
        astarToken.connect(user).grantMintRole(minter.address)
      ).to.be.revertedWith("Caller is not the owner");
    });

    it("Should not allow non-owner to revoke roles", async function () {
      await astarToken.connect(owner).grantMintRole(minter.address);
      await expect(
        astarToken.connect(user).revokeMintRole(minter.address)
      ).to.be.revertedWith("Caller is not the owner");
    });
  
    it("Should not allow granting role to zero address", async function () {
      expect(
        astarToken.connect(owner).grantMintRole(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid account address");
    });
  });

  describe("Minting", function () {
    beforeEach(async function () {
      await astarToken.connect(owner).grantMintRole(minter.address);
    });

    it("Should allow minter to mint tokens", async function () {
      const mintAmount = 1000n;
      await astarToken.connect(minter).mint(user.address, mintAmount);
      expect(await astarToken.balanceOf(user.address)).to.equal(mintAmount);
    });

    it("Should prevent non-minter from minting tokens", async function () {
      const MINTER_ROLE = await astarToken.MINTER_ROLE();
      expect(
        astarToken.connect(user).mint(user.address, 1000n)
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${MINTER_ROLE}`
      );
    });

    it("Should not allow minting to zero address", async function () {
      await astarToken.connect(owner).grantMintRole(minter.address);
      expect(
        astarToken.connect(minter).mint(ethers.ZeroAddress, 1000n)
      ).to.be.revertedWith("ERC20: mint to the zero address");
    });

    it("Should emit Transfer event with correct parameters when minting", async function () {
      const mintAmount = 1000n;
      await expect(astarToken.connect(minter).mint(user.address, mintAmount))
        .to.emit(astarToken, "Transfer")
        .withArgs(ethers.ZeroAddress, user.address, mintAmount);
    });
  });

  describe("Burning", function () {
    const initialBalance = 2000n;
    const burnAmount = 1000n;

    beforeEach(async function () {
      await astarToken.connect(owner).grantMintRole(minter.address);
      await astarToken.connect(owner).grantBurnRole(burner.address);
      await astarToken.connect(minter).mint(user.address, initialBalance);
    });

    it("Should allow burner to burn tokens", async function () {
      await astarToken.connect(user).approve(burner.address, burnAmount);
      await astarToken.connect(burner)["burn(address,uint256)"](user.address, burnAmount);
      expect(await astarToken.balanceOf(user.address)).to.equal(initialBalance - burnAmount);
    });

    it("Should allow burner to burnFrom with allowance", async function () {
      await astarToken.connect(user).approve(burner.address, burnAmount);

      await astarToken.connect(burner).burnFrom(user.address, burnAmount);
      expect(await astarToken.balanceOf(user.address)).to.equal(initialBalance - burnAmount);
    });

    it("Should prevent non-burner from burning tokens", async function () {
      const BURNER_ROLE = await astarToken.BURNER_ROLE();
      expect(
        astarToken.connect(user)["burn(address,uint256)"](user.address, burnAmount)
      ).to.be.revertedWithCustomError(
        astarToken,
        "AccessControlUnauthorizedAccount"
      ).withArgs(user.address, BURNER_ROLE);
    });

    it("Should not allow burning more than balance", async function () {
      await astarToken.connect(owner).grantBurnRole(burner.address);
      expect(
        astarToken.connect(burner)["burn(address,uint256)"](user.address, 1000n)
      ).to.be.revertedWithCustomError(
        astarToken,
        "ERC20InsufficientBalance"
      ).withArgs(user.address, initialBalance, initialBalance + 1000n);
    });
  
    it("Should not allow burning without sufficient allowance", async function () {
      await astarToken.connect(owner).grantBurnRole(burner.address);
      await astarToken.connect(user).approve(burner.address, 500n);
      expect(
        astarToken.connect(burner).burnFrom(user.address, 1000n)
      ).to.be.revertedWithCustomError(
        astarToken,
        "ERC20InsufficientAllowance"
      ).withArgs(user.address, 500n, 1000n);
    });

    it("Should emit Transfer event with correct parameters when burning", async function () {
      await astarToken.connect(user).approve(burner.address, burnAmount);
      await expect(astarToken.connect(burner)["burn(address,uint256)"](user.address, burnAmount))
        .to.emit(astarToken, "Transfer")
        .withArgs(user.address, ethers.ZeroAddress, burnAmount);
    });

    it("Should emit Transfer event with correct parameters when burnFrom", async function () {
      await astarToken.connect(user).approve(burner.address, burnAmount);
      await expect(astarToken.connect(burner).burnFrom(user.address, burnAmount))
        .to.emit(astarToken, "Transfer")
        .withArgs(user.address, ethers.ZeroAddress, burnAmount);
    });

    it("Should allow burner to burn own tokens", async function () {
      await astarToken.connect(minter).mint(burner.address, initialBalance);
      await astarToken.connect(burner)["burn(uint256)"](burnAmount);
      expect(await astarToken.balanceOf(burner.address)).to.equal(initialBalance - burnAmount);
    });

    it("Should prevent non-burner from burning own tokens", async function () {
      const BURNER_ROLE = await astarToken.BURNER_ROLE();
      await astarToken.connect(minter).mint(user.address, initialBalance);
      await expect(
        astarToken.connect(user)["burn(uint256)"](burnAmount)
      ).to.be.revertedWithCustomError(
        astarToken,
        "AccessControlUnauthorizedAccount"
      ).withArgs(user.address, BURNER_ROLE);
    });

    it("Should emit Transfer event when burning own tokens", async function () {
      await astarToken.connect(minter).mint(burner.address, initialBalance);
      await expect(astarToken.connect(burner)["burn(uint256)"](burnAmount))
        .to.emit(astarToken, "Transfer")
        .withArgs(burner.address, ethers.ZeroAddress, burnAmount);
    });

    it("Should not allow burning own tokens more than balance", async function () {
      await astarToken.connect(minter).mint(burner.address, initialBalance);
      await expect(
        astarToken.connect(burner)["burn(uint256)"](initialBalance + 1000n)
      ).to.be.revertedWithCustomError(
        astarToken,
        "ERC20InsufficientBalance"
      ).withArgs(burner.address, initialBalance, initialBalance + 1000n);
    });
  });

  describe("Ownership", function () {
    it("Should allow owner to transfer ownership", async function () {
      await astarToken.connect(owner).transferOwnership(user.address);
      expect(await astarToken.owner()).to.equal(owner.address); // Still owner until accepted
    });

    it("Should complete ownership transfer after acceptance", async function () {
      await astarToken.connect(owner).transferOwnership(user.address);
      await astarToken.connect(user).acceptOwnership();
      expect(await astarToken.owner()).to.equal(user.address);
    });

    it("Should prevent non-pending owner from accepting ownership", async function () {
      await astarToken.connect(owner).transferOwnership(user.address);
      await expect(
        astarToken.connect(burner).acceptOwnership()
      ).to.be.revertedWith("Must be proposed owner");
    });

    it("Should prevent transferring ownership to self", async function () {
      await expect(
        astarToken.connect(owner).transferOwnership(owner.address)
      ).to.be.revertedWith("Cannot transfer to self");
    });

    it("Should not allow non-owner to initiate transfer", async function () {
      await expect(
        astarToken.connect(user).transferOwnership(minter.address)
      ).to.be.revertedWith("Caller is not the owner");
    });
  
    it("Should not allow accepting ownership without pending transfer", async function () {
      await expect(
        astarToken.connect(user).acceptOwnership()
      ).to.be.revertedWith("Must be proposed owner");
    });
  });

  describe("Events", function () {
    it("Should emit OwnershipTransferRequested event", async function () {
      await expect(astarToken.connect(owner).transferOwnership(user.address))
        .to.emit(astarToken, "OwnershipTransferRequested")
        .withArgs(owner.address, user.address);
    });

    it("Should emit OwnershipTransferred event", async function () {
      await astarToken.connect(owner).transferOwnership(user.address);
      await expect(astarToken.connect(user).acceptOwnership())
        .to.emit(astarToken, "OwnershipTransferred")
        .withArgs(owner.address, user.address);
    });
  });

  describe("Upgrades", function () {
    let astarTokenV2Factory: AstarToken__factory;
  
    beforeEach(async function () {
      astarTokenV2Factory = await ethers.getContractFactory("AstarToken");
    });
  
    it("Should allow owner to upgrade", async function () {
      const upgradedContract = AstarToken__factory.connect(
        await astarToken.getAddress(),
        owner
      );
      
      await upgrades.upgradeProxy(
        await astarToken.getAddress(),
        astarTokenV2Factory
      );
  
      expect(await upgradedContract.getAddress()).to.equal(
        await astarToken.getAddress()
      );
    });
  
    it("Should maintain state after upgrade", async function () {
      // Set up initial state
      await astarToken.connect(owner).grantMintRole(minter.address);
      await astarToken.connect(minter).mint(user.address, 1000n);
      
      // Perform upgrade
      const upgradedContract = AstarToken__factory.connect(
        await astarToken.getAddress(),
        owner
      );
      
      await upgrades.upgradeProxy(
        await astarToken.getAddress(),
        astarTokenV2Factory
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
          await astarToken.getAddress(),
          astarTokenV2Factory.connect(user)
        )
      ).to.be.revertedWith("Caller is not the owner");
    });
  
    it("Should maintain total supply after upgrade", async function () {
      // Mint some tokens before upgrade
      await astarToken.connect(owner).grantMintRole(minter.address);
      await astarToken.connect(minter).mint(user.address, 1000n);
      const totalSupplyBefore = await astarToken.totalSupply();
      
      // Upgrade
      const upgradedContract = AstarToken__factory.connect(
        await astarToken.getAddress(),
        owner
      );
      
      await upgrades.upgradeProxy(
        await astarToken.getAddress(),
        astarTokenV2Factory
      );
      
      // Check total supply after upgrade
      expect(await upgradedContract.totalSupply()).to.equal(totalSupplyBefore);
    });
  
    it("Should maintain roles after upgrade", async function () {
      // Set up roles before upgrade
      const [MINTER_ROLE, BURNER_ROLE] = await Promise.all([
        astarToken.MINTER_ROLE(),
        astarToken.BURNER_ROLE()
      ]);
      
      await astarToken.connect(owner).grantMintAndBurnRoles(minter.address);
      
      // Upgrade
      const upgradedContract = AstarToken__factory.connect(
        await astarToken.getAddress(),
        owner
      );
      
      await upgrades.upgradeProxy(
        await astarToken.getAddress(),
        astarTokenV2Factory
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
      const upgradedContract = AstarToken__factory.connect(
        await astarToken.getAddress(),
        owner
      );
      
      await upgrades.upgradeProxy(
        await astarToken.getAddress(),
        astarTokenV2Factory
      );
      
      // Test mint functionality
      await upgradedContract.connect(owner).grantMintRole(minter.address);
      await upgradedContract.connect(minter).mint(user.address, 1000n);
      expect(await upgradedContract.balanceOf(user.address)).to.equal(1000n);
    });
  });

  describe("ERC7802", function () {
    let astarToken: AstarToken;
    let owner: HardhatEthersSigner;
    let minter: HardhatEthersSigner;
    let burner: HardhatEthersSigner;
    let user: HardhatEthersSigner;
  
    beforeEach(async function () {
      [owner, minter, burner, user] = await ethers.getSigners();
      
      const AstarTokenFactory = await ethers.getContractFactory("AstarToken");
      const deployedContract = await upgrades.deployProxy(
        AstarTokenFactory, 
        [owner.address], 
        {
          initializer: "initialize",
          kind: "uups",
        }
      );
  
      astarToken = AstarToken__factory.connect(
        await deployedContract.getAddress(),
        owner
      );
      
      await astarToken.waitForDeployment();
  
      // Setup roles for testing
      await astarToken.connect(owner).grantMintRole(minter.address);
      await astarToken.connect(owner).grantBurnRole(burner.address);
    });
  
    describe("Crosschain Minting", function () {
      it("Should allow minter to crosschain mint tokens", async function () {
        const mintAmount = 1000n;
        await expect(astarToken.connect(minter).crosschainMint(user.address, mintAmount))
          .to.emit(astarToken, "CrosschainMint")
          .withArgs(user.address, mintAmount, minter.address);
        
        expect(await astarToken.balanceOf(user.address)).to.equal(mintAmount);
      });
  
      it("Should prevent non-minter from crosschain minting", async function () {
        const MINTER_ROLE = await astarToken.MINTER_ROLE();
        await expect(
          astarToken.connect(user).crosschainMint(user.address, 1000n)
        ).to.be.revertedWithCustomError(
          astarToken,
          "AccessControlUnauthorizedAccount"
        ).withArgs(user.address, MINTER_ROLE);
      });
  
      it("Should not allow crosschain minting to zero address", async function () {
        await expect(
          astarToken.connect(minter).crosschainMint(ethers.ZeroAddress, 1000n)
        ).to.be.revertedWithCustomError(
          astarToken,
          "ERC20InvalidReceiver"
        ).withArgs(ethers.ZeroAddress);
      });

      it("Should emit both Transfer and CrosschainMint events when crosschain minting", async function () {
        const mintAmount = 1000n;
        await expect(astarToken.connect(minter).crosschainMint(user.address, mintAmount))
          .to.emit(astarToken, "Transfer")
          .withArgs(ethers.ZeroAddress, user.address, mintAmount)
          .and.to.emit(astarToken, "CrosschainMint")
          .withArgs(user.address, mintAmount, minter.address);
      });
    });
  
    describe("Crosschain Burning", function () {
      const initialBalance = 2000n;
      const burnAmount = 1000n;
  
      beforeEach(async function () {
        // Mint initial tokens to user
        await astarToken.connect(minter).mint(user.address, initialBalance);
      });
  
      it("Should allow burner to crosschain burn tokens", async function () {
        await expect(astarToken.connect(burner).crosschainBurn(user.address, burnAmount))
          .to.emit(astarToken, "CrosschainBurn")
          .withArgs(user.address, burnAmount, burner.address);
        
        expect(await astarToken.balanceOf(user.address)).to.equal(initialBalance - burnAmount);
      });
  
      it("Should prevent non-burner from crosschain burning", async function () {
        const BURNER_ROLE = await astarToken.BURNER_ROLE();
        await expect(
          astarToken.connect(user).crosschainBurn(user.address, burnAmount)
        ).to.be.revertedWithCustomError(
          astarToken,
          "AccessControlUnauthorizedAccount"
        ).withArgs(user.address, BURNER_ROLE);
      });
  
      it("Should not allow crosschain burning more than balance", async function () {
        await expect(
          astarToken.connect(burner).crosschainBurn(user.address, initialBalance + 1000n)
        ).to.be.revertedWithCustomError(
          astarToken,
          "ERC20InsufficientBalance"
        ).withArgs(user.address, initialBalance, initialBalance + 1000n);
      });
  
      it("Should not allow crosschain burning from zero address", async function () {
        await expect(
          astarToken.connect(burner).crosschainBurn(ethers.ZeroAddress, burnAmount)
        ).to.be.revertedWithCustomError(
          astarToken,
          "ERC20InvalidSender"
        ).withArgs(ethers.ZeroAddress);
      });

      it("Should emit both Transfer and CrosschainBurn events when crosschain burning", async function () {
        await expect(astarToken.connect(burner).crosschainBurn(user.address, burnAmount))
          .to.emit(astarToken, "Transfer")
          .withArgs(user.address, ethers.ZeroAddress, burnAmount)
          .and.to.emit(astarToken, "CrosschainBurn")
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
        
        const supportsInterface = await astarToken.supportsInterface(IERC7802_ID);
        expect(supportsInterface).to.be.true;
      });
    });
  });
});
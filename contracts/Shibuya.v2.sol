// SPDX-FileCopywriteText: 2024 Astar Foundation <info@astar.network>
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { ERC20BurnableUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC165, IERC7802 } from "contracts/interfaces/IERC7802.sol";

// @author Astar Foundation
// @title ShibuyaToken
contract ShibuyaToken is Initializable, ERC20Upgradeable, ERC20BurnableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable, IERC7802 {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    address private _owner;
    address private _pendingOwner;

    error ZeroAmount();

    event OwnershipTransferRequested(address indexed from, address indexed to);
    event OwnershipTransferred(address indexed from, address indexed to);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initializeV3(address defaultAdmin) reinitializer(3) public {
        require(defaultAdmin != address(0), "Cannot set the default admin to zero address");

        __ERC20_init("Shibuya Token", "SBY");
        __ERC20Burnable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        if (hasRole(DEFAULT_ADMIN_ROLE, defaultAdmin)) {
            _revokeRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        }

        _owner = defaultAdmin;
    }

    // ======== CCIP Integrations ========

    /// @dev Uses OZ ERC20Upgradeable _mint to disallow minting to address(0).
    function mint(address account, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(account, amount);
    }

    /// @inheritdoc ERC20BurnableUpgradeable
    /// @dev Uses OZ ERC20Upgradeable _burn to disallow burning from address(0).
    function burn(uint256 amount) public override onlyRole(BURNER_ROLE) {
        super.burn(amount);
    }

    /// @dev Alias for BurnFrom for compatibility with the older naming convention.
    /// @dev Uses burnFrom for all validation & logic.
    function burn(address account, uint256 amount) public onlyRole(BURNER_ROLE) {
        burnFrom(account, amount);
    }

    // @inheritdoc ERC20BurnableUpgradeable
    /// @dev Uses OZ ERC20Upgradeable _burn to disallow burning from address(0).
    function burnFrom(address account, uint256 amount) public override onlyRole(BURNER_ROLE) {
        super.burnFrom(account, amount);
    }

    // ======== Access Control ========

    // @notice Grants mint and burn roles to an address.
    // @dev Calls public functions so this function does not require access controls.
    // This is handled in the inner functions.
    function grantMintAndBurnRoles(address mintAndBurner) external {
        grantMintRole(mintAndBurner);
        grantBurnRole(mintAndBurner);
    }

    // @notice Grants mint role to the given address.
    // @dev Only the owner can call this function.
    function grantMintRole(address minter) public onlyOwner {
        grantRole(MINTER_ROLE, minter);
    }

    // @notice Grants burn role to the given address.
    // @dev Only the owner can call this function.
    function grantBurnRole(address burner) public onlyOwner {
        grantRole(BURNER_ROLE, burner);
    }

    // @notice Revokes mint and burn roles from an address.
    // @dev Calls public functions so this function does not require access controls.
    // This is handled in the inner functions.
    function revokeMintAndBurnRoles(address mintAndBurner) external {
        revokeMintRole(mintAndBurner);
        revokeBurnRole(mintAndBurner);
    }

    // @notice Revokes mint role for the given address.
    // @dev Only the owner can call this function.
    function revokeMintRole(address minter) public onlyOwner {
        revokeRole(MINTER_ROLE, minter);
    }

    // @notice Revokes burn role for the given address.
    // @dev Only the owner
    function revokeBurnRole(address burner) public onlyOwner {
        revokeRole(BURNER_ROLE, burner);
    }

    // @notice Grants a role to an address.
    // @dev Only the owner can call this function.
    function grantRole(bytes32 role, address account) public override onlyOwner {
        super._grantRole(role, account);
    }

    // @notice Revokes a role from an address.
    // @dev Only the owner can call this function.
    function revokeRole(bytes32 role, address account) public override onlyOwner {
        super._revokeRole(role, account);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ======== Ownership ========

    // @notice Returns the current owner of the contract.
    function owner() public view returns (address) {
        return _owner;
    }

    // @notice Throws if called by any account other than the owner.
    modifier onlyOwner() {
        require(msg.sender == _owner, "Caller is not the owner");
        _;
    }

    // @notice Transfers ownership of the contract to a new account (`to`).
    function transferOwnership(address to) public onlyOwner {
        require(to != address(msg.sender), "Cannot transfer to self");

        _pendingOwner = to;

        emit OwnershipTransferRequested(_owner, to);
    }

    // @notice Accepts the ownership transfer request.
    function acceptOwnership() external {
        require(msg.sender == _pendingOwner, "Must be proposed owner");

        address oldOwner = _owner;
        _owner = msg.sender;
        _pendingOwner = address(0);

        emit OwnershipTransferred(oldOwner, msg.sender);
    }

    // ======== ERC7802 ========

    /// @notice Allows the SuperchainTokenBridge to mint tokens.
    /// @param _to     Address to mint tokens to.
    /// @param _amount Amount of tokens to mint.
    /// @dev Reverts if amount is zero to prevent unnecessary event emissions.
    function crosschainMint(address _to, uint256 _amount) external onlyRole(MINTER_ROLE) {
        if (_amount == 0) revert ZeroAmount();
        _mint(_to, _amount);

        emit CrosschainMint(_to, _amount, msg.sender);
    }

    /// @notice Allows the SuperchainTokenBridge to burn tokens.
    /// @param _from   Address to burn tokens from.
    /// @param _amount Amount of tokens to burn.
    /// @dev Reverts if amount is zero to prevent unnecessary event emissions.
    function crosschainBurn(address _from, uint256 _amount) external onlyRole(BURNER_ROLE) {
        if (_amount == 0) revert ZeroAmount();
        _burn(_from, _amount);

        emit CrosschainBurn(_from, _amount, msg.sender);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControlUpgradeable, IERC165)
        returns (bool)
    {
        return
            interfaceId == type(IERC7802).interfaceId ||
            interfaceId == type(IERC20).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}

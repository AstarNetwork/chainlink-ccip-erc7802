// SPDX-FileCopywriteText: 2024 Astar Foundation <info@astar.network>
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

// @author Astar Foundation
// @title ShibuyaToken
contract ShibuyaToken is Initializable, ERC20Upgradeable, ERC20BurnableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    address private _owner;
    address private _pendingOwner;

    event OwnershipTransferRequested(address indexed from, address indexed to);
    event OwnershipTransferred(address indexed from, address indexed to);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initializeV2(address defaultAdmin) reinitializer(2) public {
        require(defaultAdmin != address(0), "Cannot set the default admin to zero address");

        __ERC20_init("Shibuya Token", "SBY");
        __ERC20Burnable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);

        _owner = defaultAdmin;
    }

    /// @dev Uses OZ ERC20Upgradeable _mint to disallow burning from address(0).
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

    // @notice Grants mint and burn roles to an address.
    // @dev Calls public functions so this function does not require access controls.
    // This is handled in the inner functions.
    function grantMintAndBurnRoles(address minAndBurner) external {
        grantMintRole(minAndBurner);
        grantBurnRole(minAndBurner);
    }

    // @notice Grants mint role to the given address.
    // @dev Only the DEFAULT_ADMIN_ROLE can call this function.
    function grantMintRole(address minter) public onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(MINTER_ROLE, minter);
    }

    // @notice Grants burn role to the given address.
    // @dev Only the DEFAULT_ADMIN_ROLE can call this function.
    function grantBurnRole(address burner) public onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(BURNER_ROLE, burner);
    }

    // @notice Revokes mint and burn roles from an address.
    // @dev Calls public functions so this function does not require access controls.
    // This is handled in the inner functions.
    function revokeMintAndBurnRoles(address minAndBurner) external {
        revokeMintRole(minAndBurner);
        revokeBurnRole(minAndBurner);
    }

    // @notice Revokes mint role for the given address.
    // @dev Only the DEFAULT_ADMIN_ROLE can call this function.
    function revokeMintRole(address minter) public onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(MINTER_ROLE, minter);
    }

    // @notice Revokes burn role for the given address.
    // @dev Only the DEFAULT_ADMIN_ROLE can call this function.
    function revokeBurnRole(address burner) public onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(BURNER_ROLE, burner);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

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
}

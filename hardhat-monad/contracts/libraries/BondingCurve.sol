// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title BondingCurve
/// @notice Sqrt bonding curve: price(supply) = K * sqrt(supply)
/// @dev Fixed-point math with 1e18 precision

library BondingCurve {
    uint256 constant PRECISION = 1e18;

    /// @notice Cost in MON to buy `tokenAmount` tokens at `currentSupply`
    function getBuyCost(
        uint256 currentSupply,
        uint256 tokenAmount,
        uint256 k
    ) internal pure returns (uint256) {
        uint256 newSupply = currentSupply + tokenAmount;
        uint256 integralNew = _integral(newSupply);
        uint256 integralOld = _integral(currentSupply);
        return (k * (integralNew - integralOld)) / PRECISION;
    }

    /// @notice MON received for selling `tokenAmount` tokens at `currentSupply`
    function getSellRevenue(
        uint256 currentSupply,
        uint256 tokenAmount,
        uint256 k
    ) internal pure returns (uint256) {
        require(tokenAmount <= currentSupply, "Sell exceeds supply");
        uint256 newSupply = currentSupply - tokenAmount;
        uint256 integralOld = _integral(currentSupply);
        uint256 integralNew = _integral(newSupply);
        return (k * (integralOld - integralNew)) / PRECISION;
    }

    /// @notice Current price per token
    function getPrice(uint256 currentSupply, uint256 k) internal pure returns (uint256) {
        if (currentSupply == 0) return 0;
        return (k * _sqrt(currentSupply)) / PRECISION;
    }

    /// @dev Integral of sqrt: (2/3) * x^(3/2)
    function _integral(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 sqrtX = _sqrt(x);
        uint256 xPow3Half = (x * sqrtX) / PRECISION;
        return (2 * xPow3Half) / 3;
    }

    /// @dev Babylonian sqrt with 1e18 fixed-point
    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 scaled = x * PRECISION;
        y = scaled;
        uint256 z = (scaled + 1) / 2;
        while (z < y) {
            y = z;
            z = (scaled / z + z) / 2;
        }
    }
}

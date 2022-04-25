/**
 * @type import('hardhat/config').HardhatUserConfig
 */
 require("@nomiclabs/hardhat-waffle");

 require("hardhat-gas-reporter");

const config = {
  networks: {
    hardhat: {},
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  },
  gasReporter: {
    enabled: true,
    coinmarketcap: "2bd639b0-ef37-4768-8aa5-b1f6dd6ed437",
    currency: "USD",
    
  },
  // etherscan: {
  //   apiKey: ETHERSCAN_API_KEY,
  // },
  solidity: {
    compilers: [
      {
        version: "0.8.7",
        settings: {
          // optimizer: {
          //   enabled: true,
          //   runs: 200,
          // },
        },
      },
    ],
  },
  mocha: {
    timeout: 120000,
  },
};

module.exports = config;
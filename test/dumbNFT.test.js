const { expect } = require("chai");
const { constants } = require("ethers");
const { ethers, waffle } = require("hardhat");
const { int } = require("hardhat/internal/core/params/argumentTypes");

describe("dumbNFT", function () {
  let deployer, user1, user2;
  let dumbNFT;
  let provider;

  before(async function () {
    [deployer, user1, user2] = await hre.ethers.getSigners();
    const provider = ethers.provider;
  });

  beforeEach(async function () {
    const DumbNFT = await hre.ethers.getContractFactory("DumbNFT");
    dumbNFT = await DumbNFT.deploy(3383);
    await dumbNFT.deployed();
  });

  describe("Minting", function () {
    it("should be possible to mint after the sale has started", async function () {
      await dumbNFT.setSaleState(1);
      const contractFromUser = await hre.ethers.getContractAt(
        "DumbNFT",
        dumbNFT.address,
        user1
      );

      const prevTotalBalance = await dumbNFT.totalSupply();
      await contractFromUser.mint(1, {
        value: hre.ethers.BigNumber.from("10000000000000000"),
      });

      expect((await dumbNFT.totalSupply()).toNumber()).to.equal(
        prevTotalBalance.add(1).toNumber()
      );
    });

    it("should not be possible to mint if the sale has not started yet", async function () {
      await expect(
        dumbNFT.mint(1, {
          value: hre.ethers.BigNumber.from("10000000000000000"),
        })
      ).to.be.revertedWith("Sale is not active");
    });
  });

  describe("Reveal and chainlink random values", function () {
    it("setNum should return 5% of supply always, even after multiple games", async function () {
      await dumbNFT.setSaleState(1);
      const contractFromUser = await hre.ethers.getContractAt(
        "DumbNFT",
        dumbNFT.address,
        user1
      );

      await contractFromUser.mint(10000, {
        value: hre.ethers.BigNumber.from("100000000000000000000"),
      });

      expect(await dumbNFT.totalSupply()).to.eq(10000);
      await dumbNFT.setNumWordsTEST();
      expect(await dumbNFT.numWords()).to.eq(10000 * 0.05);

      //========================================================

      await contractFromUser.mint(277, {
        value: hre.ethers.BigNumber.from("2770000000000000000"),
      });
      expect(await dumbNFT.totalSupply()).to.eq(10277);
      await dumbNFT.setNumWordsTEST();
      //returns 513 (floors answer), exact val = 513.85
      expect(await dumbNFT.numWords()).to.eq(513);

      //========================================================

      await contractFromUser.mint(661, {
        value: hre.ethers.BigNumber.from("6610000000000000000"),
      });
      expect(await dumbNFT.totalSupply()).to.eq(10938);
      await dumbNFT.setNumWordsTEST();
      //returns 546 (floors answer), exact val = 546.69
      expect(await dumbNFT.numWords()).to.eq(546);

      const expectedRandomArray = [1001, 268, 7655, 406, 5555, 2689];
      await dumbNFT.setRandom(expectedRandomArray);

      await dumbNFT.toggleRevealAll();
      await dumbNFT.toggleRevealAll();

      //========================================================
      //after a new game

      const prevTotalBalance = await dumbNFT.totalSupply();

      await contractFromUser.mint(3541, {
        value: hre.ethers.BigNumber.from("35410000000000000000"),
      });
      expect(await dumbNFT.gameStartingTokenID()).to.eq(
        prevTotalBalance.add(1)
      );
      await dumbNFT.setNumWordsTEST();
      //returns 177 (floors answer), exact val = 177.05
      expect(await dumbNFT.numWords()).to.eq(177);

      await dumbNFT.setRandom(expectedRandomArray);

      await dumbNFT.toggleRevealAll();
      await dumbNFT.toggleRevealAll();

      //========================================================
      const prevTotalBalance2 = await dumbNFT.totalSupply();

      await contractFromUser.mint(7943, {
        value: hre.ethers.BigNumber.from("79430000000000000000"),
      });
      expect(await dumbNFT.gameStartingTokenID()).to.eq(
        prevTotalBalance2.add(1)
      );
      await dumbNFT.setNumWordsTEST();
      //returns 177 (floors answer), exact val = 177.05
      expect(await dumbNFT.numWords()).to.eq(397);
    });

    it("should return specified amount of unique IDs", async function () {
      const expectedRandomArray = [1, 2, 5];
      await dumbNFT.setRandom(expectedRandomArray);

      const nums = await dumbNFT.getRandom();
      const convertedNums = [];
      for (let i = 0; i < nums.length; i++) {
        convertedNums.push(nums[i].toNumber());
      }
      expect(convertedNums).to.eql(expectedRandomArray);
    });

    it("should mint 1000 NFTs and be able to reveal and unreveal as many as I want", async function () {
      await dumbNFT.setSaleState(1);
      await dumbNFT.setUnRevealUri("unrevealed");
      await dumbNFT.setRevealUri("revealed");
      await dumbNFT.mint(1000, {
        value: hre.ethers.BigNumber.from("10000000000000000000"),
      });

      expect(await dumbNFT.totalSupply()).to.eq(1000);

      const expectedRandomArray = [1001, 268, 7655, 406, 5555, 2689];
      await dumbNFT.setRandom(expectedRandomArray);

      expect(await dumbNFT.tokenURI(1)).to.eq("unrevealed");
      await dumbNFT.toggleRevealAll();
      expect(await dumbNFT.tokenURI(1)).to.eq("revealed");
      await dumbNFT.setRandom(expectedRandomArray);
      await dumbNFT.toggleRevealAll();
      expect(await dumbNFT.tokenURI(1)).to.eq("unrevealed");
      await dumbNFT.setRandom(expectedRandomArray);
      await dumbNFT.toggleRevealAll();
      expect(await dumbNFT.tokenURI(1)).to.eq("revealed");
    });

    it("gameNumber and starting ID index of next game", async function () {
      expect(await dumbNFT.gameNumber()).to.equal(1);
      expect(await dumbNFT.gameStartingTokenID()).to.equal(0);

      await dumbNFT.setSaleState(1);
      await dumbNFT.setUnRevealUri("unrevealed");
      await dumbNFT.setRevealUri("revealed");

      await dumbNFT.mint(1000, {
        value: hre.ethers.BigNumber.from("10000000000000000000"),
      });

      expect(await dumbNFT.tokenURI(1)).to.equal("unrevealed");
      const expectedRandomArray = [1001, 268, 7655, 406, 5555, 2689];
      await dumbNFT.setRandom(expectedRandomArray);

      await dumbNFT.toggleRevealAll();

      expect(await dumbNFT.gameNumber()).to.equal(2);
      expect(await dumbNFT.gameStartingTokenID()).to.equal(1001);

      expect(await dumbNFT.tokenURI(1)).to.eq("revealed");
      await dumbNFT.toggleRevealAll();

      await dumbNFT.mint(1000, {
        value: hre.ethers.BigNumber.from("10000000000000000000"),
      });

      expect(await dumbNFT.tokenURI(1)).to.eq("unrevealed");
      await dumbNFT.setRandom(expectedRandomArray);
      await dumbNFT.toggleRevealAll();

      expect(await dumbNFT.gameNumber()).to.equal(3);
      expect(await dumbNFT.gameStartingTokenID()).to.equal(2001);

      expect(await dumbNFT.tokenURI(1)).to.eq("revealed");
      await dumbNFT.toggleRevealAll();

      await dumbNFT.mint(10, {
        value: hre.ethers.BigNumber.from("100000000000000000"),
      });

      expect(await dumbNFT.tokenURI(1)).to.eq("unrevealed");
      await dumbNFT.setRandom(expectedRandomArray);
      await dumbNFT.toggleRevealAll();

      expect(await dumbNFT.tokenURI(1)).to.eq("revealed");
      expect(await dumbNFT.gameStartingTokenID()).to.equal(2011);
    });
  });

  describe("Winners not being able to withdraw when criteria not met", function () {
    it("should not be possible to withdraw when unrevealed", async function () {
      await expect(dumbNFT.withdrawETHWinner(1)).to.be.revertedWith(
        "Reveal is not yet enabled"
      );
    });
    it("should not be possible to withdraw when I am not a winner", async function () {
      const expectedRandomArray = [5, 6, 8];
      await dumbNFT.setRandom(expectedRandomArray);
      await dumbNFT.setSaleState(1);
      await dumbNFT.setUnRevealUri("unrevealed");
      await dumbNFT.setRevealUri("revealed");
      await dumbNFT.toggleRevealAll();
      await dumbNFT.mint(1, {
        value: hre.ethers.BigNumber.from("10000000000000000"),
      });
      await expect(dumbNFT.withdrawETHWinner(1)).to.be.revertedWith(
        "You lost don't try this again lol"
      );
    });
    it("should not be possible to withdraw when I am not an owner", async function () {
      const expectedRandomArray = [5, 6, 8];
      await dumbNFT.setRandom(expectedRandomArray);
      await dumbNFT.setSaleState(1);
      await dumbNFT.setUnRevealUri("unrevealed");
      await dumbNFT.setRevealUri("revealed");
      await dumbNFT.toggleRevealAll();
      await dumbNFT.mint(1, {
        value: hre.ethers.BigNumber.from("10000000000000000"),
      });
      const contractFromUser = await hre.ethers.getContractAt(
        "DumbNFT",
        dumbNFT.address,
        user1
      );
      await expect(contractFromUser.withdrawETHWinner(1)).to.be.revertedWith(
        "You do not own this NFT"
      );
    });

    it("should be able to withdraw", async function () {
      const expectedRandomArray = [1];
      await dumbNFT.setRandom(expectedRandomArray);
      await dumbNFT.setSaleState(1);
      await dumbNFT.setUnRevealUri("unrevealed");
      await dumbNFT.setRevealUri("revealed");

      const contractFromUser1 = await hre.ethers.getContractAt(
        "DumbNFT",
        dumbNFT.address,
        user1
      );

      await contractFromUser1.mint(1, {
        value: hre.ethers.BigNumber.from("10000000000000000"),
      });
      await dumbNFT.toggleRevealAll();
      const prevBalance = await user1.getBalance();
      await contractFromUser1.withdrawETHWinner(1);

      //   expect(await user1.getBalance()).to.eq(
      //     prevBalance.add(hre.ethers.BigNumber.from("9000000000000000"))
      //   );
    });
  });

  describe("Testing internal functions before withdrawing", function () {
    it("Should remove winning token id from random token ids", async function () {
      const expectedRandomArray = [1, 2, 3, 4, 5, 6];
      await dumbNFT.setRandom(expectedRandomArray);
      await dumbNFT._removeWinningTokenOnceClaimed(3);
      const nums = await dumbNFT.getRandom();
      const convertedNums = [];
      for (let i = 0; i < nums.length; i++) {
        convertedNums.push(nums[i].toNumber());
      }
      expect(convertedNums).to.eql([1, 2, 6, 4, 5]);
    });
    it("Should return correct amount", async function () {
      const expectedRandomArray = [1, 2, 3, 4, 5, 6];
      await dumbNFT.setRandom(expectedRandomArray);
      const transactionHash = await dumbNFT.deposit({
        value: ethers.utils.parseEther("2"), // Sends exactly 1.0 ether
      });
      const balance = await dumbNFT.balance();
      const num = await dumbNFT._calculateWinnersSplit();
      console.log(num);
    });
  });

  it("Should run through 1 whole game and allow withdrawls", async function () {
    await dumbNFT.setSaleState(1);

    await dumbNFT.setRevealUri("Revealed");
    await dumbNFT.setUnRevealUri("Unrevealed");

    const contractFromUser1 = await hre.ethers.getContractAt(
      "DumbNFT",
      dumbNFT.address,
      user1
    );

    const contractFromUser2 = await hre.ethers.getContractAt(
      "DumbNFT",
      dumbNFT.address,
      user2
    );

    await dumbNFT.mint(1450, {
      value: hre.ethers.BigNumber.from("14500000000000000000"),
    });

    await contractFromUser1.mint(3770, {
      value: hre.ethers.BigNumber.from("37700000000000000000"),
    });

    await contractFromUser2.mint(2653, {
      value: hre.ethers.BigNumber.from("26530000000000000000"),
    });

    //ensure values are correct after everyones mint
    expect(await dumbNFT.gameNumber()).to.eq(1);
    expect(await dumbNFT.gameStartingTokenID()).to.eq(0);

    await dumbNFT.setSaleState(0);

    const expectedRandomArray = [1001, 268, 7655, 406, 5555, 2689];
    await dumbNFT.setRandom(expectedRandomArray);

    await dumbNFT.toggleRevealAll();
    expect(await dumbNFT.tokenURI(1688)).to.eq("Revealed");

    console.log(await dumbNFT.winnerAmountPerNFT());

    expect(await dumbNFT.winnerAmountPerNFT()).to.eq(11809500000000000000n);

    const prevBalance = await deployer.getBalance();

    await dumbNFT.withdrawETHWinner(1001);
    // console.log("Prev Balance = " + prevBalance)
    // console.log("current balance = " + await deployer.getBalance())
    //expect(await deployer.getBalance()).to.eq(prevBalance + 11809500000000000000n);
    await dumbNFT.withdrawETHWinner(268);
    await dumbNFT.withdrawETHWinner(406);
    await contractFromUser1.withdrawETHWinner(2689);
    await contractFromUser2.withdrawETHWinner(5555);
    await contractFromUser2.withdrawETHWinner(7655);
  });
  describe("proper tests", function () {
    it.only("running multiple games", async function () {
      await dumbNFT.setSaleState(1);
      await dumbNFT.mint(100, {
        value: hre.ethers.BigNumber.from("1000000000000000000"),
      });

      await dumbNFT.setSaleState(0);
      const expectedRandomArray = [
        10, 26, 76, 46, 5, 29, 80, 65, 32, 12, 45, 6, 7, 9, 99, 81, 64, 23, 46,
        67, 91, 79, 73, 61,
      ];
      await dumbNFT.setRandom(expectedRandomArray);
      await dumbNFT.toggleRevealAll();
      expect(await dumbNFT.revealAll()).to.equal(true);
      await dumbNFT.withdrawETHWinner(10);
      //console.log(await dumbNFT.games(1));
      expect(await dumbNFT.tokenURI(26)).to.eq("Winner.json");

      await dumbNFT.toggleRevealAll();
      //console.log(await dumbNFT.random());
      //expect(await dumbNFT.random()).to.eq([]);

      ////////////End OF GAME 1 ///////////////////

      // await dumbNFT.setSaleState(1);

      // await dumbNFT.setRevealUri("Revealed");
      // await dumbNFT.setUnRevealUri("Unrevealed");

      // const contractFromUser1 = await hre.ethers.getContractAt(
      //   "DumbNFT",
      //   dumbNFT.address,
      //   user1
      // );

      // const contractFromUser2 = await hre.ethers.getContractAt(
      //   "DumbNFT",
      //   dumbNFT.address,
      //   user2
      // );

      // await dumbNFT.mint(1450, {
      //   value: hre.ethers.BigNumber.from("14500000000000000000"),
      // });

      // await contractFromUser1.mint(3770, {
      //   value: hre.ethers.BigNumber.from("37700000000000000000"),
      // });

      // await contractFromUser2.mint(2653, {
      //   value: hre.ethers.BigNumber.from("26530000000000000000"),
      // });

      // //ensure values are correct after everyones mint
      // expect(await dumbNFT.gameNumber()).to.eq(1);
      // expect(await dumbNFT.gameStartingTokenID()).to.eq(0);

      // await dumbNFT.setSaleState(0);

      // const expectedRandomArray = [1001, 268, 7655, 406, 5555, 2689];
      // await dumbNFT.setRandom(expectedRandomArray);

      // await dumbNFT.toggleRevealAll();
      // expect(await dumbNFT.tokenURI(1688)).to.eq("Revealed");
    });
  });
});

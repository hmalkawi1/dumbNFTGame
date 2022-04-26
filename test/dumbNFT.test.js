const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");

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
        dumbNFT = await DumbNFT.deploy(819);
        await dumbNFT.deployed();
    });

    describe("Minting", function () {
        it("should be possible to mint after the sale has started", async function () {
            await dumbNFT.setSaleState(1);
            const contractFromUser = await hre.ethers.getContractAt("DumbNFT", dumbNFT.address, user1);

            const prevTotalBalance = await dumbNFT.totalSupply();
            await contractFromUser.mint(1, {
                value: hre.ethers.BigNumber.from("10000000000000000"),
            });

            expect((await dumbNFT.totalSupply()).toNumber()).to.equal(prevTotalBalance.add(1).toNumber());
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
        it("should return specified amount of unique IDs", async function () {
            const expectedRandomArray = [1, 2, 5];
            await dumbNFT.setRandom(expectedRandomArray);

            await dumbNFT.printRandom();
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

            expect(await dumbNFT.tokenURI(1)).to.eq("unrevealed");
            await dumbNFT.toggleRevealAll();
            expect(await dumbNFT.tokenURI(1)).to.eq("revealed");
            await dumbNFT.toggleRevealAll();
            expect(await dumbNFT.tokenURI(1)).to.eq("unrevealed");
            await dumbNFT.toggleRevealAll();
            expect(await dumbNFT.tokenURI(1)).to.eq("revealed");
        });

        it("gameNumber and starting ID index of next game", async function () {
            expect(await dumbNFT.gameNumber()).to.equal(1);
            expect(await dumbNFT.gameStartingTokenID()).to.equal(1);

            await dumbNFT.setSaleState(1);
            await dumbNFT.setUnRevealUri("unrevealed");
            await dumbNFT.setRevealUri("revealed");

            await dumbNFT.mint(1000, {
                value: hre.ethers.BigNumber.from("10000000000000000000"),
            });

            expect(await dumbNFT.tokenURI(1)).to.equal("unrevealed");
            await dumbNFT.toggleRevealAll();

            expect(await dumbNFT.gameNumber()).to.equal(2);
            expect(await dumbNFT.gameStartingTokenID()).to.equal(1001);

            expect(await dumbNFT.tokenURI(1)).to.eq("revealed");
            await dumbNFT.toggleRevealAll();

            await dumbNFT.mint(1000, {
                value: hre.ethers.BigNumber.from("10000000000000000000"),
            });

            expect(await dumbNFT.tokenURI(1)).to.eq("unrevealed");
            await dumbNFT.toggleRevealAll();

            expect(await dumbNFT.gameNumber()).to.equal(3);
            expect(await dumbNFT.gameStartingTokenID()).to.equal(2001);

            expect(await dumbNFT.tokenURI(1)).to.eq("revealed");
            await dumbNFT.toggleRevealAll();

            await dumbNFT.mint(10, {
                value: hre.ethers.BigNumber.from("100000000000000000"),
            });

            expect(await dumbNFT.tokenURI(1)).to.eq("unrevealed");
            await dumbNFT.toggleRevealAll();

            expect(await dumbNFT.tokenURI(1)).to.eq("revealed");
            expect(await dumbNFT.gameStartingTokenID()).to.equal(2011);
        });
    });

    describe("Winners not being able to withdraw when criteria not met", function () {
        it("should not be possible to withdraw when unrevealed", async function () {
            await expect(dumbNFT.withdrawETHWinner(user1.address, 1)).to.be.revertedWith("Reveal is not yet enabled");
        });
        it("should not be possible to withdraw when I am not a winner", async function () {
            const expectedRandomArray = [5, 6, 8];
            await dumbNFT.setRandom(expectedRandomArray);
            await dumbNFT.setSaleState(1);
            await dumbNFT.setUnRevealUri("unrevealed");
            await dumbNFT.setRevealUri("revealed");
            await dumbNFT.toggleRevealState();
            await dumbNFT.mint(1, {
                value: hre.ethers.BigNumber.from("10000000000000000"),
            });
            await expect(dumbNFT.withdrawETHWinner(dumbNFT.address, 1)).to.be.revertedWith("You lost don't try this again lol");
        });
        it.only("should not be possible to withdraw when I am not an owner", async function () {
            const expectedRandomArray = [5, 6, 8];
            await dumbNFT.setRandom(expectedRandomArray);
            await dumbNFT.setSaleState(1);
            await dumbNFT.setUnRevealUri("unrevealed");
            await dumbNFT.setRevealUri("revealed");
            await dumbNFT.toggleRevealState();
            await dumbNFT.mint(1, {
                value: hre.ethers.BigNumber.from("10000000000000000"),
            });
            const contractFromUser = await hre.ethers.getContractAt("DumbNFT", dumbNFT.address, user1);
            await expect(contractFromUser.withdrawETHWinner(user1.address, 1)).to.be.revertedWith("You do not own this NFT");
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
        it.only("Should return correct amount", async function () {
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
    // describe("Winners being able to withdraw when criteria met", function () {
    //     it("should not be possible to withdraw when unrevealed", async function () {
    //         await expect(dumbNFT.withdrawETHWinner(user1.address, 1)).to.be.revertedWith("Reveal is not yet enabled");
    //     });
    //     it("should not be possible to withdraw when I am not a winner", async function () {
    //         const expectedRandomArray = [5, 6, 8];
    //         await dumbNFT.setRandom(expectedRandomArray);
    //         await dumbNFT.setSaleState(1);
    //         await dumbNFT.setUnRevealUri("unrevealed");
    //         await dumbNFT.setRevealUri("revealed");
    //         await dumbNFT.toggleRevealState();
    //         await dumbNFT.mint(1, {
    //             value: hre.ethers.BigNumber.from("10000000000000000"),
    //         });
    //         await expect(dumbNFT.withdrawETHWinner(dumbNFT.address, 1)).to.be.revertedWith("You lost don't try this again lol");
    //     });
    //     it.only("should not be possible to withdraw when I am not an owner", async function () {
    //         const expectedRandomArray = [5, 6, 8];
    //         await dumbNFT.setRandom(expectedRandomArray);
    //         await dumbNFT.setSaleState(1);
    //         await dumbNFT.setUnRevealUri("unrevealed");
    //         await dumbNFT.setRevealUri("revealed");
    //         await dumbNFT.toggleRevealState();
    //         await dumbNFT.mint(1, {
    //             value: hre.ethers.BigNumber.from("10000000000000000"),
    //         });
    //         const contractFromUser = await hre.ethers.getContractAt("DumbNFT", dumbNFT.address, user1);
    //         await expect(contractFromUser.withdrawETHWinner(user1.address, 1)).to.be.revertedWith("You do not own this NFT");
    //     });
    // });
});

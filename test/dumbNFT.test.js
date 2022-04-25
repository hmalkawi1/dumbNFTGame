const { expect } = require("chai");

describe("dumbNFT", function () {
    let deployer, user1, user2;
    let dumbNFT;

    before(async function () {
        [deployer, user1, user2] = await hre.ethers.getSigners();
    });

    beforeEach(async function () {

        const DumbNFT = await hre.ethers.getContractFactory("DumbNFT");
        dumbNFT = await DumbNFT.deploy(819);
        await dumbNFT.deployed();
    });

    describe("Minting", function() {
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
    })

    describe("Reveal and chainlink random values", function(){
        // it("should return specified amount of unique IDs", async function(){

        //     await dumbNFT.setRandom([1,2,5]);

        //     await dumbNFT.printRandom();
        //     expect(await dumbNFT.getRandom()).to.eq([1,2,5]);
        // })
    
        it("should mint 1000 NFTs and be able to reveal and unreveal as many as I want", async function(){
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
        })

        it("gameNumber and starting ID index of next game", async function(){
          
            expect((await dumbNFT.gameNumber())).to.equal(1);
            expect(await dumbNFT.gameStartingTokenID()).to.equal(1);

            await dumbNFT.setSaleState(1);
            await dumbNFT.setUnRevealUri("unrevealed");
            await dumbNFT.setRevealUri("revealed");

            await dumbNFT.mint(1000, {
                value: hre.ethers.BigNumber.from("10000000000000000000"),
            });


            expect(await dumbNFT.tokenURI(1)).to.equal("unrevealed");
            await dumbNFT.toggleRevealAll();

            expect((await dumbNFT.gameNumber())).to.equal(2);
            expect(await dumbNFT.gameStartingTokenID()).to.equal(1001);

            expect(await dumbNFT.tokenURI(1)).to.eq("revealed");
            await dumbNFT.toggleRevealAll();

            await dumbNFT.mint(1000, {
                value: hre.ethers.BigNumber.from("10000000000000000000"),
            });
            
            expect(await dumbNFT.tokenURI(1)).to.eq("unrevealed");
            await dumbNFT.toggleRevealAll();

            expect((await dumbNFT.gameNumber())).to.equal(3);
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
        })

        
    })


})
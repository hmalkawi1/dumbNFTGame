/*

upgradable erc721a

Contract rules: (Dumb NFT Game)

max supply = infinite

winners of each round = 5%
    - for first 5000 mints, winners = 5%
    - every 1000 increment winner pool, goes down by 0.01%

mint price = 0.01 ETH

- unrevealed 
- reveals winners, get winner pool + get to play another round for free

- winner splits:
    - below 5000 mints, winner pool = 50%
    - every 1000 increment, winner pool+=1%
    - maximum of 90% winner pool. Team = 10%

-record winners addresses and air drop them NFT from the Dumb NFT Winners collection

minting happens over 1 week (can be controlled by team later)




Things to mathmatically figure out:

1- % of winners from each round, how much it increments and what points, what is the base number of mints (ex 5000) with the flat % (ex 5%)?
2- winner splits %s at flat percent, winner splits increments and what points?
3- 

*/



pragma solidity 0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "hardhat/console.sol";



contract DumbNFT is ERC721A, VRFConsumerBaseV2, Ownable {
    VRFCoordinatorV2Interface COORDINATOR;
    address vrfCoordinator = 0x6168499c0cFfCaCD319c818142124B7A15E857ab; //(RINKEBY) 
    bytes32 internal keyHash = 0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc; //(RINKEBY)
    uint32 callbackGasLimit = 100000;
    // The default is 3, but you can set this higher.
    uint16 requestConfirmations = 3;
    // Get a subscription ID from https://vrf.chain.link/ to use in the constructor during deployment
    uint64 s_subscriptionId;

    enum SaleState {
        Disabled,
        Enable
    }

    // struct gameStats{
    //     uint256[] public random;
    //     uint256 public gameNumber;
    //     uint32 public numWords;
    //     uint256 public gameStartingTokenID;
    //     uint256 public s_requestId;

    // }

    SaleState public saleState = SaleState.Disabled;
    //should we disable transfers once things are revealed to stop trading ? or?
    bool public transfersEnabled;
    bool public revealAll;

    uint256 public price;
    uint256 public winnerAmountPerNFT;

    uint256[] public random;
    uint256 public s_requestId;

    uint256 public gameNumber;
    uint32 public numWords;
    uint256 public gameStartingTokenID;

    string public unRevealUri;
    string public revealUri;
    //MAKE SURE TO CHANGE THIS INTO CONSTRUCTOR BEFORE DEPLOYING
    address payable devWallet = payable(0x361d65CBbAE9dC942E58Dc89c24aBa7195750b24); 

    event Revealed(uint256 timestamp, uint256[] winningNFTs);
    event SaleStateChanged(uint256 previousState, uint256 nextState, uint256 timestamp);


    constructor(uint64 subscriptionId) ERC721A("DumbNFT", "DNFT") VRFConsumerBaseV2(vrfCoordinator) {
        //Chainlink
        COORDINATOR = VRFCoordinatorV2Interface(vrfCoordinator);
        s_subscriptionId = subscriptionId;


        
        //Defaults
        revealAll = false;

        price = 10000000000000000;
        gameNumber = 1;
        gameStartingTokenID = 0;
    }

    modifier whenSaleIsActive() {
        require(saleState != SaleState.Disabled, "Sale is not active");
        _;
    }
    modifier whenRevealIsEnabled() {
        require(revealAll, "Reveal is not yet enabled");
        _;
    }
    // Modifier for winner
    modifier onlyWinner(uint256 tokenId) {
        require(ownerOf(tokenId) == msg.sender, "You do not own this NFT");
        require(_verifyWinningToken(tokenId), "You lost don't try this again lol");
        _;
    }


    //++++++++
    // Public functions
    //++++++++

    // Payable mint function for unrevealed NFTs
    function mint(uint256 amount) external payable whenSaleIsActive {

        require(price * amount == msg.value, "Value sent is not correct");
        
        _safeMint(msg.sender, amount);

    }
    
    function withdrawETHWinner(uint256 _tokenId) external payable whenRevealIsEnabled onlyWinner(_tokenId) {
        require(msg.sender != address(0), "Cannot recover ETH to the 0 address");
        payable(msg.sender).transfer(winnerAmountPerNFT);
        _removeWinningTokenOnceClaimed(_tokenId);
    }



    //++++++++
    // Owner functions
    //++++++++

    function setDevWallet(address payable devWallet_) public onlyOwner{
        devWallet = payable(devWallet_);
    }

    // Sale functions
    function setSaleState(uint256 _state) external onlyOwner {
        uint256 prevState = uint256(saleState);
        saleState = SaleState(_state);
        emit SaleStateChanged(prevState, _state, block.timestamp);
    }


    function setMintPrice(uint256 _mintPrice) external onlyOwner {
        price = _mintPrice;
    }

    // Get random for revealed NFTs
    function getRandom() external onlyOwner {
        _setNumWords();
        // _setGasCallbackLimit();
        s_requestId = COORDINATOR.requestRandomWords(
            keyHash,
            s_subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );
    }

    // Change the reveal URI set for new mints, this should be a path to all jsons
    function setRevealUri(string calldata uri) external onlyOwner {
        revealUri = uri;
    }

    // Change the unreveled URI set for new mints, this should be a uri pointing to the unrevealed metadata json
    function setUnRevealUri(string calldata uri) external onlyOwner {
        unRevealUri = uri;
    }

    // Un-paid mint function for community giveaways
    function mintForCommunity(address to, uint256 amount) external onlyOwner {
        _safeMint(to, amount);
    }


    function toggleRevealAll() external onlyOwner {
        require(random.length>0,"No winners have been decided yet");
        //get random should be called in here
        revealAll = !revealAll;
        if(revealAll == true){
            //getRandom()
            //maybe do all this work in a purge game function()
            gameNumber+=1;
            gameStartingTokenID = totalSupply() + 1;
            _devWithdraw();
            winnerAmountPerNFT = _calculateWinnersSplit();
            emit Revealed(block.timestamp, random);
        }
    }

    //++++++++
    // Internal functions
    //++++++++

    function _startTokenId() internal view virtual override returns (uint256) {
        return 1;
    }

    //HARDCODED TO WITHDRAW 10%, CHANGE FOR PROD
    function _devWithdraw() internal {
        uint256 balance = address(this).balance;
        balance = balance/10;
        devWallet.transfer(balance);
    }

    // Hardcoded for 90% right now, can change
    // only need to run this once
    // We have total: 10 eth -> 
    //calculates percent of winnings per single winning NFT
    function _calculateWinnersSplit() public view returns(uint256){
        uint256 balance = address(this).balance;
        balance = balance / random.length;
        return balance;
    }

    function _verifyWinningToken(uint256 _tokenId) internal view virtual returns (bool){
        for (uint256 i = 0; i < random.length; i++){
            if (_tokenId == random[i]){
                return true;
            }
        }
        return false;
    }

    // removes winning token from random to ensure winners dont claim twice
    // in addition resets random 1 by 1, so we don't have to delete values later on
    // will still have to scrub values if any left
    function _removeWinningTokenOnceClaimed(uint256 _tokenId) public {
        for (uint256 i = 0; i < random.length; i++){
            if (_tokenId == random[i]){
                random[i] = random[random.length -1];
                random.pop();
            }
        }
    }

    function fulfillRandomWords(uint256, uint256[] memory randomWords) internal override {
         if(gameNumber == 1){
            for(uint256 i = 0; i < numWords; i++){
                random[i] = (randomWords[i] % totalSupply()) + 1;
            }
        }
        else{
            for(uint256 i = 0; i < numWords; i++){
                random[i] = (randomWords[i] % totalSupply()) + gameStartingTokenID;
            }
        }
    }

    //should be internal, public right now for testing
    function _setNumWords() internal {
        //could there be an issue by type casting to uint32?

        numWords = uint32(((totalSupply() - gameStartingTokenID)* 5)/ 100);
    }

    // function _setCallbackGasLimit() internal {
    //     //Chainlink requires roughly 20,000 gas to store 1 value. 30000 to be safe
    //     return callbackGasLimit = numWords * 30000; 
    // }

    //++++++++
    // Override functions
    //++++++++
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
        require(tokenId < totalSupply(), "This token is greater than maxSupply");


        if (revealAll == true) {
            // aws.DNFT.ca/ (55 + 0.5) % (totalsupply()) = 1.2
            /*

            if (tokenId) is in array findwinners()
                return (string(abi.encodePacked(revealUri, Strings.toString(winner,gameNumber, ".json")))

            */
        //     return string(abi.encodePacked(revealUri, Strings.toString((tokenId + random) % (totalSupplyLeft + totalSupply())), ".json"));
            return revealUri;
        } else {
            return unRevealUri;
        }
    }

    //++++++++
    // Test functions
    //++++++++

    function setRandom(uint256[] calldata random_) public {
        random = random_;
    }

    function deposit() external payable {
        require(msg.value > 1 ether, "please send two ether");
    }

    function balance() external view returns(uint256){
        return address(this).balance;
    }


}

/*
MUST FIGURE OUT DEV AND USERS SPLITS
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
    uint32 callbackGasLimit = 2000000;
    uint16 requestConfirmations = 3;
    uint64 s_subscriptionId;

    enum SaleState {
        Disabled,
        Enable
    }

    struct Game{
        uint256[] random;
        uint256 gameId;// same as gameNumber
        uint32 numWords;
        uint256 numMints;
        uint256 mintStart;
    }
    mapping(uint256=>bool) claimed;
    mapping(uint256=>Game) public games; 

    SaleState public saleState = SaleState.Disabled;
    //should we disable transfers once things are revealed to stop trading ? or?
    bool public transfersEnabled;
    bool public revealAll;

    uint256 public price;
    uint256 public winnerAmountPerNFT;

    uint256[] public random;
    uint256[] public emergencyRandom;
    uint256 public s_requestId;

    uint256 public devSplit = 10;

    uint256 public gameNumber;
    uint256 public gameStartingTokenID;
    uint32 public numWords;

    string public unRevealUri;
    string public revealUri;
    
    address payable devWallet; 

    event Revealed(uint256 timestamp, uint256[] winningNFTs);
    event SaleStateChanged(uint256 previousState, uint256 nextState, uint256 timestamp);
    event GameComplete(Game game);


    constructor(uint64 subscriptionId) ERC721A("DumbNFT", "DNFT") VRFConsumerBaseV2(vrfCoordinator) {
        //Chainlink
        COORDINATOR = VRFCoordinatorV2Interface(vrfCoordinator);
        s_subscriptionId = subscriptionId;

        setDevWallet(payable(owner()));
        
        //Defaults
        revealAll = false;
        price = 10000000000000000;
        gameNumber = 1;
        gameStartingTokenID = 0;

        //initialize index 0  of games. We're starting from game 1
        games[0].gameId = 0;
        games[0].numWords = 0;
        games[0].numMints = 0;
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
    modifier onlyWinner(uint256 tokenId_) {
        require(ownerOf(tokenId_) == msg.sender, "Are you trolling ? You don't even own this NFT... lol");
        require(_verifyWinningToken(tokenId_), "You lost or you already claimed. Don't try this again lol... please...");
        require(claimed[tokenId_] == false, "lol...come on man you already...begging you lol");
        _;
    }


    //++++++++
    // Public functions
    //++++++++
    function mint(uint256 amount) external payable whenSaleIsActive {

        require(price * amount == msg.value, "Value sent is not correct");
        
        _safeMint(msg.sender, amount);

    }

    function withdrawETHWinner(uint256 tokenId_) external payable whenRevealIsEnabled onlyWinner(tokenId_) {
        require(msg.sender != address(0), "Cannot recover ETH to the 0 address");
        payable(msg.sender).transfer(winnerAmountPerNFT);
        claimed[tokenId_] = true;
        _removeWinningTokenOnceClaimed(tokenId_);
    }



    //++++++++
    // Owner functions
    //++++++++

    function setDevSplit(uint256 devSplit_) public onlyOwner {
        devSplit = devSplit_;
    }

    function setDevWallet(address payable devWallet_) public onlyOwner{
        devWallet = payable(devWallet_);
    }

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
        s_requestId = COORDINATOR.requestRandomWords(
            keyHash,
            s_subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );
    }

    function getRandom(uint32 emergancyNumWords_) external onlyOwner{
        s_requestId = COORDINATOR.requestRandomWords(
            keyHash,
            s_subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            emergancyNumWords_
        );
    }

    
    function setRevealUri(string calldata uri_) external onlyOwner {
        revealUri = uri_;
    }

    
    function setUnRevealUri(string calldata uri_) external onlyOwner {
        unRevealUri = uri_;
    }

    // Un-paid mint function for community giveaways
    function mintForCommunity(address to_, uint256 amount_) external onlyOwner {
        _safeMint(to_, amount_);
    }


    function toggleRevealAll() external onlyOwner {
        revealAll = !revealAll;
        if(revealAll == true){
            _endGame();
            emit Revealed(block.timestamp, random);
        }
        //if we are going back to unrevealed state (aka start a new game), must set random to empty array to start from scratch
        else{
            resetRandom();
        }
    }

    function resetRandom() public onlyOwner {
        random = games[0].random;
    }

    //++++++++
    // Internal functions
    //++++++++

    function _startTokenId() internal view virtual override returns (uint256) {
        return 1;
    }

    function _endGame() internal {
        //set games struct
        games[gameNumber].random = random;
        games[gameNumber].gameId = gameNumber;
        games[gameNumber].numWords = numWords;
        games[gameNumber].numMints = totalSupply() - gameStartingTokenID;
        games[gameNumber].mintStart = gameStartingTokenID;
       
        emit GameComplete(games[gameNumber]);

        //Prep values for next game
        gameNumber+=1;
        gameStartingTokenID = totalSupply();
        _devWithdraw();
        winnerAmountPerNFT = _calculateWinnersSplit();
    }

    //HARDCODED TO WITHDRAW 10%, CHANGE FOR PROD
    function _devWithdraw() internal {
        uint256 balance = address(this).balance;
        balance = balance/devSplit;
        devWallet.transfer(balance);
    }

    // Hardcoded for 90% right now, can change
    // only need to run this once
    // We have total: 10 eth -> 
    //calculates percent of winnings per single winning NFT
    function _calculateWinnersSplit() internal view returns(uint256){
        uint256 balance = address(this).balance;
        balance = balance / random.length;
        return balance;
    }

    function _verifyWinningToken(uint256 tokenId_) internal view virtual returns (bool){
        for (uint256 i = 0; i < random.length; i++){
            if (tokenId_ == random[i]){
                return true;
            }
        }
        return false;
    }

    // removes winning token from random to ensure winners dont claim twice
    // in addition resets random 1 by 1, so we don't have to delete values later on
    // will still have to scrub values if any left
    function _removeWinningTokenOnceClaimed(uint256 tokenId_) internal {
        for (uint256 i = 0; i < random.length; i++){
            if (tokenId_ == random[i]){
                random[i] = random[random.length -1];
                random.pop();
            }
        }
    }

    function fulfillRandomWords(uint256, uint256[] memory randomWords) internal override {
        random = randomWords;
        _filterRandoms();
    }

    function _filterRandoms() internal {
        uint256 currGameNumMints = totalSupply() - gameStartingTokenID; 
        if(gameNumber == 1){
            for(uint256 i = 0; i < random.length; i++){
                random[i] = (random[i] % totalSupply()) + 1;
            }
        }
        else{
            for(uint256 i = 0; i < random.length; i++){
                random[i] = (random[i] % currGameNumMints) + gameStartingTokenID;
            }
        }
    }

    function _setNumWords() internal {
        //capping winners to always be a max of 500
        if((((totalSupply() - gameStartingTokenID)* 5)/ 100) > 500){
            numWords = 500;
        }
        else{
            numWords = uint32(((totalSupply() - gameStartingTokenID)* 5)/ 100);
        }
    }

    function _verifyWinnerbyTokenId(uint256 tokenId_,uint256[] memory random_) internal view virtual returns (bool){
        for (uint256 i = 0; i < random_.length; i++){
            if (tokenId_ == random_[i]){
                return true;
            }
        }
        return false;
    }

    function _verifyWinnerforTokenUri(uint256 tokenId_) internal view returns(bool){
        bool winner;
        for (uint256 i=0; i<=gameNumber; i++){
            if(games[i].mintStart < tokenId_ && tokenId_ < games[i].numMints){
                return _verifyWinnerbyTokenId(tokenId_, games[i].random);
            }
        }
        return winner;
    }

    //++++++++
    // Emergency functions
    //++++++++
    
    //run once round is done
    function resetEmergencyRandom() public onlyOwner {
        emergencyRandom = games[0].random;
    }
    //in case we need to run multiple getRandom() to reach the 5% number of winners
    function appendToEmergencyRandom() public onlyOwner{
        for(uint256 i=0; i<random.length;i++){
            emergencyRandom.push(random[i]);
        }
    }
    function switchBackEmergyRandomWithRandom() public onlyOwner{
        random = games[0].random;
        for(uint256 i=0; i<emergencyRandom.length;i++){
            random.push(emergencyRandom[i]);
        }
        numWords = uint32(random.length);
    }

    //++++++++
    // Override functions
    //++++++++
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
        require(tokenId < totalSupply(), "This token is greater than maxSupply");

        if (revealAll == true) {
            if(_verifyWinnerforTokenUri(tokenId) == true){
                return string(abi.encodePacked(revealUri, "Winner", ".json")); 
            }
            else{
                return string(abi.encodePacked(revealUri, "Loser", ".json")); 
            }
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

    function setNumWordsTEST(uint32 numWords_) public{
        numWords = numWords_;
    }

}

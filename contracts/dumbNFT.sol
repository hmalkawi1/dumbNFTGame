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
import "./abstract/Withdrawable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "hardhat/console.sol";

contract DumbNFT is ERC721A, VRFConsumerBaseV2, Ownable, Withdrawable {
    VRFCoordinatorV2Interface COORDINATOR;
    LinkTokenInterface LINKTOKEN;
    address vrfCoordinator = 0x6168499c0cFfCaCD319c818142124B7A15E857ab; //(RINKEBY)
    address link = 0x01BE23585060835E02B77ef475b0Cc51aA1e0709; //(RINKEBY)
    bytes32 internal keyHash = 0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc; //(RINKEBY)
    uint32 callbackGasLimit = 50000;
    // The default is 3, but you can set this higher.
    uint16 requestConfirmations = 3;
    // Get a subscription ID from https://vrf.chain.link/ to use in the constructor during deployment
    uint64 s_subscriptionId;

    enum SaleState {
        Disabled,
        Enable
    }

    SaleState public saleState = SaleState.Disabled;

    bool public revealEnabled;
    bool public transfersEnabled;
    bool public revealAll;

    uint256 public price;

    uint256[] public random;
    uint256 public gameNumber;
    uint32 public numWords;
    uint256 public gameStartingTokenID = 1;


    // The unRevealedUri that new mints use when all are not revealed
    string public unRevealUri;
    // The reveal uri used once a token is revealed or all are revealed
    string public revealUri;

    // Revealed event is triggered whenever a user reveals a token, address is indexed to make it filterable
    event Revealed(address indexed user, uint256 tokenId, uint256 timestamp);
    event SaleStateChanged(uint256 previousState, uint256 nextState, uint256 timestamp);

    constructor(uint64 subscriptionId) ERC721A("DumbNFT", "DNFT") VRFConsumerBaseV2(vrfCoordinator) {
        //Chainlink
        COORDINATOR = VRFCoordinatorV2Interface(vrfCoordinator);
        LINKTOKEN = LinkTokenInterface(link);
        s_subscriptionId = subscriptionId;
        
        //Defaults
        revealEnabled = false;
        revealAll = false;

        price = 10000000000000000;
        gameNumber = 1;
    }

    modifier whenSaleIsActive() {
        require(saleState != SaleState.Disabled, "Sale is not active");
        _;
    }
    modifier whenRevealIsEnabled() {
        require(revealEnabled, "Reveal is not yet enabled");
        _;
    }


    //++++++++
    // Public functions
    //++++++++

    // Payable mint function for unrevealed NFTs
    function mint(uint256 amount) external payable whenSaleIsActive {

        require(price * amount <= msg.value, "Value sent is not correct");
        
        _safeMint(msg.sender, amount);

    }



    //++++++++
    // Owner functions
    //++++++++


    // Sale functions
    function setSaleState(uint256 _state) external onlyOwner {
        uint256 prevState = uint256(saleState);
        saleState = SaleState(_state);
        emit SaleStateChanged(prevState, _state, block.timestamp);
    }


    function setMintPrice(uint256 _mintPrice) external onlyOwner {
        price = _mintPrice;
    }

    // Reveal functions
    function toggleRevealState() external onlyOwner {
        revealEnabled = !revealEnabled;
    }

    // Get random for revealed NFTs
    function GetRandom() external onlyOwner {
        setNumWords();
        COORDINATOR.requestRandomWords(keyHash, s_subscriptionId, requestConfirmations, callbackGasLimit, numWords);
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
        revealAll = !revealAll;
        if(revealAll == true){
            gameNumber+=1;
            gameStartingTokenID = totalSupply() + 1;
        }
    }

    //++++++++
    // Internal functions
    //++++++++

    function _startTokenId() internal view virtual override returns (uint256) {
        return 1;
    }


    function fulfillRandomWords(uint256, uint256[] memory randomWords) internal override {
        //random = randomWords[0];
        
        //returns a number within a range of 1-50, can be whatever range we want
        //random = (randomWords[0] % 50) + 1;

        for(uint256 i=0; i<numWords;i++){
            random[i] = (randomWords[0] % totalSupply()) + 1;
        }
    }

    function setNumWords() internal {
        //set it to be 5% of the supply
        //could there be an issue by type casting to uint32? 
        numWords = uint32(totalSupply() * 50000000);
    }

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

    function findWinners() internal returns (uint256[] memory expandedValues){
        expandedValues = new uint256[](totalSupply() * 50000000); //use safemath
        for (uint256 i = 0; i < totalSupply(); i++) {
            expandedValues[i] = uint256(keccak256(abi.encode(random, i))) % totalSupply();
        }
        return expandedValues;
    }

    //++++++++
    // Test functions
    //++++++++

    function setRandom(uint256[] calldata random_) public {
        random = random_;
    }

    function setNumWords(uint32 numWords_) public {
        numWords = numWords_;
    }

    function getRandom() public returns(uint256[] memory){
        return random;
    }

    function printRandom() public{
        for(uint256 i = 0; i<random.length;i++){
            console.log(random[i]);
        }
    }

}

// totalSupply * random * tokenID, totalSupply-1
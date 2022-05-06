from wsgiref import headers
import web3;
import requests;



# address = "0x7de3085b3190b3a787822ee16f23be010f5f8686"

# totalSupply = 100;

# options = {
#   address: address,
#   token_id: "1",
#   flag: "metadata",
# };

headers = {
    'X-API-Key' : 'hiStDVOxs8F9w3kssi4butORr2LW5RVSlyYwhqANqmMdYXfObuKI1avsrEN7AzZe'
}

syncNFT = 'https://deep-index.moralis.io/api/v2/nft/0x36087aC5F71e6F0B72429D1D559C8CE2a6A0e7F6/sync?chain=rinkeby'


response = requests.request("GET", syncNFT, headers=headers)

response = response.json

print(response)

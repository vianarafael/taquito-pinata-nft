import { useState, useEffect } from "react";
import { TezosToolkit } from "@taquito/taquito";
import { char2Bytes, bytes2Char } from "@taquito/utils";
import { BeaconWallet } from "@taquito/beacon-wallet";
import { NetworkType } from "@airgap/beacon-sdk";
import * as Constants from "./Objkt.Query";

const Tezos = new TezosToolkit("PRC_URL");

let wallet;
const walletOptions = {
  name: "Illic et Numquam",
  preferredNetwork: NetworkType.GHOSTNET,
};
let userAddress, title, description;

if (process.env.NODE_ENV === "dev") {
  title = "rafa";
  description = "this is rafa";
}

const rpcUrl = "https://uoi3x99n7c.ghostnet.tezosrpc.midl.dev";
const serverUrl =
  process.env.NODE_ENV !== "production"
    ? "http://localhost:8080"
    : "https://[the-huge-one]";

const contractAddress = "KT1VbJAzSAHQMvf5HC9zfEVMPbT2UcBvaMXb";
let nftStorage = undefined;
let userNfts = [];
let pinningMetadata = false;
let mintingToken = false;
let newNft;

const getUserNfts = async (address) => {
  const contract = await Tezos.wallet.at(contractAddress);
  nftStorage = await contract.storage();
  const getTokenIds = await nftStorage.reverse_ledger.get(address);
  if (getTokenIds) {
    userNfts = await Promise.all([
      ...getTokenIds.map(async (id) => {
        const tokenId = id.toNumber();
        const metadata = await nftStorage.token_metadata.get(tokenId);
        const tokenInfoBytes = metadata.token_info.get("");
        const tokenInfo = bytes2Char(tokenInfoBytes);
        return {
          tokenId,
          ipfsHash:
            tokenInfo.slice(0, 7) === "ipfs://" ? tokenInfo.slice(7) : null,
        };
      }),
    ]);
  }
};

function App() {
  const [files, setFiles] = useState([]);
  const [data0, setData0] = useState({ objkts: [] });
  const [data1, setData1] = useState({ objkts: [] });

  const getUseNtfs = async (address) => {
    const contract = await Tezos.wallet.at(contractAddress);
    const ntfStorage = await contract.storage();
    const getTokensId = await ntfStorage.reverse_ledger.get(address);
    if (getTokensId) {
      const userNtfs = await Promise.all([
        getTokensId.map(async (id) => {
          const tokenId = id.toNumber();
          const metadata = await ntfStorage.token_metadata.get(tokenId);
          const tokenInfoBytes = metadata.token_info.get("");
          const tokenInfo = bytes2Char(tokenInfoBytes);
          return {
            tokenId,
            ipfsHash:
              tokenInfo.slice(0, 7) === "ipfs://" ? tokenInfo.slice(7) : null,
          };
        }),
      ]);
    }
  };

  // useEffect(() => {
  //   const fetchData = async () => {
  //     try {
  //       const queryResult = await axios.post(Constants.GRAPHQL_API, {
  //         query: Constants.GET_OBJKT_QUERY,
  //       });
  //       const result = queryResult.data.data;
  //       console.log(result);

  //       setData0({ objkts: result.fa[0].tokens });
  //       setData1({ objkts: result.fa[1].tokens });
  //     } catch {
  //       throw Error("API fetch failed");
  //     }
  //   };
  //   fetchData();
  // }, []);

  const onChangeImages = (e) => {
    setFiles([...e.target.files]);
  };

  const connect = async () => {
    if (!wallet) {
      wallet = new BeaconWallet(walletOptions);
    }
    console.log("da wallet", wallet);
    try {
      await wallet.requestPermissions({
        network: {
          type: NetworkType.GHOSTNET,
          rpcUrl,
        },
      });
      userAddress = await wallet.getPKH();
      Tezos.setWalletProvider(wallet);
      await getUserNfts(userAddress);
    } catch (err) {
      console.error(err);
    }
  };

  const disconnect = () => {
    wallet.client.destroy();
    wallet = undefined;
    userAddress = "";
  };

  const upload = async () => {
    try {
      pinningMetadata = true;

      const data = new FormData();
      data.append("image", files[0]);
      data.append("title", title);
      data.append("description", description);
      data.append("creator", userAddress);
      for (var key of data.entries()) {
        console.log(key[0] + ", " + key[1]);
      }

      const response = await fetch(`${serverUrl}/mint`, {
        method: "POST",
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: data,
      });
      if (response) {
        const data = await response.json();
        if (
          (data.status = true && data.msg.metadataHash && data.msg.imageHash)
        ) {
          pinningMetadata = false;
          mintingToken = true;

          const contract = await Tezos.wallet.at(contractAddress);
          const op = await contract.methods
            .mint(char2Bytes("ipfs://" + data.msg.metadataHash), userAddress)
            .send();
          await op.confirmation();

          newNft = {
            imageHash: data.msg.imageHash,
            metadataHash: data.msg.metadataHash,
            opHash: op.opHash,
          };

          files = undefined;
          title = "";
          description = "";

          await getUseNtfs(userAddress);
        } else {
          throw "No IPFS hash";
        }
      } else {
        throw "No response";
      }
    } catch (error) {
      console.log(error);
    } finally {
      pinningMetadata = false;
      mintingToken = false;
    }
  };
  return (
    <div className="App">
      <div>
        <p>Select your picture</p>
        <br />
        <input type="file" onChange={onChangeImages} />
      </div>
      <div>
        <label for="image-title">
          <span>Title:</span>
          <input type="text" id="image-title" value={title} />
        </label>
      </div>
      <div>
        <label for="image-description">
          <span>Description</span>
          <textarea id="image-description" rows="4" value={description} />
        </label>
      </div>
      <button onClick={upload}>Upload</button>
      <div>
        <button class="roman" onClick={connect}>
          Connect your wallet
        </button>
      </div>
    </div>
  );
}

export default App;

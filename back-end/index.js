const express = require("express");
const pinataSDK = require("@pinata/sdk");
const fs = require("fs");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();

const app = express();
const port = process.env.NODE_ENV === "production" ? process.env.PORT : 8080;

let pinata;

if (process.env.NODE_ENV === "production") {
  pinata = pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET_KEY);
} else {
  const PinataKeys = require("./PinataKeys");
  pinata = pinataSDK(PinataKeys.apiKey, PinataKeys.apiSecret);
}

const corsOptions = {
  origin: ["http://localhost:3000", "https://test-huge-ntf.com"],
  optionsSuccessStatus: 200,
};

const upload = multer({ dest: "uploads/" });
app.use(cors(corsOptions));
app.use(express.json({ limit: "50mb" }));
app.use(
  express.urlencoded({
    limit: "50mb",
    extended: true,
    parameterLimit: 50000,
  })
);

app.post("/mint", upload.single("image"), async (req, res) => {
  const multerReq = req;

  if (!multerReq.file) {
    res.status(500), json({ status: false, msg: "No file provided!" });
  } else {
    const fileName = multerReq.file.filename;

    await pinata
      .testAuthentication()
      .catch((err) => res.status(500).json(JSON.stringify(err)));

    const readableStreamForFile = fs.createReadStream(`./uploads/${fileName}`);
    const options = {
      pinataMetadata: {
        name: req.body.title.replace(/\s/g, "-"),
        keyvalues: {
          description: req.body.description,
        },
      },
    };
    const pinnedFile = await pinata.pinFileToIPFS(
      readableStreamForFile,
      options
    );
    if (pinnedFile.IpfsHash && pinnedFile.PinSize > 0) {
      fs.unlinkSync(`./uploads/${fileName}`);

      const metadata = {
        name: req.body.title,
        description: req.body.description,
        symbol: "TUT",
        artifactUri: `ipfs://${pinnedFile.IpfsHash}`,
        displayUri: `ipfs://${pinnedFile.IpfsHash}`,
        creators: [req.body.creator],
        decimals: 0,
        thumbnailUri: "https://tezostaquito.io/img/favicon.png",
        is_transferable: true,
        shouldPreferSymbol: false,
      };

      const pinnedMetadata = await pinata.pinJSONToIPFS(metadata, {
        pinataMetadata: {
          name: "TUT-metadata",
        },
      });
      if (pinnedMetadata.IpfsHash && pinnedMetadata.PinSize > 0) {
        res.status(200).json({
          status: true,
          msg: {
            imageHash: pinnedFile.IpfsHash,
            metadataHash: pinnedMetadata.IpfsHash,
          },
        });
      }
    }
  }
});

app.listen(port, () => console.log("🚀 🚀 🚀 "));

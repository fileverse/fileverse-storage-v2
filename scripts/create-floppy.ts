// create a floppy with the following details
import Floppy from "../src/infra/database/models/floppy.ts";

const data = [
  {
    shortCode: "FLV",
    name: "Floppy #001",
    description: "Kawai floppy by fileverse!",
    img: "https://ddocs-new-git-maitra-tec-1139-fileverse.vercel.app/assets/floppy1.png",
    metadataURI:
      "ipfs://bafkreic3h7bfs4ifq7kz6wot4b7qyqo3uq3plp4pbf37flg2up5joxkfwq",
    diskSpace: 1000000000,
    offchain: true,
    networkName: "offchain",
    members: [],
    sgid: "n/a",
  },
  {
    shortCode: "OXB",
    name: "OXB #001",
    description: "Floppy for oxford freshers fair participants by fileverse!",
    img: "https://ddocs-new-git-maitra-tec-1139-fileverse.vercel.app/assets/floppy2.png",
    metadataURI:
      "ipfs://bafkreic3h7bfs4ifq7kz6wot4b7qyqo3uq3plp4pbf37flg2up5joxkfwq",
    diskSpace: 1000000000,
    offchain: true,
    networkName: "offchain",
    members: [],
    sgid: "n/a",
  },
];

const createFloppy = async () => {
  for (const item of data) {
    const floppy = await new Floppy(item).save();
    console.log(floppy);
  }
};

createFloppy()
  .then(() => {
    console.log("Floppy created");
  })
  .catch(console.error);

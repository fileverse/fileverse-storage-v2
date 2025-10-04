export const list = async ({
  identityCommitment,
}: {
  identityCommitment: string;
}) => {
  return [
    {
      shortCode: "FLV",
      name: "Floppy #001",
      description: "Kawai floppy by fileverse!",
      img: "https://ddocs-new-git-maitra-tec-1139-fileverse.vercel.app/assets/floppy1.png",
      metadataURI:
        "ipfs://bafkreic3h7bfs4ifq7kz6wot4b7qyqo3uq3plp4pbf37flg2up5joxkfwq",
      diskSpace: 1000000000,
    },
    {
      shortCode: "OXB",
      name: "OXB #001",
      description: "Floppy for oxford freshers fair participants by fileverse!",
      img: "https://ddocs-new-git-maitra-tec-1139-fileverse.vercel.app/assets/floppy2.png",
      metadataURI:
        "ipfs://bafkreic3h7bfs4ifq7kz6wot4b7qyqo3uq3plp4pbf37flg2up5joxkfwq",
      diskSpace: 1000000000,
    },
  ];
};

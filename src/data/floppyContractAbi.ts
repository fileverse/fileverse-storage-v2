import { Abi } from "viem";

export const FLOPPY_CONTRACT_ABI: Abi = [
  {
    inputs: [
      {
        internalType: "string",
        name: "shortCode",
        type: "string",
      },
      {
        internalType: "uint256",
        name: "maxCount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "diskSpace",
        type: "uint256",
      },
      {
        internalType: "string",
        name: "metadataURI",
        type: "string",
      },
      {
        internalType: "address[]",
        name: "managers",
        type: "address[]",
      },
    ],
    name: "addFloppy",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        internalType: "address[]",
        name: "managers",
        type: "address[]",
      },
    ],
    name: "addManagers",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "operator",
        type: "address",
      },
    ],
    name: "addOperator",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "uint256",
            name: "merkleTreeDepth",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "merkleTreeRoot",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "nullifier",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "message",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "scope",
            type: "uint256",
          },
          {
            internalType: "uint256[8]",
            name: "points",
            type: "uint256[8]",
          },
        ],
        internalType: "struct ISemaphore.SemaphoreProof",
        name: "proof",
        type: "tuple",
      },
    ],
    name: "claimFloppy",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "contract ISemaphore",
        name: "_semaphore",
        type: "address",
      },
      {
        internalType: "address",
        name: "_admin",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "nullifier",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "operator",
        type: "address",
      },
    ],
    name: "FloppyClaimed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "string",
        name: "shortCode",
        type: "string",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "groupId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "maxCount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "diskSpace",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "grantCount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "string",
        name: "metadataURI",
        type: "string",
      },
      {
        indexed: false,
        internalType: "address",
        name: "creator",
        type: "address",
      },
    ],
    name: "FloppyCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "identityCommitment",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "manager",
        type: "address",
      },
    ],
    name: "FloppyGranted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "manager",
        type: "address",
      },
    ],
    name: "FloppyManagerAdded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "manager",
        type: "address",
      },
    ],
    name: "FloppyManagerRemoved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "operator",
        type: "address",
      },
    ],
    name: "FloppyOperatorAdded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "operator",
        type: "address",
      },
    ],
    name: "FloppyOperatorRemoved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "string",
        name: "shortCode",
        type: "string",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "groupId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "maxCount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "diskSpace",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "grantCount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "string",
        name: "metadataURI",
        type: "string",
      },
      {
        indexed: false,
        internalType: "address",
        name: "updater",
        type: "address",
      },
    ],
    name: "FloppyUpdated",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "identityCommitment",
        type: "uint256",
      },
    ],
    name: "grantFloppy",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        internalType: "address[]",
        name: "managers",
        type: "address[]",
      },
    ],
    name: "removeManagers",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "operator",
        type: "address",
      },
    ],
    name: "removeOperator",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "maxCount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "diskSpace",
        type: "uint256",
      },
      {
        internalType: "string",
        name: "metadataURI",
        type: "string",
      },
    ],
    name: "updateFloppy",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "admin",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "floppyDisks",
    outputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        internalType: "string",
        name: "shortCode",
        type: "string",
      },
      {
        internalType: "uint256",
        name: "groupId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "maxCount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "diskSpace",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "grantCount",
        type: "uint256",
      },
      {
        internalType: "string",
        name: "metadataURI",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "floppyIdCounter",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "shortCode",
        type: "string",
      },
    ],
    name: "getFloppyByShortCode",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "id",
            type: "uint256",
          },
          {
            internalType: "string",
            name: "shortCode",
            type: "string",
          },
          {
            internalType: "uint256",
            name: "groupId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "maxCount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "diskSpace",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "grantCount",
            type: "uint256",
          },
          {
            internalType: "string",
            name: "metadataURI",
            type: "string",
          },
        ],
        internalType: "struct Floppy.FloppyDisk",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "managerToFloppyIds",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "operators",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "semaphore",
    outputs: [
      {
        internalType: "contract ISemaphore",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    name: "shortCodeToFloppyId",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

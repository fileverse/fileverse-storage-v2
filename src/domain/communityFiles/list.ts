import { CommunityFiles } from "../../infra/database/models";

interface IListCommunityFilesParams {
  publishedBy?: string;
  category?: string;
  invokerAddress?: string;
  search?: string;
  onlyFavorites?: boolean;
  page?: number;
  limit?: number;
}

interface ICommunityFileResponse {
  _id: string;
  publishedBy: string;
  thumbnailIPFSHash: string;
  title: string;
  category: string;
  totalFavorites: number;
  fileLink: string;
  timeStamp: number;
  isFavourite?: boolean;
}

interface IPaginatedResponse {
  files: ICommunityFileResponse[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalFiles: number;
    limit: number;
    hasMore: boolean;
  };
}

export const list = async (
  params: IListCommunityFilesParams
): Promise<IPaginatedResponse> => {
  const {
    publishedBy,
    category,
    invokerAddress,
    search,
    onlyFavorites,
    page = 1,
    limit = 20,
  } = params;

  const baseCriteria: any = {};

  if (publishedBy) {
    baseCriteria.publishedBy = publishedBy;
  }

  if (category) {
    baseCriteria.category = category;
  }

  if (onlyFavorites && invokerAddress) {
    baseCriteria.favoritedBy = { $in: [invokerAddress] };
  }

  if (search) {
    baseCriteria.$or = [
      { title: { $regex: search, $options: "i" } },
      { publishedBy: { $regex: search, $options: "i" } },
    ];
  }

  const currentPage = Math.max(1, page);
  const pageLimit = Math.max(1, Math.min(100, limit));
  const skip = (currentPage - 1) * pageLimit;

  const totalFiles = await CommunityFiles.countDocuments(baseCriteria);
  const totalPages = Math.ceil(totalFiles / pageLimit);

  const itemsToFetch = pageLimit + 1;

  // Use aggregation pipeline to sort by number of favorites
  const pipeline: any[] = [
    { $match: baseCriteria },
    {
      $addFields: {
        favoritesCount: { $size: { $ifNull: ["$favoritedBy", []] } },
      },
    },
    { $sort: { favoritesCount: -1 } },
    { $skip: skip },
    { $limit: itemsToFetch },
  ];

  const communityFiles = await CommunityFiles.aggregate(pipeline);

  const hasMoreItems = communityFiles.length > pageLimit;
  const actualFiles = hasMoreItems
    ? communityFiles.slice(0, pageLimit)
    : communityFiles;

  const transformedFiles: ICommunityFileResponse[] = actualFiles.map((file) => {
    const result: ICommunityFileResponse = {
      ...file,
      _id: file._id.toString(),
      totalFavorites: file.favoritedBy?.length || 0,
    };

    if (invokerAddress) {
      result.isFavourite = file.favoritedBy?.includes(invokerAddress) || false;
    }

    return result;
  });

  return {
    files: transformedFiles,
    pagination: {
      currentPage,
      totalPages,
      totalFiles,
      limit: pageLimit,
      hasMore: hasMoreItems,
    },
  };
};

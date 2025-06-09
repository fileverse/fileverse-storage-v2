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
  fileIPFSHash: string;
  timeStamp: number;
  isFavoritedByInvoker?: boolean;
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

  const query: any = {};

  if (publishedBy) {
    query.publishedBy = publishedBy;
  }

  if (category) {
    query.category = category;
  }

  if (onlyFavorites && invokerAddress) {
    query.favoritedBy = { $in: [invokerAddress] };
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { publishedBy: { $regex: search, $options: "i" } },
    ];
  }

  const currentPage = Math.max(1, page);
  const pageLimit = Math.max(1, Math.min(100, limit));
  const skip = (currentPage - 1) * pageLimit;

  const totalFiles = await CommunityFiles.countDocuments(query);
  const totalPages = Math.ceil(totalFiles / pageLimit);

  const itemsToFetch = pageLimit + 1;
  const communityFiles = await CommunityFiles.find(query)
    .sort({ timeStamp: -1 })
    .skip(skip)
    .limit(itemsToFetch);

  const hasMoreItems = communityFiles.length > pageLimit;
  const actualFiles = hasMoreItems
    ? communityFiles.slice(0, pageLimit)
    : communityFiles;

  const transformedFiles: ICommunityFileResponse[] = actualFiles.map((file) => {
    const fileObj = file.toObject();

    const result: ICommunityFileResponse = {
      ...fileObj,
      _id: fileObj._id.toString(),
      totalFavorites: fileObj.favoritedBy?.length || 0,
    };

    if (invokerAddress) {
      result.isFavoritedByInvoker =
        fileObj.favoritedBy?.includes(invokerAddress) || false;
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

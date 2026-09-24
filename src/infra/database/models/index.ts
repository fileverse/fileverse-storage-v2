import("../index");
import File from "./file";
import Limit from "./limit";
import CommunityFiles from "./communityFiles";
import LegacyPortalLimit from "./legacy-portal-limit";
import Floppy from "./floppy";
import UserOps from "./user-ops";
import ApiAccessKey from "./apiAccessKey";
import Workspace from "./workspace";
import Feedback from "./feedback";
import DocUsage from "./doc-usage";
import { logger } from "../../logger";

for (const m of [DocUsage, Limit]) {
  m.init().catch((err: Error) => {
    logger.error(
      { model: m.modelName, err: { message: err.message, stack: err.stack } },
      "index build failed"
    );
  });
}

export {
  File,
  Limit,
  CommunityFiles,
  LegacyPortalLimit,
  Floppy,
  UserOps,
  ApiAccessKey,
  Workspace,
  Feedback,
  DocUsage,
};

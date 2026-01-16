import { createPimlicoClient } from "permissionless/clients/pimlico";
import { http } from "viem";
import { config } from "../../config";
import { entryPoint07Address } from "viem/account-abstraction";

export const pimlicoClient = createPimlicoClient({
  transport: http(config.BUNDLER_URL),
  entryPoint: {
    address: entryPoint07Address,
    version: "0.7",
  },
});

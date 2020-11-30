import * as OaClientGen from "oa-client-generator/lib/runtime";
import * as Query from "oa-client-generator/lib/runtime/query";

export const defaults: OaClientGen.RequestOpts = {
  baseUrl: "/",
};

const oaclientgen = OaClientGen.runtime(defaults);

export const servers = {};
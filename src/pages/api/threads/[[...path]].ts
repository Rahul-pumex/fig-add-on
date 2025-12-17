import type { NextApiRequest, NextApiResponse } from "next";
import { proxyRequest } from "../../../server/proxy";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { path } = req.query;

  const segments = Array.isArray(path)
    ? path
    : path
    ? [path]
    : [];

  const suffix = segments.join("/");

  const base =
    process.env.COPILOT_BACKEND_URL ;

  const targetPath = suffix ? `threads/${suffix}` : "threads";

  await proxyRequest(req, res, base, targetPath);
}



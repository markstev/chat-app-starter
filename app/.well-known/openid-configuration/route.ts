import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/utils/cors";
//import { baseURL } from "@/baseUrl";

const baseURL = "https://chatwarmup.com";

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const config = {
    issuer: baseURL,
    authorization_endpoint: `${baseURL}/oauth/authorize`,
    token_endpoint: `${baseURL}/oauth/token`,
    jwks_uri: `${baseURL}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    scopes_supported: ["openid", "profile", "email"],
    token_endpoint_auth_methods_supported: [
      "client_secret_basic",
      "client_secret_post",
    ],
    claims_supported: ["sub", "iss", "aud", "exp", "iat", "name", "email"],
  };

  return NextResponse.json(config, {
    headers: getCorsHeaders(origin),
  });
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...getCorsHeaders(origin),
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

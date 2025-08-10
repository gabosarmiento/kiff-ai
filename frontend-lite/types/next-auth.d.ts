import { DefaultSession, DefaultUser } from "next-auth"
import { JWT, DefaultJWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      tenant_id: string
    } & DefaultSession["user"]
    accessToken?: string
  }

  interface User extends DefaultUser {
    id: string
    role: string
    tenant_id: string
    access_token?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    role: string
    tenant_id: string
    accessToken?: string
  }
}